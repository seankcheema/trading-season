import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { BACKEND_API_URL } from '../../core/api.config';
import { NotOwnedError } from './account-error';
import {
  Account,
  CashTransaction,
  CashTransactionReason,
  NewAccount,
  NewPortfolio,
  Portfolio,
  PortfolioDetails,
} from './account.models';

export type AccountLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

// Most recent cash transactions shown for the selected account.
const CASH_TRANSACTION_LIMIT = 20;

// The signed-in user's accounts, portfolios and cash transactions for one dashboard.
//
// Provided by the dashboard rather than the root injector, so signing out and back in as
// someone else never shows the previous user's data. The backend scopes every endpoint to
// the token's subject; this store additionally refuses to select or change an account or
// portfolio that is not among the ones the backend returned for the caller.
@Injectable()
export class AccountStore {
  private readonly _http = inject(HttpClient);
  private readonly _apiUrl = inject(BACKEND_API_URL);

  private readonly _accounts = signal<Account[]>([]);
  private readonly _portfolios = signal<Portfolio[]>([]);
  private readonly _cashTransactions = signal<CashTransaction[]>([]);
  private readonly _selectedAccountId = signal<number | null>(null);
  private readonly _selectedPortfolioId = signal<number | null>(null);

  readonly status = signal<AccountLoadStatus>('idle');
  readonly cashTransactionsLoading = signal(false);

  readonly accounts = this._accounts.asReadonly();

  // A portfolio is only usable when its account is one the caller owns.
  readonly portfolios = computed(() => {
    const owned = new Set(this._accounts().map((account) => account.accountId));
    return this._portfolios().filter((portfolio) => owned.has(portfolio.accountId));
  });

  readonly selectedAccount = computed(
    () =>
      this._accounts().find((account) => account.accountId === this._selectedAccountId()) ??
      this._accounts()[0] ??
      null,
  );

  readonly selectedAccountId = computed(() => this.selectedAccount()?.accountId ?? null);

  readonly accountPortfolios = computed(() =>
    this.portfolios().filter((portfolio) => portfolio.accountId === this.selectedAccountId()),
  );

  readonly selectedPortfolio = computed(
    () =>
      this.accountPortfolios().find(
        (portfolio) => portfolio.portfolioId === this._selectedPortfolioId(),
      ) ??
      this.accountPortfolios()[0] ??
      null,
  );

  readonly cashTransactions = computed(() =>
    this._cashTransactions().filter(
      (transaction) => transaction.accountId === this.selectedAccountId(),
    ),
  );

  load(): void {
    this.status.set('loading');
    forkJoin([this.fetchAccounts(), this.fetchPortfolios()]).subscribe({
      next: () => {
        this.status.set('ready');
        this.refreshCashTransactions();
      },
      error: () => this.status.set('error'),
    });
  }

  isOwnedAccount(accountId: number | null | undefined): boolean {
    return this._accounts().some((account) => account.accountId === accountId);
  }

  isOwnedPortfolio(portfolioId: number | null | undefined): boolean {
    return this.portfolios().some((portfolio) => portfolio.portfolioId === portfolioId);
  }

  accountById(accountId: number | null | undefined): Account | null {
    return this._accounts().find((account) => account.accountId === accountId) ?? null;
  }

  // Returns false, and leaves the selection alone, for an account the caller doesn't own.
  selectAccount(accountId: number): boolean {
    return this.select(accountId, true);
  }

  // Returns false for a portfolio the caller doesn't own. Selecting a portfolio also selects
  // the account it belongs to.
  selectPortfolio(portfolioId: number): boolean {
    const portfolio = this.portfolios().find((item) => item.portfolioId === portfolioId);
    if (!portfolio) {
      return false;
    }
    this.selectAccount(portfolio.accountId);
    this._selectedPortfolioId.set(portfolioId);
    return true;
  }

  createAccount(details: NewAccount): Observable<Account> {
    return this._http.post<Account>(`${this._apiUrl}/me/accounts`, details).pipe(
      switchMap((created) =>
        this.afterChange(
          this.fetchAccounts().pipe(
            tap(() => this.select(created.accountId, false)),
            // Load the new account's ledger explicitly: a first account is already the
            // selection by default, so selecting it again would not trigger a load, and
            // an opening deposit is already a transaction.
            switchMap(() => this.fetchCashTransactions(created.accountId)),
          ),
          created,
        ),
      ),
    );
  }

  createPortfolio(details: NewPortfolio): Observable<Portfolio> {
    if (!this.isOwnedAccount(details.accountId)) {
      return throwError(() => new NotOwnedError());
    }
    return this._http
      .post<Portfolio>(`${this._apiUrl}/me/portfolios`, details)
      .pipe(
        switchMap((created) =>
          this.afterChange(this.fetchPortfolios(), created).pipe(
            tap(() => this.selectPortfolio(created.portfolioId)),
          ),
        ),
      );
  }

  updatePortfolio(portfolioId: number, details: PortfolioDetails): Observable<Portfolio> {
    if (!this.isOwnedPortfolio(portfolioId)) {
      return throwError(() => new NotOwnedError());
    }
    return this._http
      .put<Portfolio>(`${this._apiUrl}/me/portfolios/${portfolioId}`, details)
      .pipe(switchMap((updated) => this.afterChange(this.fetchPortfolios(), updated)));
  }

  deposit(accountId: number, amount: number): Observable<void> {
    return this.postCashTransaction(accountId, amount, 'DEPOSIT');
  }

  withdraw(accountId: number, amount: number): Observable<void> {
    return this.postCashTransaction(accountId, amount, 'WITHDRAWAL');
  }

  private postCashTransaction(
    accountId: number,
    amount: number,
    reason: CashTransactionReason,
  ): Observable<void> {
    if (!this.isOwnedAccount(accountId)) {
      return throwError(() => new NotOwnedError());
    }
    return this._http
      .post<unknown>(`${this._apiUrl}/accounts/${accountId}/cash-transactions`, {
        amount,
        reason,
      })
      .pipe(
        switchMap(() =>
          // Balances and the transaction list both change, so reload both rather than
          // patching them locally from the response.
          this.afterChange(
            forkJoin([this.fetchAccounts(), this.fetchCashTransactions(accountId)]),
            undefined,
          ),
        ),
        // The account's transactions were just reloaded, so switching to it needn't fetch again.
        tap(() => this.select(accountId, false)),
      );
  }

  private select(accountId: number, loadTransactions: boolean): boolean {
    if (!this.isOwnedAccount(accountId)) {
      return false;
    }
    if (accountId !== this.selectedAccountId()) {
      this._selectedAccountId.set(accountId);
      this._selectedPortfolioId.set(null);
      if (loadTransactions) {
        this.refreshCashTransactions();
      }
    }
    return true;
  }

  // Runs a refresh after a successful change and emits the change's result either way:
  // the change already happened, so a failed reload must not be reported as a failed save.
  private afterChange<T>(refresh: Observable<unknown>, result: T): Observable<T> {
    return refresh.pipe(
      catchError(() => of(null)),
      map(() => result),
    );
  }

  private refreshCashTransactions(): void {
    const accountId = this.selectedAccountId();
    if (accountId === null) {
      return;
    }
    this.cashTransactionsLoading.set(true);
    this.fetchCashTransactions(accountId).subscribe({
      next: () => this.cashTransactionsLoading.set(false),
      error: () => this.cashTransactionsLoading.set(false),
    });
  }

  private fetchAccounts(): Observable<Account[]> {
    return this._http
      .get<Account[]>(`${this._apiUrl}/me/accounts`)
      .pipe(tap((accounts) => this._accounts.set(accounts)));
  }

  private fetchPortfolios(): Observable<Portfolio[]> {
    return this._http
      .get<Portfolio[]>(`${this._apiUrl}/me/portfolios`)
      .pipe(tap((portfolios) => this._portfolios.set(portfolios)));
  }

  private fetchCashTransactions(accountId: number): Observable<CashTransaction[]> {
    return this._http
      .get<CashTransaction[]>(`${this._apiUrl}/accounts/${accountId}/cash-transactions`, {
        params: { limit: CASH_TRANSACTION_LIMIT },
      })
      .pipe(
        // Keep other accounts' cached rows and drop anything that isn't this account's.
        tap((transactions) =>
          this._cashTransactions.update((current) => [
            ...current.filter((transaction) => transaction.accountId !== accountId),
            ...transactions.filter((transaction) => transaction.accountId === accountId),
          ]),
        ),
      );
  }
}
