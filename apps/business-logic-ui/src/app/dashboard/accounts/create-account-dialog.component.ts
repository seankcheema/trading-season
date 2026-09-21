import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HlmButtonImports } from '@shared/ui-components/button';
import { HlmFieldImports } from '@shared/ui-components/field';
import { HlmInputImports } from '@shared/ui-components/input';
import { DashboardDialogComponent } from '../shared/dashboard-dialog.component';
import { toAccountErrorMessage } from './account-error';
import { AccountStore } from './account-store.service';
import { Account, MAX_CASH_AMOUNT } from './account.models';
import { toCents, wholeCentsValidator } from './money';

export const ACCOUNT_NAME_MAX_LENGTH = 60;

@Component({
  selector: 'app-create-account-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DashboardDialogComponent,
    HlmButtonImports,
    HlmFieldImports,
    HlmInputImports,
    ReactiveFormsModule,
  ],
  template: `
    <app-dashboard-dialog
      dialogTitle="New account"
      closeLabel="Close new account"
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
            formControlName="name"
          />
          @if (form.controls.name.invalid && form.controls.name.touched) {
            <p class="text-destructive text-sm">
              Enter an account name of up to {{ nameMaxLength }} characters.
            </p>
          }
        </div>

        <div hlmField>
          <label hlmFieldLabel for="initialDeposit" class="text-foreground">
            Opening deposit
          </label>
          <input
            hlmInput
            id="initialDeposit"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            placeholder="Optional"
            class="rounded-[5px]"
            formControlName="initialDeposit"
          />
          @if (form.controls.initialDeposit.invalid && form.controls.initialDeposit.touched) {
            <p class="text-destructive text-sm">
              Enter an amount from $0 to {{ maxAmount | currency: 'USD' : 'symbol' : '1.0-0' }}, in
              whole cents.
            </p>
          } @else {
            <p class="text-muted-foreground text-sm">
              Accounts hold US dollars. You can also deposit later.
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
            {{ saving() ? 'Creating…' : 'Create account' }}
          </button>
        </div>
      </form>
    </app-dashboard-dialog>
  `,
})
export class CreateAccountDialogComponent {
  private readonly _store = inject(AccountStore);

  readonly closed = output<void>();
  readonly created = output<Account>();

  protected readonly nameMaxLength = ACCOUNT_NAME_MAX_LENGTH;
  protected readonly maxAmount = MAX_CASH_AMOUNT;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(ACCOUNT_NAME_MAX_LENGTH),
        Validators.pattern(/\S/),
      ],
    }),
    initialDeposit: new FormControl<number | null>(null, [
      Validators.min(0),
      Validators.max(MAX_CASH_AMOUNT),
      wholeCentsValidator,
    ]),
  });

  protected onSubmit(): void {
    if (this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, initialDeposit } = this.form.getRawValue();
    this.saving.set(true);
    this.errorMessage.set('');
    this._store
      .createAccount({
        name: name.trim(),
        currency: 'USD',
        ...(initialDeposit ? { initialDeposit: toCents(initialDeposit) } : {}),
      })
      .subscribe({
        next: (account) => {
          this.saving.set(false);
          this.created.emit(account);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.errorMessage.set(toAccountErrorMessage(error, 'create-account'));
        },
      });
  }
}
