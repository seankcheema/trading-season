import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NotOwnedError } from './account-error';
import { AccountStore } from './account-store.service';
import { Account, CashTransaction, Portfolio } from './account.models';

const ACCOUNTS: Account[] = [
  {
    accountId: 1,
    name: 'Brokerage',
    currency: 'USD',
    cashBalance: 1_000,
    openedDate: '2026-01-02',
  },
  { accountId: 2, name: 'Retirement', currency: 'USD', cashBalance: 500, openedDate: '2026-02-03' },
];

const PORTFOLIOS: Portfolio[] = [
  {
    portfolioId: 11,
    accountId: 1,
    name: 'Growth',
    description: null,
    createdAt: '2026-01-03T00:00:00Z',
  },
  {
    portfolioId: 21,
    accountId: 2,
    name: 'Income',
    description: 'Bonds',
    createdAt: '2026-02-04T00:00:00Z',
  },
  // Attached to an account the caller does not own.
  {
    portfolioId: 99,
    accountId: 999,
    name: 'Foreign',
    description: null,
    createdAt: '2026-02-04T00:00:00Z',
  },
];

function cash(id: number, accountId: number, reason: CashTransaction['reason']): CashTransaction {
  return {
    cashTransactionId: id,
    accountId,
    amount: 10,
    reason,
    createdAt: '2026-09-01T00:00:00Z',
  };
}

const cashUrl = (accountId: number) => `/api/accounts/${accountId}/cash-transactions`;

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

  function load(
    accounts: Account[] = ACCOUNTS,
    portfolios: Portfolio[] = PORTFOLIOS,
    transactions: CashTransaction[] = [],
  ): void {
    store.load();
    http.expectOne('/api/me/accounts').flush(accounts);
    http.expectOne('/api/me/portfolios').flush(portfolios);
    if (accounts.length) {
      http
        .expectOne((request) => request.url === cashUrl(accounts[0].accountId))
        .flush(transactions);
    }
  }

  describe('loading', () => {
    it('starts idle with nothing selected', () => {
      expect(store.status()).toBe('idle');
      expect(store.selectedAccount()).toBeNull();
      expect(store.selectedPortfolio()).toBeNull();
    });

    it('loads accounts and portfolios, then the first account’s recent cash transactions', () => {
      store.load();
      expect(store.status()).toBe('loading');

      http.expectOne('/api/me/accounts').flush(ACCOUNTS);
      http.expectOne('/api/me/portfolios').flush(PORTFOLIOS);
      const request = http.expectOne((candidate) => candidate.url === cashUrl(1));
      expect(request.request.params.get('limit')).toBe('20');
      request.flush([cash(1, 1, 'DEPOSIT')]);

      expect(store.status()).toBe('ready');
      expect(store.selectedAccount()?.name).toBe('Brokerage');
      expect(store.selectedPortfolio()?.name).toBe('Growth');
      expect(store.cashTransactions()).toHaveLength(1);
    });

    it('reports an error when either list fails to load', () => {
      store.load();
      http.expectOne('/api/me/accounts').flush(ACCOUNTS);
      http.expectOne('/api/me/portfolios').flush(null, { status: 500, statusText: 'Error' });

      expect(store.status()).toBe('error');
    });

    it('does not request cash transactions when the user has no accounts', () => {
      load([], []);

      expect(store.status()).toBe('ready');
      expect(store.selectedAccountId()).toBeNull();
    });

    it('clears the transaction loading flag even when that request fails', () => {
      store.load();
      http.expectOne('/api/me/accounts').flush(ACCOUNTS);
      http.expectOne('/api/me/portfolios').flush(PORTFOLIOS);
      expect(store.cashTransactionsLoading()).toBe(true);

      http
        .expectOne((request) => request.url === cashUrl(1))
        .flush(null, { status: 500, statusText: 'Error' });

      expect(store.cashTransactionsLoading()).toBe(false);
    });
  });

  describe('ownership', () => {
    beforeEach(() => load());

    it('drops portfolios that belong to an account the caller does not own', () => {
      expect(store.portfolios().map((portfolio) => portfolio.portfolioId)).toEqual([11, 21]);
      expect(store.isOwnedPortfolio(99)).toBe(false);
    });

    it('ignores cash transactions the backend returns for another account', () => {
      store.selectAccount(2);
      http
        .expectOne((request) => request.url === cashUrl(2))
        .flush([cash(5, 2, 'DEPOSIT'), cash(6, 999, 'DEPOSIT')]);

      expect(store.cashTransactions().map((transaction) => transaction.cashTransactionId)).toEqual([
        5,
      ]);
    });

    it('refuses to select an account or portfolio the caller does not own', () => {
      expect(store.selectAccount(999)).toBe(false);
      expect(store.selectPortfolio(99)).toBe(false);
      expect(store.selectedAccountId()).toBe(1);
    });

    it('refuses to change an account or portfolio the caller does not own, without a request', () => {
      const errors: unknown[] = [];
      const record = { error: (error: unknown) => errors.push(error) };

      store.createPortfolio({ accountId: 999, name: 'X', description: null }).subscribe(record);
      store.updatePortfolio(99, { name: 'X', description: null }).subscribe(record);
      store.deposit(999, 10).subscribe(record);
      store.withdraw(999, 10).subscribe(record);

      expect(errors).toHaveLength(4);
      expect(errors.every((error) => error instanceof NotOwnedError)).toBe(true);
      http.expectNone(() => true);
    });
  });

  describe('selection', () => {
    beforeEach(() => load());

    it('switches account, resets the portfolio choice and loads that account’s transactions', () => {
      store.selectPortfolio(11);

      expect(store.selectAccount(2)).toBe(true);
      http.expectOne((request) => request.url === cashUrl(2)).flush([cash(3, 2, 'WITHDRAWAL')]);

      expect(store.selectedAccount()?.name).toBe('Retirement');
      expect(store.selectedPortfolio()?.name).toBe('Income');
      expect(store.cashTransactions()[0].reason).toBe('WITHDRAWAL');
    });

    it('does not reload transactions when the selected account is chosen again', () => {
      expect(store.selectAccount(1)).toBe(true);
      http.expectNone((request) => request.url === cashUrl(1));
    });

    it('selects the owning account when a portfolio in another account is chosen', () => {
      expect(store.selectPortfolio(21)).toBe(true);
      http.expectOne((request) => request.url === cashUrl(2)).flush([]);

      expect(store.selectedAccountId()).toBe(2);
      expect(store.selectedPortfolio()?.portfolioId).toBe(21);
    });

    it('looks accounts up by id', () => {
      expect(store.accountById(2)?.name).toBe('Retirement');
      expect(store.accountById(999)).toBeNull();
    });
  });

  it('loads the transactions of a first account, which is already selected by default', () => {
    load([], []);
    const created = { ...ACCOUNTS[0], accountId: 3 };

    store.createAccount({ name: 'Brokerage', currency: 'USD', initialDeposit: 10 }).subscribe();
    http.expectOne({ method: 'POST', url: '/api/me/accounts' }).flush(created);
    http.expectOne({ method: 'GET', url: '/api/me/accounts' }).flush([created]);
    http.expectOne((request) => request.url === cashUrl(3)).flush([cash(4, 3, 'DEPOSIT')]);

    expect(store.selectedAccountId()).toBe(3);
    expect(store.cashTransactions().map((transaction) => transaction.cashTransactionId)).toEqual([
      4,
    ]);
  });

  describe('changes', () => {
    beforeEach(() => load());

    it('creates an account, reloads the list and selects the new account', () => {
      const created: Account = {
        accountId: 3,
        name: 'Savings',
        currency: 'USD',
        cashBalance: 250,
        openedDate: '2026-09-21',
      };
      let result: Account | undefined;

      store
        .createAccount({ name: 'Savings', currency: 'USD', initialDeposit: 250 })
        .subscribe((account) => (result = account));

      const post = http.expectOne('/api/me/accounts');
      expect(post.request.method).toBe('POST');
      expect(post.request.body).toEqual({ name: 'Savings', currency: 'USD', initialDeposit: 250 });
      post.flush(created);
      http.expectOne({ method: 'GET', url: '/api/me/accounts' }).flush([...ACCOUNTS, created]);
      http.expectOne((request) => request.url === cashUrl(3)).flush([]);

      expect(result).toEqual(created);
      expect(store.accounts()).toHaveLength(3);
      expect(store.selectedAccount()?.name).toBe('Savings');
    });

    it('reports a created account as created even if the reload fails', () => {
      let result: Account | undefined;
      store
        .createAccount({ name: 'Savings', currency: 'USD' })
        .subscribe((account) => (result = account));

      http
        .expectOne({ method: 'POST', url: '/api/me/accounts' })
        .flush({ ...ACCOUNTS[0], accountId: 3 });
      http
        .expectOne({ method: 'GET', url: '/api/me/accounts' })
        .flush(null, { status: 500, statusText: 'Error' });

      expect(result?.accountId).toBe(3);
    });

    it('creates a portfolio, reloads portfolios and selects it', () => {
      const created: Portfolio = {
        portfolioId: 22,
        accountId: 2,
        name: 'Speculative',
        description: null,
        createdAt: '2026-09-21T00:00:00Z',
      };
      store.createPortfolio({ accountId: 2, name: 'Speculative', description: null }).subscribe();

      const post = http.expectOne({ method: 'POST', url: '/api/me/portfolios' });
      expect(post.request.body).toEqual({ accountId: 2, name: 'Speculative', description: null });
      post.flush(created);
      http.expectOne({ method: 'GET', url: '/api/me/portfolios' }).flush([...PORTFOLIOS, created]);
      http.expectOne((request) => request.url === cashUrl(2)).flush([]);

      expect(store.selectedAccountId()).toBe(2);
      expect(store.selectedPortfolio()?.name).toBe('Speculative');
    });

    it('updates a portfolio and reloads portfolios', () => {
      const renamed = { ...PORTFOLIOS[0], name: 'Aggressive growth', description: 'Tech' };
      store.updatePortfolio(11, { name: 'Aggressive growth', description: 'Tech' }).subscribe();

      const put = http.expectOne('/api/me/portfolios/11');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ name: 'Aggressive growth', description: 'Tech' });
      put.flush(renamed);
      http.expectOne('/api/me/portfolios').flush([renamed, ...PORTFOLIOS.slice(1)]);

      expect(store.selectedPortfolio()?.name).toBe('Aggressive growth');
    });

    it('deposits, then reloads balances and the account’s transactions', () => {
      let done = false;
      store.deposit(1, 125.5).subscribe(() => (done = true));

      const post = http.expectOne({ method: 'POST', url: cashUrl(1) });
      expect(post.request.body).toEqual({ amount: 125.5, reason: 'DEPOSIT' });
      post.flush({});
      http
        .expectOne('/api/me/accounts')
        .flush([{ ...ACCOUNTS[0], cashBalance: 1_125.5 }, ACCOUNTS[1]]);
      http
        .expectOne((request) => request.method === 'GET' && request.url === cashUrl(1))
        .flush([cash(9, 1, 'DEPOSIT')]);

      expect(done).toBe(true);
      expect(store.selectedAccount()?.cashBalance).toBe(1_125.5);
      expect(store.cashTransactions().map((transaction) => transaction.cashTransactionId)).toEqual([
        9,
      ]);
    });

    it('withdraws from another account and switches to it', () => {
      store.withdraw(2, 50).subscribe();

      const post = http.expectOne({ method: 'POST', url: cashUrl(2) });
      expect(post.request.body).toEqual({ amount: 50, reason: 'WITHDRAWAL' });
      post.flush({});
      http.expectOne('/api/me/accounts').flush([ACCOUNTS[0], { ...ACCOUNTS[1], cashBalance: 450 }]);
      http
        .expectOne((request) => request.method === 'GET' && request.url === cashUrl(2))
        .flush([cash(10, 2, 'WITHDRAWAL')]);

      expect(store.selectedAccountId()).toBe(2);
      expect(store.selectedAccount()?.cashBalance).toBe(450);
      expect(store.cashTransactions().map((transaction) => transaction.cashTransactionId)).toEqual([
        10,
      ]);
    });

    it('passes a failed change through without reloading', () => {
      let failure: unknown;
      store.deposit(1, 10).subscribe({ error: (error) => (failure = error) });

      http
        .expectOne({ method: 'POST', url: cashUrl(1) })
        .flush({ error: 'Too much' }, { status: 400, statusText: 'Bad Request' });

      expect(failure).toBeTruthy();
      http.expectNone('/api/me/accounts');
    });
  });
});
