import { CurrencyPipe } from '@angular/common';
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
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { HlmButtonImports } from '@shared/ui-components/button';
import { HlmFieldImports } from '@shared/ui-components/field';
import { HlmInputImports } from '@shared/ui-components/input';
import { HlmNativeSelectImports } from '@shared/ui-components/native-select';
import { DashboardDialogComponent } from '../shared/dashboard-dialog.component';
import { toAccountErrorMessage } from './account-error';
import { AccountStore } from './account-store.service';
import { MAX_CASH_AMOUNT } from './account.models';
import { toCents, wholeCentsValidator } from './money';

export type CashTransactionMode = 'deposit' | 'withdraw';

@Component({
  selector: 'app-cash-transaction-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DashboardDialogComponent,
    HlmButtonImports,
    HlmFieldImports,
    HlmInputImports,
    HlmNativeSelectImports,
    ReactiveFormsModule,
  ],
  template: `
    <app-dashboard-dialog
      [dialogTitle]="isDeposit() ? 'Deposit funds' : 'Withdraw funds'"
      [closeLabel]="isDeposit() ? 'Close deposit' : 'Close withdrawal'"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate class="flex flex-col gap-4">
        <div hlmField>
          <label hlmFieldLabel for="cashAccount" class="text-foreground">
            {{ isDeposit() ? 'To account' : 'From account' }}
          </label>
          <hlm-native-select
            class="w-full"
            [selectId]="'cashAccount'"
            [selectClass]="'cursor-pointer rounded-[5px]'"
            formControlName="accountId"
          >
            @for (account of accounts(); track account.accountId) {
              <option [value]="account.accountId" hlmNativeSelectOption>{{ account.name }}</option>
            }
          </hlm-native-select>
          @if (selectedAccount(); as account) {
            <p class="text-muted-foreground text-sm tabular-nums" data-testid="cash-available">
              Available cash: {{ account.cashBalance | currency: 'USD' }}
            </p>
          }
        </div>

        <div hlmField>
          <label hlmFieldLabel for="cashAmount" class="text-foreground">Amount</label>
          <input
            hlmInput
            id="cashAmount"
            type="number"
            inputmode="decimal"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            class="rounded-[5px]"
            formControlName="amount"
          />
          @if (form.controls.amount.touched && amountError(); as message) {
            <p class="text-destructive text-sm">{{ message }}</p>
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
export class CashTransactionDialogComponent implements OnInit {
  private readonly _store = inject(AccountStore);

  readonly mode = input.required<CashTransactionMode>();
  // Account preselected when the dialog opens.
  readonly accountId = input<number | null>(null);

  readonly closed = output<void>();
  readonly completed = output<void>();

  protected readonly accounts = this._store.accounts;
  protected readonly isDeposit = computed(() => this.mode() === 'deposit');
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly submitLabel = computed(() => {
    if (this.saving()) {
      return 'Processing…';
    }
    return this.isDeposit() ? 'Deposit' : 'Withdraw';
  });

  // Native select values are strings; account ids are numbers everywhere else.
  protected readonly form = new FormGroup({
    accountId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    amount: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      Validators.max(MAX_CASH_AMOUNT),
      wholeCentsValidator,
      (control) => this.withinAvailableCash(control),
    ]),
  });

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly selectedAccount = computed(() =>
    this._store.accountById(Number(this.formValue().accountId)),
  );

  protected amountError(): string {
    const errors = this.form.controls.amount.errors;
    if (!errors) {
      return '';
    }
    if (errors['insufficientFunds']) {
      return "That's more than the account's available cash.";
    }
    if (errors['wholeCents']) {
      return 'Enter the amount in whole cents.';
    }
    if (errors['max']) {
      return 'The most you can move at once is $1,000,000.';
    }
    return 'Enter an amount greater than $0.';
  }

  constructor() {
    // The withdrawal limit depends on the chosen account.
    this.form.controls.accountId.valueChanges.subscribe(() =>
      this.form.controls.amount.updateValueAndValidity(),
    );
  }

  ngOnInit(): void {
    // Never preselect an account the caller doesn't own.
    const preselected = [this.accountId(), this._store.selectedAccountId()].find((id) =>
      this._store.isOwnedAccount(id),
    );
    if (preselected != null) {
      this.form.controls.accountId.setValue(String(preselected));
    }
  }

  protected onSubmit(): void {
    if (this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const accountId = Number(this.form.controls.accountId.value);
    const amount = toCents(this.form.controls.amount.value ?? 0);
    const request = this.isDeposit()
      ? this._store.deposit(accountId, amount)
      : this._store.withdraw(accountId, amount);

    this.saving.set(true);
    this.errorMessage.set('');
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.completed.emit();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(toAccountErrorMessage(error, this.mode()));
      },
    });
  }

  private withinAvailableCash(control: AbstractControl<number | null>): ValidationErrors | null {
    // The validator runs while the form is still being built, before `mode` or `form` exist.
    if (!this.form || this.mode() !== 'withdraw' || control.value === null) {
      return null;
    }
    const account = this._store.accountById(Number(this.form.controls.accountId.value));
    return account && control.value > account.cashBalance ? { insufficientFunds: true } : null;
  }
}
