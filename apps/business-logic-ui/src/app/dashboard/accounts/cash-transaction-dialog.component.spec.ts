import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ACCOUNT_ERROR_MESSAGES } from './account-error';
import { AccountStore } from './account-store.service';
import { Account } from './account.models';
import {
  CashTransactionDialogComponent,
  CashTransactionMode,
} from './cash-transaction-dialog.component';

const ACCOUNTS: Account[] = [
  {
    accountId: 1,
    name: 'Brokerage',
    currency: 'USD',
    cashBalance: 1_000,
    openedDate: '2026-01-02',
  },
  { accountId: 2, name: 'Retirement', currency: 'USD', cashBalance: 50, openedDate: '2026-02-03' },
];

describe('CashTransactionDialogComponent', () => {
  let response: Subject<void>;
  let store: {
    accounts: ReturnType<typeof signal<Account[]>>;
    selectedAccountId: ReturnType<typeof signal<number | null>>;
    isOwnedAccount: (id: number | null) => boolean;
    accountById: (id: number) => Account | null;
    deposit: ReturnType<typeof vi.fn>;
    withdraw: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    response = new Subject<void>();
    store = {
      accounts: signal(ACCOUNTS),
      selectedAccountId: signal<number | null>(1),
      isOwnedAccount: (id) => ACCOUNTS.some((account) => account.accountId === id),
      accountById: (id) => ACCOUNTS.find((account) => account.accountId === id) ?? null,
      deposit: vi.fn(() => response),
      withdraw: vi.fn(() => response),
    };
    await TestBed.configureTestingModule({
      imports: [CashTransactionDialogComponent],
      providers: [{ provide: AccountStore, useValue: store }],
    }).compileComponents();
  });

  function render(mode: CashTransactionMode, accountId: number | null = null) {
    const fixture = TestBed.createComponent(CashTransactionDialogComponent);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('accountId', accountId);
    const completed = vi.fn();
    const closed = vi.fn();
    fixture.componentInstance.completed.subscribe(completed);
    fixture.componentInstance.closed.subscribe(closed);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const account = element.querySelector('#cashAccount') as HTMLSelectElement;
    const amount = element.querySelector('#cashAmount') as HTMLInputElement;
    const submit = element.querySelector('button[type="submit"]') as HTMLButtonElement;
    const enter = (value: string) => {
      amount.value = value;
      amount.dispatchEvent(new Event('input'));
      amount.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
    };
    const choose = (accountId: number) => {
      account.value = String(accountId);
      account.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const send = () => {
      submit.click();
      fixture.detectChanges();
    };
    const available = () =>
      element.querySelector('[data-testid="cash-available"]')?.textContent?.trim();
    return { fixture, element, account, submit, completed, closed, enter, choose, send, available };
  }

  describe('deposits', () => {
    it('is titled for a deposit and preselects the dashboard’s account', () => {
      const { element, account, submit, available } = render('deposit');

      expect(element.querySelector('[role="dialog"]')?.textContent).toContain('Deposit funds');
      expect(element.querySelector('label[for="cashAccount"]')?.textContent?.trim()).toBe(
        'To account',
      );
      expect([...account.options].map((option) => option.textContent?.trim())).toEqual([
        'Brokerage',
        'Retirement',
      ]);
      expect(account.value).toBe('1');
      expect(available()).toBe('Available cash: $1,000.00');
      expect(submit.textContent?.trim()).toBe('Deposit');
    });

    it('deposits into the chosen account, rounded to cents', () => {
      const { enter, choose, send, submit, completed } = render('deposit');
      choose(2);
      enter('20.1');

      send();

      expect(store.deposit).toHaveBeenCalledWith(2, 20.1);
      expect(submit.textContent?.trim()).toBe('Processing…');
      response.next();
      expect(completed).toHaveBeenCalled();
    });

    it('allows a deposit larger than the current balance', () => {
      const { enter, send } = render('deposit', 2);
      enter('5000');

      send();

      expect(store.deposit).toHaveBeenCalledWith(2, 5000);
    });

    it.each([
      ['', 'Enter an amount greater than $0.'],
      ['0', 'Enter an amount greater than $0.'],
      ['1.234', 'Enter the amount in whole cents.'],
      ['1000001', 'The most you can move at once is $1,000,000.'],
    ])('rejects an amount of "%s"', (value, message) => {
      const { element, enter, send } = render('deposit');
      enter(value);

      send();

      expect(store.deposit).not.toHaveBeenCalled();
      expect(element.textContent).toContain(message);
    });

    it('does not preselect an account the user does not own', () => {
      const { fixture } = render('deposit', 999);

      expect(fixture.componentInstance['form'].controls.accountId.value).toBe('1');
      store.selectedAccountId.set(999);
      const second = render('deposit', 999);
      expect(second.fixture.componentInstance['form'].controls.accountId.value).toBe('');
    });
  });

  describe('withdrawals', () => {
    it('is titled for a withdrawal', () => {
      const { element, submit } = render('withdraw');

      expect(element.querySelector('[role="dialog"]')?.textContent).toContain('Withdraw funds');
      expect(element.querySelector('label[for="cashAccount"]')?.textContent?.trim()).toBe(
        'From account',
      );
      expect(submit.textContent?.trim()).toBe('Withdraw');
    });

    it('limits a withdrawal to the chosen account’s cash', () => {
      const { element, enter, choose, send, available } = render('withdraw');
      enter('100');
      choose(2);

      expect(available()).toBe('Available cash: $50.00');
      send();
      expect(store.withdraw).not.toHaveBeenCalled();
      expect(element.textContent).toContain("That's more than the account's available cash.");

      choose(1);
      send();
      expect(store.withdraw).toHaveBeenCalledWith(1, 100);
    });

    it('shows why the withdrawal failed', () => {
      const { fixture, element, enter, send, submit } = render('withdraw');
      enter('10');
      send();
      send();
      expect(store.withdraw).toHaveBeenCalledTimes(1);

      response.error(new HttpErrorResponse({ status: 422 }));
      fixture.detectChanges();

      expect(element.querySelector('[role="alert"]')?.textContent).toBe(
        ACCOUNT_ERROR_MESSAGES.insufficientFunds,
      );
      expect(submit.disabled).toBe(false);
    });
  });

  it('closes from Cancel, the close button and Escape', () => {
    const { element, closed } = render('deposit');

    (
      Array.from(element.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Cancel',
      ) as HTMLButtonElement
    ).click();
    (element.querySelector('[aria-label="Close deposit"]') as HTMLButtonElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closed).toHaveBeenCalledTimes(3);
  });

  it('closes when the backdrop is clicked, but not the dialog itself', () => {
    const { element, closed } = render('deposit');

    (element.querySelector('[role="dialog"]') as HTMLElement).click();
    expect(closed).not.toHaveBeenCalled();

    (element.querySelector('.dashboard-dialog-backdrop') as HTMLElement).click();
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
