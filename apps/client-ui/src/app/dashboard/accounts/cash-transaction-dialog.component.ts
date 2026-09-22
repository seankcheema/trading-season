import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
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
import { DashboardDialogComponent } from '../shared/dashboard-dialog.component';
import { toAccountErrorMessage } from './account-error';
import { AccountStore } from './account-store.service';
import { MAX_CASH_AMOUNT } from './account.models';
import { toCents, wholeCentsValidator } from './money';

export type CashTransactionMode = 'deposit' | 'withdraw';

// Moves money into or out of the user's cash, which every account shares, so there is no
// account to choose.
@Component({
  selector: 'app-cash-transaction-dialog',
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
      [dialogTitle]="isDeposit() ? 'Deposit funds' : 'Withdraw funds'"
      [closeLabel]="isDeposit() ? 'Close deposit' : 'Close withdrawal'"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate class="flex flex-col gap-4">
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
            [formControl]="amount"
          />
          @if (amount.touched && amountError(); as message) {
            <p class="text-destructive text-sm">{{ message }}</p>
          } @else {
            <p class="text-muted-foreground text-sm tabular-nums" data-testid="cash-available">
              Available cash: {{ cashBalance() | currency: 'USD' }}
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
export class CashTransactionDialogComponent {
  private readonly _store = inject(AccountStore);

  readonly mode = input.required<CashTransactionMode>();

  readonly closed = output<void>();
  readonly completed = output<void>();

  protected readonly cashBalance = this._store.cashBalance;
  protected readonly isDeposit = computed(() => this.mode() === 'deposit');
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly submitLabel = computed(() => {
    if (this.saving()) {
      return 'Processing…';
    }
    return this.isDeposit() ? 'Deposit' : 'Withdraw';
  });

  protected readonly amount = new FormControl<number | null>(null, [
    Validators.required,
    Validators.min(0.01),
    Validators.max(MAX_CASH_AMOUNT),
    wholeCentsValidator,
    (control) => this.withinAvailableCash(control),
  ]);
  protected readonly form = new FormGroup({ amount: this.amount });

  protected amountError(): string {
    const errors = this.amount.errors;
    if (!errors) {
      return '';
    }
    if (errors['insufficientFunds']) {
      return "That's more than your available cash.";
    }
    if (errors['wholeCents']) {
      return 'Enter the amount in whole cents.';
    }
    if (errors['max']) {
      return 'The most you can move at once is $1,000,000.';
    }
    return 'Enter an amount greater than $0.';
  }

  protected onSubmit(): void {
    if (this.saving()) {
      return;
    }
    if (this.amount.invalid) {
      this.amount.markAsTouched();
      return;
    }
    const amount = toCents(this.amount.value ?? 0);
    const request = this.isDeposit() ? this._store.deposit(amount) : this._store.withdraw(amount);

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
    // The control validates once while it is being built, before inputs are set.
    if (!this.amount || this.mode() !== 'withdraw' || control.value === null) {
      return null;
    }
    return control.value > this._store.cashBalance() ? { insufficientFunds: true } : null;
  }
}
