import { TokenStorageService } from '../../core/auth/token-storage.service';
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Observable,
  Subject,
  finalize,
  shareReplay,
  takeUntil,
  catchError,
  forkJoin,
  map,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { BACKEND_API_URL } from '../../core/api.config';
import { NotOwnedError } from './account-error';
import {
  Account,
  AccountDetails,
  AccountHolding,
  CashTransaction,
  CashTransactionReason,
  UserProfile,
} from './account.models';

export type AccountLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

// Most recent cash transactions shown on the dashboard.
const CASH_TRANSACTION_LIMIT = 20;

// Most cash transactions the backend returns in one read; the full transaction history uses it.
const CASH_HISTORY_LIMIT = 200;

// The signed-in user's accounts, each account's holdings, and the cash they share.
//
// Shared across authenticated views; identity changes synchronously cancel and clear user data.
@Injectable({ providedIn: 'root' })
export class AccountStore {
  private readonly _http = inject(HttpClient);
  private readonly _apiUrl = inject(BACKEND_API_URL);

  private readonly _accounts = signal<Account[]>([]);
  private readonly _holdings = signal(new Map<number, AccountHolding[]>());
  private readonly _cashBalance = signal(0);
  private readonly _profile = signal<UserProfile | null>(null);
  private readonly _cashTransactions = signal<CashTransaction[]>([]);
  private readonly _selectedAccountId = signal<number | null>(null);

  private revision = 0;
  private readonly cancelled = new Subject<void>();
  private readonly reads = new Map<string, Observable<unknown>>();
  private loading = false;
  private loadedAt = 0;
  private stale = false;
  readonly refreshError = signal('');

  constructor() {
    inject(TokenStorageService).onIdentityChange(() => {
      this.invalidate();
      this.cancelled.next();
      this._accounts.set([]);
      this._holdings.set(new Map());
      this._cashBalance.set(0);
      this._profile.set(null);
      this._cashTransactions.set([]);
      this._selectedAccountId.set(null);
      this.status.set('idle');
      this.refreshError.set('');
      this.loadedAt = 0;
      this.loading = false;
    });
  }

  private invalidate(): void {
    this.revision++;
    this.stale = true;
    this.reads.clear();
  }

  // A superseded GET joins the replacement request instead of publishing stale balances.
  private read<T>(key: string, factory: () => Observable<T>): Observable<T> {
    const existing = this.reads.get(key);
    if (existing) return existing as Observable<T>;
    const revision = this.revision;
    const request = factory().pipe(
      switchMap((value) => (revision === this.revision ? of(value) : this.read(key, factory))),
      takeUntil(this.cancelled),
      finalize(() => {
        if (this.reads.get(key) === request) this.reads.delete(key);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.reads.set(key, request);
    return request;
  }

  readonly status = signal<AccountLoadStatus>('idle');

  readonly accounts = this._accounts.asReadonly();
  // Shared by every account.
  readonly cashBalance = this._cashBalance.asReadonly();
  readonly cashTransactions = this._cashTransactions.asReadonly();
  readonly profile = this._profile.asReadonly();

  // The signed-in user's first and last initial, for the profile button. Empty until the
  // profile loads, and never a partial guess: one name alone gives one letter.
  readonly initials = computed(() => {
    const profile = this._profile();
    if (!profile) {
      return '';
    }
    return `${firstLetter(profile.firstName)}${firstLetter(profile.lastName)}`;
  });

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

  load(refresh = false): void {
    if (this.loading) return;
    if (!refresh && !this.stale && this.loadedAt && Date.now() - this.loadedAt < 60_000) {
      this.fetchCashTransactions().subscribe({
        error: () => this.refreshError.set('Unable to refresh transactions.'),
      });
      return;
    }
    this.loading = true;
    if (!this.loadedAt) this.status.set('loading');
    forkJoin([
      this.fetchAccounts().pipe(switchMap((accounts) => this.fetchAllHoldings(accounts))),
      this.fetchProfile(),
    ])
      .pipe(
        takeUntil(this.cancelled),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: () => {
          this.stale = false;
          this.loadedAt = Date.now();
          this.refreshError.set('');
          this.status.set('ready');
          this.fetchCashTransactions().subscribe({ error: () => undefined });
        },
        error: () => {
          this.refreshError.set('Unable to refresh accounts.');
          if (!this.loadedAt) this.status.set('error');
        },
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
  selectAccount(accountId: number, refresh = true): boolean {
    if (!this.isOwnedAccount(accountId)) {
      return false;
    }
    this._selectedAccountId.set(accountId);
    if (refresh && (this.stale || (this.loadedAt && Date.now() - this.loadedAt >= 60_000)))
      this.load(true);
    return true;
  }

  // Opens a new, empty account and selects it. Cash is shared, so there is nothing to fund.
  createAccount(details: AccountDetails): Observable<Account> {
    return this._http.post<Account>(`${this._apiUrl}/me/accounts`, details).pipe(
      takeUntil(this.cancelled),
      tap((created) => {
        this.invalidate();
        this._accounts.update((accounts) => [...accounts, created]);
      }),
      switchMap((created) =>
        this.afterChange(
          this.fetchAccounts().pipe(switchMap(() => this.fetchHoldings(created.accountId))),
          created,
        ),
      ),
      tap((created) => this.selectAccount(created.accountId, false)),
    );
  }

  // Renaming is the only edit an account, and so its portfolio, supports.
  renameAccount(accountId: number, details: AccountDetails): Observable<Account> {
    if (!this.isOwnedAccount(accountId)) {
      return throwError(() => new NotOwnedError());
    }
    return this._http.put<Account>(`${this._apiUrl}/me/accounts/${accountId}`, details).pipe(
      takeUntil(this.cancelled),
      tap((updated) => {
        this.invalidate();
        this._accounts.update((accounts) =>
          accounts.map((account) => (account.accountId === updated.accountId ? updated : account)),
        );
      }),
      switchMap((updated) => this.afterChange(this.fetchAccounts(), updated)),
    );
  }

  // Retains all server history and removes only the active account from this store.
  deleteAccount(accountId: number): Observable<void> {
    if (!this.isOwnedAccount(accountId)) return throwError(() => new NotOwnedError());
    return this._http.delete<void>(`${this._apiUrl}/accounts/${accountId}`).pipe(
      takeUntil(this.cancelled),
      tap(() => {
        this.invalidate();
        this._accounts.update((accounts) =>
          accounts.filter((account) => account.accountId !== accountId),
        );
        this._holdings.update((holdings) => {
          const remaining = new Map(holdings);
          remaining.delete(accountId);
          return remaining;
        });
        if (this._selectedAccountId() === accountId) this._selectedAccountId.set(null);
      }),
      switchMap(() => this.afterChange(this.fetchAccounts(), undefined)),
    );
  }

  deposit(amount: number): Observable<void> {
    return this.postCashTransaction(amount, 'DEPOSIT');
  }

  withdraw(amount: number): Observable<void> {
    return this.postCashTransaction(amount, 'WITHDRAWAL');
  }

  // Reloads what a filled order changed: the user's cash, which every account shares, and
  // the traded account's positions. Errors describe the reload only: the fill has already
  // happened, so callers can retry balances without reporting the trade as failed.
  refreshAfterTrade(accountId: number): Observable<void> {
    if (!this.isOwnedAccount(accountId)) {
      return of(undefined);
    }
    this.invalidate();
    return forkJoin([this.fetchProfile(), this.fetchHoldings(accountId)]).pipe(
      tap(() => {
        this.stale = false;
        this.refreshError.set('');
      }),
      map(() => undefined),
    );
  }

  private postCashTransaction(amount: number, reason: CashTransactionReason): Observable<void> {
    return this._http
      .post<unknown>(`${this._apiUrl}/me/cash-transactions`, { amount, reason })
      .pipe(
        takeUntil(this.cancelled),
        tap(() => this.invalidate()),
        // Cash and the transaction list both change, so reload both rather than patching them
        // locally from the response.
        switchMap(() =>
          this.afterChange(
            forkJoin([this.fetchProfile(), this.fetchCashTransactions()]),
            undefined,
          ),
        ),
      );
  }

  // Runs a refresh after a successful change and emits the change's result either way:
  // the change already happened, so a failed reload must not be reported as a failed save.
  private afterChange<T>(refresh: Observable<unknown>, result: T): Observable<T> {
    return refresh.pipe(
      tap(() => {
        this.stale = false;
        this.refreshError.set('');
      }),
      catchError(() => {
        this.refreshError.set(
          'Saved successfully, but balances could not refresh. Retry refreshing accounts.',
        );
        return of(null);
      }),
      map(() => result),
    );
  }

  // The user's cash transactions, newest first, beyond the few the dashboard keeps. The result
  // is not cached: it belongs to the dialog that asked for it.
  loadCashHistory(): Observable<CashTransaction[]> {
    return this._http
      .get<CashTransaction[]>(`${this._apiUrl}/me/cash-transactions`, {
        params: { limit: CASH_HISTORY_LIMIT },
      })
      .pipe(takeUntil(this.cancelled));
  }

  private fetchAccounts(): Observable<Account[]> {
    return this.read('accounts', () =>
      this._http.get<Account[]>(`${this._apiUrl}/me/accounts`),
    ).pipe(
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
    return this.read(`holdings:${accountId}`, () =>
      this._http.get<AccountHolding[]>(`${this._apiUrl}/accounts/${accountId}/holdings`),
    ).pipe(
      tap((holdings) => {
        if (this.isOwnedAccount(accountId))
          this._holdings.update((current) => new Map(current).set(accountId, holdings));
      }),
    );
  }

  // One request serves both the shared cash and who the user is.
  private fetchProfile(): Observable<UserProfile> {
    return this.read('profile', () => this._http.get<UserProfile>(`${this._apiUrl}/users/me`)).pipe(
      tap((profile) => {
        this._profile.set(profile);
        this._cashBalance.set(Number(profile.availableFunds) || 0);
      }),
    );
  }

  private fetchCashTransactions(): Observable<CashTransaction[]> {
    return this.read('cash', () =>
      this._http.get<CashTransaction[]>(`${this._apiUrl}/me/cash-transactions`, {
        params: { limit: CASH_TRANSACTION_LIMIT },
      }),
    ).pipe(tap((transactions) => this._cashTransactions.set(transactions)));
  }
}

function firstLetter(name: string | null | undefined): string {
  return (name ?? '').trim().charAt(0).toUpperCase();
}
