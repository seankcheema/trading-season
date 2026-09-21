import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { BACKEND_API_URL } from '../../core/api.config';
import { NotOwnedError } from './account-error';
import {
  Account,
  AccountDetails,
  AccountHolding,
  CashTransaction,
  CashTransactionReason,
  UserFunds,
} from './account.models';

export type AccountLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

// Most recent cash transactions shown on the dashboard.
const CASH_TRANSACTION_LIMIT = 20;

// The signed-in user's accounts, each account's holdings, and the cash they share.
//
// Provided by the dashboard rather than the root injector, so signing out and back in as
// someone else never shows the previous user's data. The backend scopes every endpoint to
// the token's subject; this store additionally refuses to select, rename or read holdings
// for an account that is not among the ones the backend returned for the caller.
@Injectable()
export class AccountStore {
  private readonly _http = inject(HttpClient);
  private readonly _apiUrl = inject(BACKEND_API_URL);

  private readonly _accounts = signal<Account[]>([]);
  private readonly _holdings = signal(new Map<number, AccountHolding[]>());
  private readonly _cashBalance = signal(0);
  private readonly _cashTransactions = signal<CashTransaction[]>([]);
  private readonly _selectedAccountId = signal<number | null>(null);

  readonly status = signal<AccountLoadStatus>('idle');

  readonly accounts = this._accounts.asReadonly();
  // Shared by every account.
  readonly cashBalance = this._cashBalance.asReadonly();
  readonly cashTransactions = this._cashTransactions.asReadonly();

  readonly selectedAccount = computed(
    () =>
      this._accounts().find((account) => account.accountId === this._selectedAccountId()) ??
      this._accounts()[0] ??
      null,
  );

  readonly selectedAccountId = computed(() => this.selectedAccount()?.accountId ?? null);

  // The selected account's portfolio.
  readonly selectedHoldings = computed(() => this.holdingsOf(this.selectedAccountId()));

  // Every owned account's portfolio, keyed by account id.
  readonly holdingsByAccount = computed(
    () =>
      new Map(
        this._accounts().map((account) => [account.accountId, this.holdingsOf(account.accountId)]),
      ),
  );

  load(): void {
    this.status.set('loading');
    forkJoin([
      this.fetchAccounts().pipe(switchMap((accounts) => this.fetchAllHoldings(accounts))),
      this.fetchCash(),
    ]).subscribe({
      next: () => {
        this.status.set('ready');
        this.fetchCashTransactions().subscribe({ error: () => undefined });
      },
      error: () => this.status.set('error'),
    });
  }

  isOwnedAccount(accountId: number | null | undefined): boolean {
    return this._accounts().some((account) => account.accountId === accountId);
  }

  // Holdings are only ever kept for owned accounts; anything else has none.
  holdingsOf(accountId: number | null | undefined): AccountHolding[] {
    return this.isOwnedAccount(accountId) ? (this._holdings().get(accountId!) ?? []) : [];
  }

  // Returns false, and leaves the selection alone, for an account the caller doesn't own.
  selectAccount(accountId: number): boolean {
    if (!this.isOwnedAccount(accountId)) {
      return false;
    }
    this._selectedAccountId.set(accountId);
    return true;
  }

  // Opens a new, empty account and selects it. Cash is shared, so there is nothing to fund.
  createAccount(details: AccountDetails): Observable<Account> {
    return this._http.post<Account>(`${this._apiUrl}/me/accounts`, details).pipe(
      switchMap((created) =>
        this.afterChange(
          this.fetchAccounts().pipe(switchMap(() => this.fetchHoldings(created.accountId))),
          created,
        ),
      ),
      tap((created) => this.selectAccount(created.accountId)),
    );
  }

  // Renaming is the only edit an account, and so its portfolio, supports.
  renameAccount(accountId: number, details: AccountDetails): Observable<Account> {
    if (!this.isOwnedAccount(accountId)) {
      return throwError(() => new NotOwnedError());
    }
    return this._http
      .put<Account>(`${this._apiUrl}/me/accounts/${accountId}`, details)
      .pipe(switchMap((updated) => this.afterChange(this.fetchAccounts(), updated)));
  }

  deposit(amount: number): Observable<void> {
    return this.postCashTransaction(amount, 'DEPOSIT');
  }

  withdraw(amount: number): Observable<void> {
    return this.postCashTransaction(amount, 'WITHDRAWAL');
  }

  private postCashTransaction(amount: number, reason: CashTransactionReason): Observable<void> {
    return this._http
      .post<unknown>(`${this._apiUrl}/me/cash-transactions`, { amount, reason })
      .pipe(
        // Cash and the transaction list both change, so reload both rather than patching them
        // locally from the response.
        switchMap(() =>
          this.afterChange(forkJoin([this.fetchCash(), this.fetchCashTransactions()]), undefined),
        ),
      );
  }

  // Runs a refresh after a successful change and emits the change's result either way:
  // the change already happened, so a failed reload must not be reported as a failed save.
  private afterChange<T>(refresh: Observable<unknown>, result: T): Observable<T> {
    return refresh.pipe(
      catchError(() => of(null)),
      map(() => result),
    );
  }

  private fetchAccounts(): Observable<Account[]> {
    return this._http.get<Account[]>(`${this._apiUrl}/me/accounts`).pipe(
      tap((accounts) => {
        this._accounts.set(accounts);
        // Forget holdings of any account the caller no longer owns.
        const owned = new Set(accounts.map((account) => account.accountId));
        this._holdings.update(
          (current) => new Map([...current].filter(([accountId]) => owned.has(accountId))),
        );
      }),
    );
  }

  private fetchAllHoldings(accounts: Account[]): Observable<unknown> {
    return accounts.length
      ? forkJoin(accounts.map((account) => this.fetchHoldings(account.accountId)))
      : of(null);
  }

  private fetchHoldings(accountId: number): Observable<AccountHolding[]> {
    return this._http
      .get<AccountHolding[]>(`${this._apiUrl}/accounts/${accountId}/holdings`)
      .pipe(
        tap((holdings) =>
          this._holdings.update((current) => new Map(current).set(accountId, holdings)),
        ),
      );
  }

  private fetchCash(): Observable<UserFunds> {
    return this._http
      .get<UserFunds>(`${this._apiUrl}/users/me`)
      .pipe(tap((profile) => this._cashBalance.set(Number(profile.availableFunds) || 0)));
  }

  private fetchCashTransactions(): Observable<CashTransaction[]> {
    return this._http
      .get<CashTransaction[]>(`${this._apiUrl}/me/cash-transactions`, {
        params: { limit: CASH_TRANSACTION_LIMIT },
      })
      .pipe(tap((transactions) => this._cashTransactions.set(transactions)));
  }
}
