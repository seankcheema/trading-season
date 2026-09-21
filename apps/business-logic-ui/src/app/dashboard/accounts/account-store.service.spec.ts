import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NotOwnedError } from './account-error';
import { AccountStore } from './account-store.service';
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AccountStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(AccountStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function load(accounts: Account[] = ACCOUNTS, funds = 5_000): void {
    store.load();
    http.expectOne('/api/me/accounts').flush(accounts);
    for (const account of accounts) {
      http.expectOne(holdingsUrl(account.accountId)).flush(HOLDINGS[account.accountId] ?? []);
    }
    http.expectOne('/api/users/me').flush({ availableFunds: funds });
    http.expectOne(isCashTransactions).flush([]);
  }

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
      expect(post.request.body).toEqual({ amount: 125.5, reason: 'DEPOSIT' });
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
      expect(post.request.body).toEqual({ amount: 50, reason: 'WITHDRAWAL' });
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
});
