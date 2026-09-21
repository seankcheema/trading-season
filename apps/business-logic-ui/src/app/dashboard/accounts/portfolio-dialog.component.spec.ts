import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ACCOUNT_ERROR_MESSAGES } from './account-error';
import { AccountStore } from './account-store.service';
import { Account, Portfolio } from './account.models';
import { PortfolioDialogComponent } from './portfolio-dialog.component';

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

const GROWTH: Portfolio = {
  portfolioId: 11,
  accountId: 2,
  name: 'Growth',
  description: 'Tech',
  createdAt: '2026-01-03T00:00:00Z',
};

describe('PortfolioDialogComponent', () => {
  let response: Subject<Portfolio>;
  let store: {
    accounts: ReturnType<typeof signal<Account[]>>;
    selectedAccountId: ReturnType<typeof signal<number | null>>;
    isOwnedAccount: (id: number | null) => boolean;
    createPortfolio: ReturnType<typeof vi.fn>;
    updatePortfolio: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    response = new Subject<Portfolio>();
    store = {
      accounts: signal(ACCOUNTS),
      selectedAccountId: signal<number | null>(1),
      isOwnedAccount: (id) => ACCOUNTS.some((account) => account.accountId === id),
      createPortfolio: vi.fn(() => response),
      updatePortfolio: vi.fn(() => response),
    };
    await TestBed.configureTestingModule({
      imports: [PortfolioDialogComponent],
      providers: [{ provide: AccountStore, useValue: store }],
    }).compileComponents();
  });

  function render(inputs: { portfolio?: Portfolio | null; accountId?: number | null } = {}) {
    const fixture = TestBed.createComponent(PortfolioDialogComponent);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    const saved = vi.fn();
    const closed = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    fixture.componentInstance.closed.subscribe(closed);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const account = element.querySelector('#portfolioAccount') as HTMLSelectElement;
    const name = element.querySelector('#portfolioName') as HTMLInputElement;
    const description = element.querySelector('#portfolioDescription') as HTMLTextAreaElement;
    const submit = element.querySelector('button[type="submit"]') as HTMLButtonElement;
    const type = (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
      field.value = value;
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const send = () => {
      submit.click();
      fixture.detectChanges();
    };
    return { fixture, element, account, name, description, submit, saved, closed, type, send };
  }

  describe('creating', () => {
    it('offers only the user’s accounts and preselects the dashboard’s account', () => {
      const { element, account, submit } = render();

      expect(element.querySelector('[role="dialog"]')?.textContent).toContain('New portfolio');
      expect([...account.options].map((option) => option.textContent?.trim())).toEqual([
        'Brokerage',
        'Retirement',
      ]);
      expect(account.value).toBe('1');
      expect(account.disabled).toBe(false);
      expect(submit.textContent?.trim()).toBe('Create portfolio');
    });

    it('preselects the account it was opened for', () => {
      const { account } = render({ accountId: 2 });

      expect(account.value).toBe('2');
    });

    it('does not preselect an account the user does not own', () => {
      store.selectedAccountId.set(999);
      const { fixture } = render();

      expect(fixture.componentInstance['form'].controls.accountId.value).toBe('');
    });

    it('requires a name', () => {
      const { element, send } = render();

      send();

      expect(store.createPortfolio).not.toHaveBeenCalled();
      expect(element.textContent).toContain('Enter a portfolio name');
    });

    it('creates the portfolio in the chosen account', () => {
      const { account, name, description, type, send, saved } = render();
      account.value = '2';
      account.dispatchEvent(new Event('change'));
      type(name, ' Speculative ');
      type(description, '  ');

      send();

      expect(store.createPortfolio).toHaveBeenCalledWith({
        accountId: 2,
        name: 'Speculative',
        description: null,
      });
      response.next({ ...GROWTH, portfolioId: 12, name: 'Speculative' });
      expect(saved).toHaveBeenCalled();
    });

    it('shows why the portfolio could not be saved', () => {
      const { fixture, element, name, type, send, submit } = render();
      type(name, 'Growth');
      send();
      expect(submit.textContent?.trim()).toBe('Saving…');

      response.error(new HttpErrorResponse({ status: 409 }));
      fixture.detectChanges();

      expect(element.querySelector('[role="alert"]')?.textContent).toBe(
        ACCOUNT_ERROR_MESSAGES.duplicatePortfolio,
      );
      expect(submit.textContent?.trim()).toBe('Create portfolio');
    });
  });

  describe('editing', () => {
    it('prefills the portfolio and locks its account', () => {
      const { element, account, name, description, submit } = render({ portfolio: GROWTH });

      expect(element.querySelector('[role="dialog"]')?.textContent).toContain('Edit portfolio');
      expect(account.value).toBe('2');
      expect(account.disabled).toBe(true);
      expect(name.value).toBe('Growth');
      expect(description.value).toBe('Tech');
      expect(submit.textContent?.trim()).toBe('Save changes');
    });

    it('saves the new name and description', () => {
      const { name, description, type, send, saved } = render({ portfolio: GROWTH });
      type(name, 'Aggressive growth');
      type(description, 'Small caps');

      send();
      send();

      expect(store.updatePortfolio).toHaveBeenCalledTimes(1);
      expect(store.updatePortfolio).toHaveBeenCalledWith(11, {
        name: 'Aggressive growth',
        description: 'Small caps',
      });
      expect(store.createPortfolio).not.toHaveBeenCalled();
      response.next({ ...GROWTH, name: 'Aggressive growth' });
      expect(saved).toHaveBeenCalled();
    });

    it('treats a missing description as empty', () => {
      const { description } = render({ portfolio: { ...GROWTH, description: null } });

      expect(description.value).toBe('');
    });
  });

  it('closes from Cancel', () => {
    const { element, closed } = render();

    (
      Array.from(element.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Cancel',
      ) as HTMLButtonElement
    ).click();

    expect(closed).toHaveBeenCalled();
  });
});
