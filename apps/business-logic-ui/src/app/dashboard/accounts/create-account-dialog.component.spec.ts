import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ACCOUNT_ERROR_MESSAGES } from './account-error';
import { AccountStore } from './account-store.service';
import { Account } from './account.models';
import { CreateAccountDialogComponent } from './create-account-dialog.component';

const CREATED: Account = {
  accountId: 3,
  name: 'Savings',
  currency: 'USD',
  cashBalance: 250,
  openedDate: '2026-09-21',
};

describe('CreateAccountDialogComponent', () => {
  let response: Subject<Account>;
  let createAccount: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    response = new Subject<Account>();
    createAccount = vi.fn(() => response);
    await TestBed.configureTestingModule({
      imports: [CreateAccountDialogComponent],
      providers: [{ provide: AccountStore, useValue: { createAccount } }],
    }).compileComponents();
  });

  function render() {
    const fixture = TestBed.createComponent(CreateAccountDialogComponent);
    const closed = vi.fn();
    const created = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.componentInstance.created.subscribe(created);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const name = element.querySelector('#accountName') as HTMLInputElement;
    const deposit = element.querySelector('#initialDeposit') as HTMLInputElement;
    const submit = element.querySelector('button[type="submit"]') as HTMLButtonElement;
    const type = (input: HTMLInputElement, value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const send = () => {
      submit.click();
      fixture.detectChanges();
    };
    return { fixture, element, name, deposit, submit, closed, created, type, send };
  }

  it('is a labelled dialog with labelled fields', () => {
    const { element } = render();

    expect(element.querySelector('[role="dialog"]')?.textContent).toContain('New account');
    expect(element.querySelector('label[for="accountName"]')?.textContent?.trim()).toBe(
      'Account name',
    );
    expect(element.querySelector('label[for="initialDeposit"]')?.textContent?.trim()).toBe(
      'Opening deposit',
    );
  });

  it('requires a name before sending anything', () => {
    const { element, type, name, send } = render();

    type(name, '   ');
    send();

    expect(createAccount).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Enter an account name');
  });

  it('rejects a negative or fractional-cent opening deposit', () => {
    const { element, type, name, deposit, send } = render();
    type(name, 'Savings');

    type(deposit, '-5');
    send();
    expect(createAccount).not.toHaveBeenCalled();
    expect(element.textContent).toContain('in whole cents');

    type(deposit, '10.005');
    send();
    expect(createAccount).not.toHaveBeenCalled();
  });

  it('creates a USD account with a trimmed name and the opening deposit', () => {
    const { submit, type, name, deposit, send, created } = render();
    type(name, '  Savings  ');
    type(deposit, '250');

    send();

    expect(createAccount).toHaveBeenCalledWith({
      name: 'Savings',
      currency: 'USD',
      initialDeposit: 250,
    });
    expect(submit.disabled).toBe(true);
    expect(submit.textContent?.trim()).toBe('Creating…');

    response.next(CREATED);
    expect(created).toHaveBeenCalledWith(CREATED);
  });

  it('leaves out an empty opening deposit', () => {
    const { type, name, send } = render();
    type(name, 'Savings');

    send();

    expect(createAccount).toHaveBeenCalledWith({ name: 'Savings', currency: 'USD' });
  });

  it('does not submit twice while a request is in flight', () => {
    const { type, name, send } = render();
    type(name, 'Savings');

    send();
    send();

    expect(createAccount).toHaveBeenCalledTimes(1);
  });

  it('shows why the account could not be created and allows another try', () => {
    const { fixture, element, submit, type, name, send } = render();
    type(name, 'Savings');
    send();

    response.error(new HttpErrorResponse({ status: 409 }));
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')?.textContent).toBe(
      ACCOUNT_ERROR_MESSAGES.duplicateAccount,
    );
    expect(submit.disabled).toBe(false);
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
