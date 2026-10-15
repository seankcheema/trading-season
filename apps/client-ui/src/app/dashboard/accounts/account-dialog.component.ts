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
import { HttpErrorResponse } from '@angular/common/http';
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
      [dialogTitle]="
        confirming() ? 'Confirm ' + confirming() : editing() ? 'Rename account' : 'New account'
      "
      [closeLabel]="editing() ? 'Close rename account' : 'Close new account'"
      [dismissible]="!saving()"
      (closed)="closed.emit()"
    >
      @if (confirming()) {
        <div class="flex flex-col gap-4">
          <div class="space-y-2">
            <p class="font-medium">Delete {{ account()?.name }} from your active portfolio?</p>
            <p class="text-muted-foreground text-sm">
              The account will be archived and become read-only. All account, transaction and
              order records stay in the database for reporting. This action cannot be reversed
              in the client.
            </p>
          </div>
          @if (errorMessage()) {
            <p role="alert" class="text-destructive text-sm">{{ errorMessage() }}</p>
          }
          <div class="flex justify-end gap-2">
            <button
              hlmBtn
              variant="outline"
              type="button"
              [disabled]="saving()"
              (click)="confirming.set(null)"
            >
              Back
            </button>
            <button
              hlmBtn
              variant="destructive"
              type="button"
              [disabled]="saving()"
              (click)="confirmClosure()"
            >
              {{ saving() ? 'Saving...' : 'Delete account' }}
            </button>
          </div>
        </div>
      } @else {
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

          @if (editing()) {
            @if (!eligibility()) {
              <p role="status" class="text-muted-foreground text-sm">
                {{ eligibilityError() || 'Checking account requirements...' }}
              </p>
            }
            @if (eligibility()?.deleteBlockers?.length) {
              <p class="text-muted-foreground text-sm">
                Delete: {{ eligibility()!.deleteBlockers.join('; ') }}
              </p>
            }
          }
          <div class="flex flex-wrap justify-end gap-2">
            @if (editing()) {
              <button
                hlmBtn
                variant="destructive"
                type="button"
                class="mr-auto"
                [disabled]="saving() || !eligibility() || !!eligibility()!.deleteBlockers.length"
                (click)="confirming.set('delete'); errorMessage.set('')"
              >
                Delete account
              </button>
            }
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
      }
    </app-dashboard-dialog>
  `,
})
export class AccountDialogComponent implements OnInit {
  private readonly _store = inject(AccountStore);

  // The account to rename; null creates a new one.
  readonly account = input<Account | null>(null);

  readonly closed = output<void>();
  readonly saved = output<Account>();

  protected readonly confirming = signal<'delete' | null>(null);
  protected readonly eligibility = signal<{
    archiveBlockers: string[];
    deleteBlockers: string[];
  } | null>(null);
  protected readonly eligibilityError = signal('');

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
    const account = this.account();
    if (account)
      this._store.eligibility(account.accountId).subscribe({
        next: (result) => this.eligibility.set(result),
        error: () =>
          this.eligibilityError.set('Unable to check requirements. Close and reopen to retry.'),
      });
  }

  protected confirmClosure(): void {
    const account = this.account();
    const action = this.confirming();
    if (!account || !action || this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set('');
    this._store.deleteAccount(account.accountId).subscribe({
      next: () => {
        this.saving.set(false);
        this.closed.emit();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(
          error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
            ? error.error.error
            : 'Unable to update account. Please try again.',
        );
      },
    });
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
