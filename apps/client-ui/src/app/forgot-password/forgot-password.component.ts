import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideMail, lucideSend } from '@ng-icons/lucide';
import { HlmCardImports } from '@shared/ui-components/card';
import { HlmFieldImports } from '@shared/ui-components/field';
import { HlmInputImports } from '@shared/ui-components/input';
import { toAuthErrorMessage } from '../core/auth/auth-error';
import { AuthService } from '../core/auth/auth.service';

/** How long the emailed link lasts, matching PASSWORD_RESET_TOKEN_TTL_MS in the auth service. */
const RESET_LINK_MINUTES = 30;

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
  ],
  providers: [provideIcons({ lucideMail, lucideSend, lucideArrowLeft })],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent {
  private readonly _authService = inject(AuthService);
  private readonly _destroyRef = inject(DestroyRef);

  // Tracks whether the form has been submitted, to surface validation errors.
  protected readonly submitted = signal(false);
  // True while the request is in flight.
  protected readonly loading = signal(false);
  // Set once the service has accepted the request, which replaces the form with a confirmation.
  protected readonly sent = signal(false);
  // Message from the last failed request, cleared as soon as the user edits the form.
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly linkMinutes = RESET_LINK_MINUTES;

  private readonly _fb = new FormBuilder();

  protected readonly form = this._fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.errorMessage.set(null));
  }

  protected onSubmit(): void {
    this.submitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.loading()) {
      return;
    }

    const { email } = this.form.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);

    this._authService
      .requestPasswordReset(email)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          // The same confirmation for every address. The service deliberately
          // does not say whether an account exists, and neither does this page.
          this.sent.set(true);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(toAuthErrorMessage(error, 'forgot-password'));
        },
      });
  }
}
