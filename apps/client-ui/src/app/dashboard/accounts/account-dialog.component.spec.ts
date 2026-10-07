import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { AccountDialogComponent } from './account-dialog.component';
import { ACCOUNT_ERROR_MESSAGES } from './account-error';
import { AccountStore } from './account-store.service';
import { Account } from './account.models';

const BROKERAGE: Account = { accountId: 1, name: 'Brokerage', openedDate: '2026-01-02' };

describe('AccountDialogComponent', () => {
  let response: Subject<Account>;
  let createAccount: ReturnType<typeof vi.fn>;
  let renameAccount: ReturnType<typeof vi.fn>;
  let deletion: Subject<void>;
  let deleteAccount: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    response = new Subject<Account>();
    createAccount = vi.fn(() => response);
    renameAccount = vi.fn(() => response);
    deletion = new Subject<void>();
    deleteAccount = vi.fn(() => deletion);
    await TestBed.configureTestingModule({
      imports: [AccountDialogComponent],
      providers: [
        { provide: AccountStore, useValue: { createAccount, renameAccount, deleteAccount } },
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

  describe('account settings deletion', () => {
    function click(element: HTMLElement, label: string): void {
      const button = Array.from(element.querySelectorAll('button')).find(
        (candidate) => candidate.textContent?.trim() === label,
      );
      expect(button).toBeDefined();
      button!.click();
    }

    it('keeps deletion inside settings and requires confirmation', () => {
      const { fixture, element, closed } = render(BROKERAGE);
      click(element, 'Delete account');
      fixture.detectChanges();
      expect(element.textContent).toContain('All positions must be closed before deletion.');
      expect(deleteAccount).not.toHaveBeenCalled();
      click(element, 'Cancel');
      fixture.detectChanges();
      expect(element.querySelector('#accountName')).not.toBeNull();
      expect(closed).not.toHaveBeenCalled();
      click(element, 'Delete account');
      fixture.detectChanges();
      click(element, 'Delete account');
      fixture.detectChanges();
      expect(element.querySelector('.account-delete-spinner')).not.toBeNull();
      expect(element.querySelector('[role="status"]')?.textContent).toContain('Deleting account…');
      expect(element.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(element.textContent).not.toContain('Account deleted successfully.');
      (element.querySelector('[aria-label="Close account settings"]') as HTMLButtonElement).click();
      expect(closed).not.toHaveBeenCalled();
      expect(deleteAccount).toHaveBeenCalledTimes(1);
      expect(deleteAccount).toHaveBeenCalledWith(1);
      deletion.next();
      fixture.detectChanges();
      expect(element.querySelector('.account-delete-spinner')).toBeNull();
      expect(element.querySelector('[role="status"]')?.textContent).toBe(
        'Account deleted successfully.',
      );
      expect(closed).not.toHaveBeenCalled();
      expect(element.querySelector('#accountName')).toBeNull();
      expect(element.textContent).not.toContain('Delete account');
      click(element, 'Done');
      expect(closed).toHaveBeenCalledTimes(1);
    });

    it('shows the open-position refusal and keeps the dialog open', () => {
      const { fixture, element, closed } = render(BROKERAGE);
      click(element, 'Delete account');
      fixture.detectChanges();
      click(element, 'Delete account');
      deletion.error(new HttpErrorResponse({ status: 422 }));
      fixture.detectChanges();
      expect(element.querySelector('[role="alert"]')?.textContent).toContain('Close all positions');
      expect(closed).not.toHaveBeenCalled();
    });

    it('offers no deletion while creating an account', () => {
      const { element } = render();
      expect(element.textContent).not.toContain('Delete account');
    });
  });

  describe('renaming', () => {
    it('prefills the current name', () => {
      const { element, name, submit } = render(BROKERAGE);

      expect(element.querySelector('[role="dialog"]')?.textContent).toContain('Account settings');
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
