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
import { HlmNativeSelectImports } from '@shared/ui-components/native-select';
import { DashboardDialogComponent } from '../shared/dashboard-dialog.component';
import { toAccountErrorMessage } from './account-error';
import { AccountStore } from './account-store.service';
import { Portfolio } from './account.models';

export const PORTFOLIO_NAME_MAX_LENGTH = 60;
export const PORTFOLIO_DESCRIPTION_MAX_LENGTH = 200;

// Creates a portfolio, or edits one when `portfolio` is set. A portfolio's account is fixed
// once created, so the account choice is only offered when creating.
@Component({
  selector: 'app-portfolio-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DashboardDialogComponent,
    HlmButtonImports,
    HlmFieldImports,
    HlmInputImports,
    HlmNativeSelectImports,
    ReactiveFormsModule,
  ],
  template: `
    <app-dashboard-dialog
      [dialogTitle]="editing() ? 'Edit portfolio' : 'New portfolio'"
      [closeLabel]="editing() ? 'Close edit portfolio' : 'Close new portfolio'"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate class="flex flex-col gap-4">
        <div hlmField>
          <label hlmFieldLabel for="portfolioAccount" class="text-foreground">Account</label>
          <hlm-native-select
            class="w-full"
            [selectId]="'portfolioAccount'"
            [selectClass]="'cursor-pointer rounded-[5px]'"
            formControlName="accountId"
          >
            @for (account of accounts(); track account.accountId) {
              <option [value]="account.accountId" hlmNativeSelectOption>{{ account.name }}</option>
            }
          </hlm-native-select>
          @if (editing()) {
            <p class="text-muted-foreground text-sm">
              A portfolio stays in the account it was created in.
            </p>
          }
        </div>

        <div hlmField>
          <label hlmFieldLabel for="portfolioName" class="text-foreground">Portfolio name</label>
          <input
            hlmInput
            id="portfolioName"
            type="text"
            autocomplete="off"
            placeholder="e.g. Long-term growth"
            class="rounded-[5px]"
            [attr.maxlength]="nameMaxLength"
            formControlName="name"
          />
          @if (form.controls.name.invalid && form.controls.name.touched) {
            <p class="text-destructive text-sm">
              Enter a portfolio name of up to {{ nameMaxLength }} characters.
            </p>
          }
        </div>

        <div hlmField>
          <label hlmFieldLabel for="portfolioDescription" class="text-foreground">
            Description
          </label>
          <textarea
            hlmInput
            id="portfolioDescription"
            rows="3"
            placeholder="Optional"
            class="h-auto rounded-[5px] py-2"
            [attr.maxlength]="descriptionMaxLength"
            formControlName="description"
          ></textarea>
          @if (form.controls.description.invalid && form.controls.description.touched) {
            <p class="text-destructive text-sm">
              Keep the description to {{ descriptionMaxLength }} characters.
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
export class PortfolioDialogComponent implements OnInit {
  private readonly _store = inject(AccountStore);

  // The portfolio to edit; null creates a new one.
  readonly portfolio = input<Portfolio | null>(null);
  // Account preselected when creating.
  readonly accountId = input<number | null>(null);

  readonly closed = output<void>();
  readonly saved = output<Portfolio>();

  protected readonly accounts = this._store.accounts;
  protected readonly editing = computed(() => this.portfolio() !== null);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly submitLabel = computed(() => {
    if (this.saving()) {
      return 'Saving…';
    }
    return this.editing() ? 'Save changes' : 'Create portfolio';
  });

  protected readonly nameMaxLength = PORTFOLIO_NAME_MAX_LENGTH;
  protected readonly descriptionMaxLength = PORTFOLIO_DESCRIPTION_MAX_LENGTH;

  // Native select values are strings; account ids are numbers everywhere else.
  protected readonly form = new FormGroup({
    accountId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(PORTFOLIO_NAME_MAX_LENGTH),
        Validators.pattern(/\S/),
      ],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: Validators.maxLength(PORTFOLIO_DESCRIPTION_MAX_LENGTH),
    }),
  });

  ngOnInit(): void {
    const portfolio = this.portfolio();
    if (portfolio) {
      this.form.setValue({
        accountId: String(portfolio.accountId),
        name: portfolio.name,
        description: portfolio.description ?? '',
      });
      this.form.controls.accountId.disable();
      return;
    }
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
    const { accountId, name, description } = this.form.getRawValue();
    const details = { name: name.trim(), description: description.trim() || null };
    const portfolio = this.portfolio();
    const request = portfolio
      ? this._store.updatePortfolio(portfolio.portfolioId, details)
      : this._store.createPortfolio({ ...details, accountId: Number(accountId) });

    this.saving.set(true);
    this.errorMessage.set('');
    request.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.saved.emit(saved);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(toAccountErrorMessage(error, 'save-portfolio'));
      },
    });
  }
}
