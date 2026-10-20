import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from '../../core/auth/token-storage.service';
import { NotOwnedError } from './account-error';
import { AccountStore, SELECTED_ACCOUNT_STORAGE_KEY } from './account-store.service';
import { Account, AccountHolding, CashTransaction } from './account.models';

const ACCOUNTS: Account[] = [
  { accountId: 1, name: 'Brokerage', openedDate: '2026-01-02' },
  { accountId: 2, name: 'Retirement', openedDate: '2026-02-03' },
];

const HOLDINGS: Record<number, AccountHolding[]> = {
  1: [{ symbol: 'AAPL', quantity: 4, averageCost: 280.1 }],
  2: [{ symbol: 'SPY', quantity: 3, averageCost: 610.5 }],
};

function cash(id: number, reason: CashTransaction['reason']): CashTransaction {
  return { cashTransactionId: id, amount: 10, reason, createdAt: '2026-09-01T00:00:00Z' };
}

const holdingsUrl = (accountId: number) => `/api/accounts/${accountId}/holdings`;
const isCashTransactions = (request: { url: string; method: string }) =>
  request.method === 'GET' && request.url === '/api/me/cash-transactions';

describe('AccountStore', () => {
  let store: AccountStore;
  let http: HttpTestingController;

  // A new store, as after a page reload; this tab's sessionStorage survives it.
  function reload(providers: Provider[] = []): void {
    http?.verify();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [AccountStore, provideHttpClient(), provideHttpClientTesting(), ...providers],
    });
    store = TestBed.inject(AccountStore);
    http = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    sessionStorage.clear();
    reload();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  function load(
    accounts: Account[] = ACCOUNTS,
    funds = 5_000,
    profile: { firstName: string; lastName: string; termsAccepted?: boolean } = {
      firstName: 'Ada',
      lastName: 'Lovelace',
    },
  ): void {
    store.load();
    http.expectOne('/api/me/accounts').flush(accounts);
    for (const account of accounts) {
      http.expectOne(holdingsUrl(account.accountId)).flush(HOLDINGS[account.accountId] ?? []);
    }
    http.expectOne('/api/users/me').flush({ ...profile, availableFunds: funds });
    http.expectOne(isCashTransactions).flush([]);
  }

  describe('deleting archives from active accounts', () => {
    it('requests eligibility without interpreting financial history', () => {
      const next = vi.fn();
      store.eligibility(1).subscribe(next);
      const result = { archiveBlockers: [], deleteBlockers: [] };
      http.expectOne('/api/me/accounts/1/eligibility').flush(result);
      expect(next).toHaveBeenCalledWith(result);
    });
    it('confirms Delete, removes the active account, and refreshes shared balances', () => {
      load();
      store.selectAccount(1, false);
      const next = vi.fn();
      store.deleteAccount(1).subscribe(next);
      const request = http.expectOne('/api/me/accounts/1?confirmed=true');
      expect(request.request.method).toBe('DELETE');
      request.flush(null, { status: 204, statusText: 'No Content' });
      expect(store.accounts().map((a) => a.accountId)).toEqual([2]);
      expect(store.selectedAccountId()).toBe(2);
      http.expectOne('/api/me/accounts').flush([ACCOUNTS[1]]);
      http
        .expectOne('/api/users/me')
        .flush({ firstName: 'Ada', lastName: 'Lovelace', availableFunds: 5000 });
      http.expectOne(isCashTransactions).flush([]);
      expect(next).toHaveBeenCalledWith(undefined);
      expect(store.cashBalance()).toBe(5000);
    });
    it('rejects a client attempt on an unknown account', () => {
      const error = vi.fn();
      store.deleteAccount(99).subscribe({ error });
      expect(error.mock.calls[0][0]).toBeInstanceOf(NotOwnedError);
      http.expectNone('/api/me/accounts/99?confirmed=true');
    });
    it('does not remove an account after a backend refusal', () => {
      load();
      const error = vi.fn();
      store.deleteAccount(1).subscribe({ error });
      http
        .expectOne('/api/me/accounts/1?confirmed=true')
        .flush({ error: 'Account contains cash' }, { status: 409, statusText: 'Conflict' });
      expect(error).toHaveBeenCalled();
      expect(store.accounts()).toEqual(ACCOUNTS);
    });
  });

  describe('loading', () => {
    it('starts idle with nothing selected and no cash', () => {
      expect(store.status()).toBe('idle');
      expect(store.selectedAccount()).toBeNull();
      expect(store.cashBalance()).toBe(0);
    });

    it("loads the accounts, every account's holdings, the shared cash and recent cash transactions", () => {
      store.load();
      expect(store.status()).toBe('loading');

      http.expectOne('/api/me/accounts').flush(ACCOUNTS);
      http.expectOne(holdingsUrl(1)).flush(HOLDINGS[1]);
      http.expectOne(holdingsUrl(2)).flush(HOLDINGS[2]);
      http.expectOne('/api/users/me').flush({ availableFunds: '7500.50' });
      const transactions = http.expectOne(isCashTransactions);
      expect(transactions.request.params.get('limit')).toBe('20');
      transactions.flush([cash(1, 'DEPOSIT')]);

      expect(store.status()).toBe('ready');
      expect(store.cashBalance()).toBe(7500.5);
      expect(store.selectedAccount()?.name).toBe('Brokerage');
      expect(store.selectedHoldings()).toEqual(HOLDINGS[1]);
      expect(store.holdingsByAccount().get(2)).toEqual(HOLDINGS[2]);
      expect(store.cashTransactions()).toHaveLength(1);
    });

    it('loads cash for a user with no accounts', () => {
      load([], 6_000);

      expect(store.status()).toBe('ready');
      expect(store.selectedAccountId()).toBeNull();
      expect(store.selectedHoldings()).toEqual([]);
      expect(store.cashBalance()).toBe(6_000);
    });

    it('reports an error when holdings or cash fail to load', () => {
      store.load();
      http.expectOne('/api/users/me').flush({ availableFunds: 1 });
      http.expectOne('/api/me/accounts').flush(ACCOUNTS);
      http.expectOne(holdingsUrl(1)).flush(HOLDINGS[1]);
      http.expectOne(holdingsUrl(2)).flush(null, { status: 500, statusText: 'Error' });

      expect(store.status()).toBe('error');
    });

    it('stays ready when only the transaction list fails', () => {
      store.load();
      http.expectOne('/api/me/accounts').flush([]);
      http.expectOne('/api/users/me').flush({ availableFunds: 1 });
      http.expectOne(isCashTransactions).flush(null, { status: 500, statusText: 'Error' });

      expect(store.status()).toBe('ready');
    });
  });

  describe('ownership', () => {
    beforeEach(() => load());

    it('refuses to select an account the caller does not own', () => {
      expect(store.selectAccount(999)).toBe(false);
      expect(store.selectedAccountId()).toBe(1);
    });

    it('has no holdings for an account the caller does not own', () => {
      expect(store.holdingsOf(999)).toEqual([]);
      expect(store.holdingsOf(null)).toEqual([]);
    });

    it('refuses to rename an account the caller does not own, without a request', () => {
      let failure: unknown;
      store.renameAccount(999, { name: 'Mine now' }).subscribe({ error: (e) => (failure = e) });

      expect(failure).toBeInstanceOf(NotOwnedError);
      http.expectNone(() => true);
    });

    it('forgets the holdings of an account that is no longer returned', () => {
      store.renameAccount(1, { name: 'Brokerage' }).subscribe();
      http.expectOne({ method: 'PUT', url: '/api/me/accounts/1' }).flush(ACCOUNTS[0]);
      http.expectOne('/api/me/accounts').flush([ACCOUNTS[0]]);

      expect([...store.holdingsByAccount().keys()]).toEqual([1]);
      expect(store.holdingsOf(2)).toEqual([]);
    });
  });

  describe('selection', () => {
    beforeEach(() => load());

    it("switches to another account's portfolio without reloading anything", () => {
      expect(store.selectAccount(2)).toBe(true);

      expect(store.selectedAccount()?.name).toBe('Retirement');
      expect(store.selectedHoldings()).toEqual(HOLDINGS[2]);
      http.expectNone(() => true);
    });

    it('keeps the choice for this tab, so a reload opens the same account', () => {
      store.selectAccount(2);
      expect(sessionStorage.getItem(SELECTED_ACCOUNT_STORAGE_KEY)).toBe('2');

      reload();
      load();

      expect(store.selectedAccount()?.name).toBe('Retirement');
    });

    it('opens the first account when the saved one is unusable or not owned', () => {
      for (const saved of ['999', 'Retirement', '-2']) {
        sessionStorage.setItem(SELECTED_ACCOUNT_STORAGE_KEY, saved);
        reload();
        load();

        expect(store.selectedAccount()?.name).toBe('Brokerage');
      }
    });

    it('forgets the choice at sign-out, so the next user starts on their first account', () => {
      store.selectAccount(2);

      TestBed.inject(TokenStorageService).clear();

      expect(sessionStorage.getItem(SELECTED_ACCOUNT_STORAGE_KEY)).toBeNull();
    });

    it('still switches when storage is blocked', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

      expect(store.selectAccount(2)).toBe(true);
      expect(store.selectedAccount()?.name).toBe('Retirement');
    });

    it('starts with nothing saved when storage cannot be read', () => {
      sessionStorage.setItem(SELECTED_ACCOUNT_STORAGE_KEY, '2');
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

      reload();
      load();

      expect(store.selectedAccount()?.name).toBe('Brokerage');
    });
  });

  describe('selection on the server', () => {
    it('neither reads nor writes storage', () => {
      sessionStorage.setItem(SELECTED_ACCOUNT_STORAGE_KEY, '2');
      reload([{ provide: PLATFORM_ID, useValue: 'server' }]);
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      load();

      expect(store.selectedAccount()?.name).toBe('Brokerage');
      store.selectAccount(2);
      expect(setItem).not.toHaveBeenCalled();
    });
  });

  describe('changes', () => {
    beforeEach(() => load());

    it('creates an empty account, reloads the list and selects it', () => {
      const created: Account = { accountId: 3, name: 'Savings', openedDate: '2026-09-21' };
      let result: Account | undefined;

      store.createAccount({ name: 'Savings' }).subscribe((account) => (result = account));

      const post = http.expectOne({ method: 'POST', url: '/api/me/accounts' });
      expect(post.request.body).toEqual({ name: 'Savings' });
      post.flush(created);
      http.expectOne({ method: 'GET', url: '/api/me/accounts' }).flush([...ACCOUNTS, created]);
      http.expectOne(holdingsUrl(3)).flush([]);

      expect(result).toEqual(created);
      expect(store.accounts()).toHaveLength(3);
      expect(store.selectedAccount()?.name).toBe('Savings');
      expect(store.selectedHoldings()).toEqual([]);
      // Cash is shared, so a new account leaves it untouched.
      expect(store.cashBalance()).toBe(5_000);
    });

    it('reports a created account as created even if the reload fails', () => {
      let result: Account | undefined;
      store.createAccount({ name: 'Savings' }).subscribe((account) => (result = account));

      http
        .expectOne({ method: 'POST', url: '/api/me/accounts' })
        .flush({ accountId: 3, name: 'Savings', openedDate: '2026-09-21' });
      http
        .expectOne({ method: 'GET', url: '/api/me/accounts' })
        .flush(null, { status: 500, statusText: 'Error' });

      expect(result?.accountId).toBe(3);
    });

    it('renames an account and reloads the list', () => {
      const renamed = { ...ACCOUNTS[1], name: 'IRA' };
      store.renameAccount(2, { name: 'IRA' }).subscribe();

      const put = http.expectOne('/api/me/accounts/2');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ name: 'IRA' });
      put.flush(renamed);
      http.expectOne('/api/me/accounts').flush([ACCOUNTS[0], renamed]);

      expect(store.accounts()[1].name).toBe('IRA');
    });

    it('deposits into the shared cash, then reloads cash and transactions', () => {
      let done = false;
      store.deposit(125.5).subscribe(() => (done = true));

      const post = http.expectOne({ method: 'POST', url: '/api/me/cash-transactions' });
      expect(post.request.body).toMatchObject({ amount: 125.5, reason: 'DEPOSIT' });
      // The idempotency key the backend dedupes a retry on.
      expect(post.request.body.clientReference).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      post.flush({});
      http.expectOne('/api/users/me').flush({ availableFunds: 5_125.5 });
      http.expectOne(isCashTransactions).flush([cash(9, 'DEPOSIT')]);

      expect(done).toBe(true);
      expect(store.cashBalance()).toBe(5_125.5);
      expect(store.cashTransactions().map((t) => t.cashTransactionId)).toEqual([9]);
    });

    it('withdraws from the shared cash without changing the selected account', () => {
      store.selectAccount(2);
      store.withdraw(50).subscribe();

      const post = http.expectOne({ method: 'POST', url: '/api/me/cash-transactions' });
      expect(post.request.body).toMatchObject({ amount: 50, reason: 'WITHDRAWAL' });
      post.flush({});
      http.expectOne('/api/users/me').flush({ availableFunds: 4_950 });
      http.expectOne(isCashTransactions).flush([cash(10, 'WITHDRAWAL')]);

      expect(store.cashBalance()).toBe(4_950);
      expect(store.selectedAccountId()).toBe(2);
    });

    it('passes a failed change through without reloading', () => {
      let failure: unknown;
      store.deposit(10).subscribe({ error: (error) => (failure = error) });

      http
        .expectOne({ method: 'POST', url: '/api/me/cash-transactions' })
        .flush({ error: 'Too much' }, { status: 400, statusText: 'Bad Request' });

      expect(failure).toBeTruthy();
      http.expectNone('/api/users/me');
    });
  });

  describe('refreshAfterTrade', () => {
    it("should reload the shared cash and the traded account's positions", () => {
      load();
      const done: unknown[] = [];

      store.refreshAfterTrade(1).subscribe((value) => done.push(value));
      http.expectOne('/api/users/me').flush({
        firstName: 'Ada',
        lastName: 'Lovelace',
        availableFunds: 4_600,
      });
      http.expectOne(holdingsUrl(1)).flush([{ symbol: 'AAPL', quantity: 6, averageCost: 290 }]);

      expect(store.cashBalance()).toBe(4_600);
      expect(store.holdingsOf(1)).toEqual([{ symbol: 'AAPL', quantity: 6, averageCost: 290 }]);
      // The untraded account is left alone.
      expect(store.holdingsOf(2)).toEqual(HOLDINGS[2]);
      expect(done).toEqual([undefined]);
    });

    it('should complete without reloading for an account the caller does not own', () => {
      load();
      const done: unknown[] = [];

      store.refreshAfterTrade(99).subscribe((value) => done.push(value));

      expect(done).toEqual([undefined]);
      http.expectNone('/api/users/me');
    });

    it('reports refresh failure so callers can retry balances without retrying a fill', () => {
      load();
      const done: unknown[] = [];
      const errors: unknown[] = [];

      store.refreshAfterTrade(1).subscribe({
        next: (value) => done.push(value),
        error: (error: unknown) => errors.push(error),
      });
      http.expectOne(holdingsUrl(1)).flush(HOLDINGS[1]);
      http.expectOne('/api/users/me').flush(null, { status: 500, statusText: 'Server Error' });

      // A balance reload failure is independent of the already completed order.
      expect(errors).toHaveLength(1);
      expect(done).toEqual([]);
      expect(store.cashBalance()).toBe(5_000);
    });
  });

  describe('profile', () => {
    it('has no initials before the profile loads', () => {
      expect(store.profile()).toBeNull();
      expect(store.initials()).toBe('');
    });

    it('takes the initials from the first and last name, upper-cased', () => {
      load(ACCOUNTS, 5_000, { firstName: 'ada', lastName: 'lovelace' });

      expect(store.initials()).toBe('AL');
    });

    it('gives one initial when only one name is on file', () => {
      load(ACCOUNTS, 5_000, { firstName: 'Prince', lastName: '   ' });

      expect(store.initials()).toBe('P');
    });

    it('has no full name before the profile loads', () => {
      expect(store.fullName()).toBe('');
    });

    it('joins the first and last name into the full name', () => {
      load(ACCOUNTS, 5_000, { firstName: 'Ada', lastName: 'Lovelace' });

      expect(store.fullName()).toBe('Ada Lovelace');
    });

    it('gives the one name on file as the full name', () => {
      load(ACCOUNTS, 5_000, { firstName: 'Prince', lastName: '   ' });

      expect(store.fullName()).toBe('Prince');
    });
  });

  describe('terms', () => {
    const ADA = { firstName: 'Ada', lastName: 'Lovelace' };
    const termsUrl = '/api/users/me/terms-acceptance';

    it('does not ask for acceptance before the profile loads', () => {
      expect(store.needsTermsAcceptance()).toBe(false);
    });

    it('asks for acceptance when the profile says the terms are not accepted', () => {
      load(ACCOUNTS, 5_000, { ...ADA, termsAccepted: false });

      expect(store.needsTermsAcceptance()).toBe(true);
    });

    it('does not ask again once the profile says the terms are accepted', () => {
      load(ACCOUNTS, 5_000, { ...ADA, termsAccepted: true });

      expect(store.needsTermsAcceptance()).toBe(false);
    });

    it('sends the version the user was shown and takes the profile from the answer', () => {
      load(ACCOUNTS, 5_000, { ...ADA, termsAccepted: false });
      let completed = false;

      store.acceptTerms('2026-10-12').subscribe({ complete: () => (completed = true) });
      const request = http.expectOne(termsUrl);
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({ termsVersion: '2026-10-12' });
      request.flush({ ...ADA, availableFunds: 5_000, termsAccepted: true });

      expect(completed).toBe(true);
      expect(store.needsTermsAcceptance()).toBe(false);
      expect(store.cashBalance()).toBe(5_000);
    });

    it('keeps asking when the backend refuses the acceptance', () => {
      load(ACCOUNTS, 5_000, { ...ADA, termsAccepted: false });
      let status = 0;

      store.acceptTerms('2020-01-01').subscribe({ error: (error) => (status = error.status) });
      http
        .expectOne(termsUrl)
        .flush({ error: 'The terms have changed.' }, { status: 409, statusText: 'Conflict' });

      expect(status).toBe(409);
      expect(store.needsTermsAcceptance()).toBe(true);
    });

    it('ignores a profile read that began before the acceptance was recorded', () => {
      load(ACCOUNTS, 5_000, { ...ADA, termsAccepted: false });
      store['fetchProfile']().subscribe();
      const before = http.expectOne('/api/users/me');

      store.acceptTerms('2026-10-12').subscribe();
      http.expectOne(termsUrl).flush({ ...ADA, availableFunds: 5_000, termsAccepted: true });
      before.flush({ ...ADA, availableFunds: 5_000, termsAccepted: false });
      http.expectOne('/api/users/me').flush({ ...ADA, availableFunds: 5_000, termsAccepted: true });

      expect(store.needsTermsAcceptance()).toBe(false);
    });
  });
  it('keeps current balances while refreshing and rejects profile responses predating a fill', () => {
    load();
    store['fetchProfile']().subscribe();
    const old = http.expectOne('/api/users/me');
    store.refreshAfterTrade(1).subscribe();
    const current = http.expectOne('/api/users/me');
    old.flush({ availableFunds: 5000 });
    expect(store.cashBalance()).toBe(5000);
    current.flush({ availableFunds: 4700 });
    http.expectOne(holdingsUrl(1)).flush([{ symbol: 'AAPL', quantity: 5, averageCost: 280 }]);
    expect(store.cashBalance()).toBe(4700);
    expect(store.holdingsOf(1)[0].quantity).toBe(5);
  });

  describe('refreshing a loaded store', () => {
    it('ignores a load that starts while another is running', () => {
      store.load();
      store.load();
      http.expectOne('/api/me/accounts').flush(ACCOUNTS);
      for (const account of ACCOUNTS) {
        http.expectOne(holdingsUrl(account.accountId)).flush([]);
      }
      http.expectOne('/api/users/me').flush({ firstName: 'Ada', lastName: 'Lovelace' });
      http.expectOne(isCashTransactions).flush([]);
    });

    it('refetches only the transactions while the loaded data is fresh', () => {
      load();
      store.load();
      http.expectNone('/api/me/accounts');
      http.expectOne(isCashTransactions).flush([cash(1, 'DEPOSIT')]);
      expect(store.refreshError()).toBe('');
    });

    it('reports a failed transaction refresh while the loaded data is fresh', () => {
      load();
      store.load();
      http.expectOne(isCashTransactions).flush({}, { status: 500, statusText: 'Error' });
      expect(store.refreshError()).toBe('Unable to refresh transactions.');
    });

    it('reloads when an account is selected after the data has gone stale', () => {
      vi.useFakeTimers();
      try {
        load();
        vi.advanceTimersByTime(61_000);
        expect(store.selectAccount(2)).toBe(true);
        http.expectOne('/api/me/accounts').flush(ACCOUNTS);
        for (const account of ACCOUNTS) {
          http.expectOne(holdingsUrl(account.accountId)).flush([]);
        }
        http.expectOne('/api/users/me').flush({ firstName: 'Ada', lastName: 'Lovelace' });
        http.expectOne(isCashTransactions).flush([]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('keeps showing loaded data when a later refresh fails', () => {
      load();
      store.load(true);
      http.expectOne('/api/users/me').flush({ firstName: 'Ada', lastName: 'Lovelace' });
      http.expectOne('/api/me/accounts').flush({}, { status: 500, statusText: 'Error' });
      expect(store.status()).toBe('ready');
      expect(store.refreshError()).toBe('Unable to refresh accounts.');
    });

    it('builds the full name from whichever names the profile has', () => {
      store.load();
      http.expectOne('/api/users/me').flush({ firstName: null, lastName: 'Lovelace' });
      http.expectOne('/api/me/accounts').flush([]);
      http.expectOne(isCashTransactions).flush([]);
      expect(store.fullName()).toBe('Lovelace');
    });
  });
});
