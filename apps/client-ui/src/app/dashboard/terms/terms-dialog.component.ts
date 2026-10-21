import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { HlmButtonImports } from '@shared/ui-components/button';
import { HlmFieldImports } from '@shared/ui-components/field';
import { HlmInputImports } from '@shared/ui-components/input';
import { toAccountErrorMessage } from '../accounts/account-error';
import { AccountStore } from '../accounts/account-store.service';
import { DashboardDialogComponent } from '../shared/dashboard-dialog.component';
import { TERMS_SECTIONS, TERMS_VERSION } from './terms-content';

// Shows the platform terms and records the user's acceptance. It cannot be dismissed: the user
// either signs by typing their name and accepts, or signs out.
@Component({
  selector: 'app-terms-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DashboardDialogComponent,
    HlmButtonImports,
    HlmFieldImports,
    HlmInputImports,
    ReactiveFormsModule,
  ],
  template: `
    <app-dashboard-dialog dialogTitle="Terms and Conditions" size="wide" [dismissible]="false">
      <form
        [formGroup]="form"
        (ngSubmit)="onSubmit()"
        novalidate
        class="flex flex-col gap-4 text-sm leading-6"
      >
        <p class="text-muted-foreground">
          TradingSeason is a simulated trading platform. Read and accept these terms to continue.
          <span class="whitespace-nowrap" data-testid="terms-version">Version {{ version }}.</span>
        </p>

        <div
          role="region"
          aria-label="Terms and Conditions text"
          tabindex="0"
          class="border-border max-h-[45vh] space-y-4 overflow-y-auto rounded-xl border p-4"
        >
          @for (section of sections; track section.title) {
            <section class="space-y-2">
              <h3 class="font-semibold">{{ section.title }}</h3>
              @for (paragraph of section.paragraphs; track paragraph) {
                <p class="text-muted-foreground">{{ paragraph }}</p>
              }
            </section>
          }
        </div>

        <div hlmField>
          <label hlmFieldLabel for="termsSignature" class="text-foreground">
            Type your full name to sign
          </label>
          <input
            hlmInput
            id="termsSignature"
            type="text"
            autocomplete="name"
            class="rounded-[5px]"
            [formControl]="signature"
          />
          <p hlmFieldDescription id="termsSignatureHint">
            Enter it as it appears on your account:
            <strong class="text-foreground font-semibold">{{ signatureName() }}</strong>
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
            class="cursor-pointer rounded-[5px]"
            (click)="declined.emit()"
          >
            Sign out
          </button>
          <button
            hlmBtn
            type="submit"
            class="cursor-pointer rounded-[5px] disabled:cursor-not-allowed disabled:opacity-70"
            [disabled]="!signed() || saving()"
          >
            {{ saving() ? 'Saving…' : 'Accept' }}
          </button>
        </div>
      </form>
    </app-dashboard-dialog>
  `,
})
export class TermsDialogComponent {
  private readonly _store = inject(AccountStore);

  // The user's name as held on their profile; typing it is the signature.
  readonly signatureName = input.required<string>();

  readonly accepted = output<void>();
  // The user chose to sign out instead of accepting.
  readonly declined = output<void>();

  protected readonly version = TERMS_VERSION;
  protected readonly sections = TERMS_SECTIONS;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly signature = new FormControl('', { nonNullable: true });
  protected readonly form = new FormGroup({ signature: this.signature });
  private readonly _typed = toSignal(this.signature.valueChanges, { initialValue: '' });

  // Capitalisation and spacing are not part of a name, so they are not part of the match. A
  // profile with no name on it is signed with whatever name the user gives.
  protected readonly signed = computed(() => {
    const typed = normalize(this._typed());
    const expected = normalize(this.signatureName());
    return expected ? typed === expected : typed.length > 0;
  });

  protected onSubmit(): void {
    if (this.saving() || !this.signed()) {
      return;
    }
    this.saving.set(true);
    this.errorMessage.set('');
    this._store.acceptTerms(TERMS_VERSION).subscribe({
      next: () => {
        this.saving.set(false);
        this.accepted.emit();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(toAccountErrorMessage(error, 'accept-terms'));
      },
    });
  }
}

function normalize(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
