import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HlmButtonImports } from '@shared/ui-components/button';
import { HlmFieldImports } from '@shared/ui-components/field';
import { HlmInputImports } from '@shared/ui-components/input';
import { DashboardDialogComponent } from '../shared/dashboard-dialog.component';
import { toAccountErrorMessage } from './account-error';
import { AccountStore } from './account-store.service';
import { Account } from './account.models';

export const ACCOUNT_NAME_MAX_LENGTH = 60;

// Creates an account, or renames one when `account` is set. A new account starts empty: it
// has no holdings, and cash is shared across accounts, so there is nothing else to enter.
@Component({
  selector: 'app-account-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DashboardDialogComponent,
    HlmButtonImports,
    HlmFieldImports,
    HlmInputImports,
    ReactiveFormsModule,
  ],
  template: `
    <app-dashboard-dialog
      [dialogTitle]="editing() ? 'Rename account' : 'New account'"
      [closeLabel]="editing() ? 'Close rename account' : 'Close new account'"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate class="flex flex-col gap-4">
        <div hlmField>
          <label hlmFieldLabel for="accountName" class="text-foreground">Account name</label>
          <input
            hlmInput
            id="accountName"
            type="text"
            autocomplete="off"
            placeholder="e.g. Retirement"
            class="rounded-[5px]"
            [attr.maxlength]="nameMaxLength"
            [formControl]="name"
          />
          @if (name.invalid && name.touched) {
            <p class="text-destructive text-sm">
              Enter an account name of up to {{ nameMaxLength }} characters.
            </p>
          } @else if (!editing()) {
            <p class="text-muted-foreground text-sm">
              The account starts with no holdings. It trades with the cash shared by all of your
              accounts.
            </p>
          }
        </div>

        @if (errorMessage()) {
          <p role="alert" class="text-destructive text-sm">{{ errorMessage() }}</p>
        }

        <div class="flex justify-end gap-2">
          <button
            hlmBtn
            variant="outline"
            type="button"
            class="cursor-pointer rounded-[5px]"
            (click)="closed.emit()"
          >
            Cancel
          </button>
          <button
            hlmBtn
            type="submit"
            class="cursor-pointer rounded-[5px] disabled:cursor-not-allowed disabled:opacity-70"
            [disabled]="saving()"
          >
            {{ submitLabel() }}
          </button>
        </div>
      </form>
    </app-dashboard-dialog>
  `,
})
export class AccountDialogComponent implements OnInit {
  private readonly _store = inject(AccountStore);

  // The account to rename; null creates a new one.
  readonly account = input<Account | null>(null);

  readonly closed = output<void>();
  readonly saved = output<Account>();

  protected readonly editing = computed(() => this.account() !== null);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly submitLabel = computed(() => {
    if (this.editing()) {
      return this.saving() ? 'Saving…' : 'Save';
    }
    return this.saving() ? 'Creating…' : 'Create account';
  });
  protected readonly nameMaxLength = ACCOUNT_NAME_MAX_LENGTH;

  protected readonly name = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.maxLength(ACCOUNT_NAME_MAX_LENGTH),
      Validators.pattern(/\S/),
    ],
  });
  protected readonly form = new FormGroup({ name: this.name });

  ngOnInit(): void {
    this.name.setValue(this.account()?.name ?? '');
  }

  protected onSubmit(): void {
    if (this.saving()) {
      return;
    }
    if (this.name.invalid) {
      this.name.markAsTouched();
      return;
    }
    const details = { name: this.name.value.trim() };
    const account = this.account();
    const request = account
      ? this._store.renameAccount(account.accountId, details)
      : this._store.createAccount(details);

    this.saving.set(true);
    this.errorMessage.set('');
    request.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.saved.emit(saved);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(
          toAccountErrorMessage(error, account ? 'rename-account' : 'create-account'),
        );
      },
    });
  }
}
