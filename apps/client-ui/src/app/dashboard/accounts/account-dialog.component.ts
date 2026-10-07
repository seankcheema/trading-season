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
import { HttpErrorResponse } from '@angular/common/http';

export const ACCOUNT_NAME_MAX_LENGTH = 60;

// Creates an account, or manages its name and archive action when `account` is set. A new account starts empty: it
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
      [dialogTitle]="editing() ? 'Account settings' : 'New account'"
      [closeLabel]="editing() ? 'Close account settings' : 'Close new account'"
      (closed)="close()"
    >
      @if (deleted()) {
        <div class="account-delete-success flex flex-col items-center justify-center gap-4 text-center">
          <p role="status">Account deleted successfully.</p>
          <div class="flex justify-end">
            <button hlmBtn type="button" class="cursor-pointer rounded-[5px]" (click)="close()">
              Done
            </button>
          </div>
        </div>
      } @else if (confirmingDelete() && saving()) {
        <div role="status" aria-live="polite" aria-busy="true"
          class="flex flex-col items-center justify-center gap-4 text-center">
          <span aria-hidden="true"
            class="account-delete-spinner border-primary/20 border-t-primary size-10 rounded-full border-4"></span>
          <p class="text-muted-foreground text-sm">Deleting account…</p>
        </div>
      } @else if (!confirmingDelete()) {
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

          <div class="flex flex-wrap items-center justify-between gap-4">
            @if (editing()) {
              <button
                hlmBtn
                variant="destructive"
                type="button"
                [disabled]="saving()"
                class="border-destructive cursor-pointer rounded-[5px] border"
                (click)="startDelete()"
              >
                Delete account
              </button>
            }
            <div class="ml-auto flex items-center gap-2">
              <button
                hlmBtn
                variant="outline"
                type="button"
                class="cursor-pointer rounded-[5px]"
                (click)="close()"
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
          </div>
        </form>
      } @else {
        <div class="flex flex-col gap-4">
          <p>
            Delete {{ account()?.name }} from your active accounts?
          </p>
          <p class="text-muted-foreground text-sm">
            All positions must be closed before deletion.
          </p>
          @if (errorMessage()) {
            <p role="alert" class="text-destructive text-sm">{{ errorMessage() }}</p>
          }
          <div class="flex justify-end gap-2">
            <button
              hlmBtn
              variant="outline"
              type="button"
              [disabled]="saving()"
              (click)="cancelDelete()"
            >
              Cancel
            </button>
            <button
              hlmBtn
              variant="destructive"
              type="button"
              [disabled]="saving()"
              class="border-destructive cursor-pointer rounded-[5px] border"
              (click)="confirmDelete()"
            >
              {{ saving() ? 'Deleting…' : 'Delete account' }}
            </button>
          </div>
        </div>
      }
    </app-dashboard-dialog>
  `,
  styles: `
    .account-delete-spinner {
      animation: account-delete-spin 700ms linear infinite;
    }

    @keyframes account-delete-spin {
      to { transform: rotate(360deg); }
    }

    .account-delete-success {
      animation: account-delete-success-in 220ms ease-out both;
    }

    @keyframes account-delete-success-in {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .account-delete-success,
      .account-delete-spinner {
        animation: none;
      }
    }
  `,
})
export class AccountDialogComponent implements OnInit {
  private readonly _store = inject(AccountStore);

  // The account being managed; null creates a new one.
  readonly account = input<Account | null>(null);

  readonly closed = output<void>();
  readonly saved = output<Account>();

  protected readonly editing = computed(() => this.account() !== null);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly confirmingDelete = signal(false);
  protected readonly deleted = signal(false);
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

  protected close(): void {
    if (!this.saving()) this.closed.emit();
  }

  protected startDelete(): void {
    if (this.saving()) return;
    this.errorMessage.set('');
    this.confirmingDelete.set(true);
  }

  protected cancelDelete(): void {
    if (this.saving()) return;
    this.errorMessage.set('');
    this.confirmingDelete.set(false);
  }

  protected confirmDelete(): void {
    const account = this.account();
    if (!account || this.saving() || this.deleted()) return;
    this.saving.set(true);
    this.errorMessage.set('');
    this._store.deleteAccount(account.accountId).subscribe({
      next: () => {
        this.saving.set(false);
        this.deleted.set(true);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(
          error instanceof HttpErrorResponse && error.status === 422
            ? 'Close all positions before deleting this account.'
            : error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404)
              ? 'This account is no longer available to you.'
              : 'Unable to delete the account. Please try again.',
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
