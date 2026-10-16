import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { AccountDialogComponent } from './account-dialog.component';
import { ACCOUNT_ERROR_MESSAGES } from './account-error';
import { AccountStore } from './account-store.service';
import { Account } from './account.models';

const BROKERAGE: Account = { accountId: 1, name: 'Brokerage', openedDate: '2026-01-02' };

describe('AccountDialogComponent', () => {
  let response: Subject<Account>;
  let createAccount: ReturnType<typeof vi.fn>;
  let renameAccount: ReturnType<typeof vi.fn>;
  let deleteAccount: ReturnType<typeof vi.fn>;
  let deleted: Subject<void>;
  let eligibility: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    response = new Subject<Account>();
    createAccount = vi.fn(() => response);
    renameAccount = vi.fn(() => response);
    deleted = new Subject<void>();
    deleteAccount = vi.fn(() => deleted);
    eligibility = vi.fn(() => of({ archiveBlockers: [], deleteBlockers: [] }));
    await TestBed.configureTestingModule({
      imports: [AccountDialogComponent],
      providers: [
        {
          provide: AccountStore,
          useValue: { createAccount, renameAccount, eligibility, deleteAccount },
        },
      ],
    }).compileComponents();
  });

  function render(account: Account | null = null) {
    const fixture = TestBed.createComponent(AccountDialogComponent);
    fixture.componentRef.setInput('account', account);
    const closed = vi.fn();
    const saved = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.componentInstance.saved.subscribe(saved);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const name = element.querySelector('#accountName') as HTMLInputElement;
    const submit = element.querySelector('button[type="submit"]') as HTMLButtonElement;
    const type = (value: string) => {
      name.value = value;
      name.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const send = () => {
      submit.click();
      fixture.detectChanges();
    };
    return { fixture, element, name, submit, closed, saved, type, send };
  }

  describe('creating', () => {
    it('asks only for a name, since a new account starts empty', () => {
      const { element, submit } = render();

      expect(element.querySelector('[role="dialog"]')?.textContent).toContain('New account');
      expect(element.querySelectorAll('input')).toHaveLength(1);
      expect(element.querySelector('label[for="accountName"]')?.textContent?.trim()).toBe(
        'Account name',
      );
      expect(element.textContent).toContain('starts with no holdings');
      expect(submit.textContent?.trim()).toBe('Create account');
    });

    it('requires a name before sending anything', () => {
      const { element, type, send } = render();

      type('   ');
      send();

      expect(createAccount).not.toHaveBeenCalled();
      expect(element.textContent).toContain('Enter an account name');
    });

    it('creates the account with a trimmed name', () => {
      const { submit, type, send, saved } = render();
      type('  Savings  ');

      send();
      send();

      expect(createAccount).toHaveBeenCalledTimes(1);
      expect(createAccount).toHaveBeenCalledWith({ name: 'Savings' });
      expect(submit.disabled).toBe(true);
      expect(submit.textContent?.trim()).toBe('Creating…');

      response.next({ ...BROKERAGE, accountId: 3, name: 'Savings' });
      expect(saved).toHaveBeenCalled();
    });

    it('shows why the account could not be created and allows another try', () => {
      const { fixture, element, submit, type, send } = render();
      type('Savings');
      send();

      response.error(new HttpErrorResponse({ status: 409 }));
      fixture.detectChanges();

      expect(element.querySelector('[role="alert"]')?.textContent).toBe(
        ACCOUNT_ERROR_MESSAGES.duplicateAccount,
      );
      expect(submit.disabled).toBe(false);
    });
  });

  describe('renaming', () => {
    it('prefills the current name', () => {
      const { element, name, submit } = render(BROKERAGE);

      expect(element.querySelector('[role="dialog"]')?.textContent).toContain('Rename account');
      expect(name.value).toBe('Brokerage');
      expect(element.textContent).not.toContain('starts with no holdings');
      expect(submit.textContent?.trim()).toBe('Save');
    });

    it('saves the new name', () => {
      const { fixture, submit, type, send, saved } = render(BROKERAGE);
      type('Taxable');

      send();
      fixture.detectChanges();

      expect(renameAccount).toHaveBeenCalledWith(1, { name: 'Taxable' });
      expect(createAccount).not.toHaveBeenCalled();
      expect(submit.textContent?.trim()).toBe('Saving…');
      response.next({ ...BROKERAGE, name: 'Taxable' });
      expect(saved).toHaveBeenCalled();
    });

    it('reports a rename failure in terms of renaming', () => {
      const { fixture, element, send } = render(BROKERAGE);
      send();

      response.error(new Error('boom'));
      fixture.detectChanges();

      expect(element.querySelector('[role="alert"]')?.textContent).toBe(
        ACCOUNT_ERROR_MESSAGES.failed['rename-account'],
      );
    });
  });

  describe('deleting from the active view', () => {
    function click(element: HTMLElement, label: string) {
      const button = Array.from(element.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === label,
      )!;
      button.click();
    }
    it('confirms archival, retains history, and prevents duplicate submissions', () => {
      const { fixture, element, closed } = render(BROKERAGE);
      click(element, 'Delete account');
      fixture.detectChanges();
      expect(deleteAccount).not.toHaveBeenCalled();
      expect(element.textContent).toContain('All account, transaction and order records stay');
      expect(element.querySelector('.text-muted-foreground.text-sm')?.textContent).toContain(
        'The account will be archived and become read-only',
      );
      expect(element.textContent).not.toContain('permanently');
      click(element, 'Delete account');
      fixture.detectChanges();
      expect(deleteAccount).toHaveBeenCalledExactlyOnceWith(1);
      expect(element.querySelector('[aria-label="Close rename account"]')).toBeNull();
      deleted.next();
      expect(closed).toHaveBeenCalledOnce();
    });
    it('allows returning without deleting', () => {
      const { fixture, element } = render(BROKERAGE);
      click(element, 'Delete account');
      fixture.detectChanges();
      click(element, 'Back');
      fixture.detectChanges();
      expect(element.querySelector('#accountName')).not.toBeNull();
      expect(deleteAccount).not.toHaveBeenCalled();
    });
    it('disables Delete and explains current assets', () => {
      eligibility.mockReturnValue(
        of({
          archiveBlockers: ['Account contains active holdings'],
          deleteBlockers: ['Account contains active holdings'],
        }),
      );
      const { element } = render(BROKERAGE);
      const button = Array.from(element.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Delete account',
      )!;
      expect(button.disabled).toBe(true);
      expect(element.textContent).toContain('Account contains active holdings');
    });
    it('keeps the confirmation and reports a fresh backend refusal', () => {
      const { fixture, element } = render(BROKERAGE);
      click(element, 'Delete account');
      fixture.detectChanges();
      click(element, 'Delete account');
      deleted.error(
        new HttpErrorResponse({
          status: 409,
          error: { error: 'Pending orders must be resolved.' },
        }),
      );
      fixture.detectChanges();
      expect(element.querySelector('[role="alert"]')?.textContent).toContain(
        'Pending orders must be resolved.',
      );
    });
    it('shows a retry explanation if eligibility cannot load', () => {
      const result = new Subject<unknown>();
      eligibility.mockReturnValue(result);
      const { fixture, element } = render(BROKERAGE);
      result.error(new Error('offline'));
      fixture.detectChanges();
      expect(element.textContent).toContain('Unable to check requirements');
    });
    it('uses a safe fallback for an unknown deletion error', () => {
      const { fixture, element } = render(BROKERAGE);
      click(element, 'Delete account');
      fixture.detectChanges();
      click(element, 'Delete account');
      deleted.error(new Error('offline'));
      fixture.detectChanges();
      expect(element.querySelector('[role="alert"]')?.textContent).toContain(
        'Unable to update account',
      );
    });
  });

  it('does nothing when closure is confirmed without an account or a chosen action', () => {
    const { fixture } = render(BROKERAGE);

    fixture.componentInstance['confirmClosure']();

    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('closes from Cancel and from the close button', () => {
    const { element, closed } = render();

    (
      Array.from(element.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Cancel',
      ) as HTMLButtonElement
    ).click();
    (element.querySelector('[aria-label="Close new account"]') as HTMLButtonElement).click();

    expect(closed).toHaveBeenCalledTimes(2);
  });
});
