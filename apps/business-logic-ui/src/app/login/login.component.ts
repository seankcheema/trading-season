import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEye, lucideEyeOff, lucideLock, lucideLogIn, lucideMail } from '@ng-icons/lucide';
import { HlmCardImports } from '@shared/ui-components/card';
import { HlmFieldImports } from '@shared/ui-components/field';
import { HlmInputImports } from '@shared/ui-components/input';
import { toAuthErrorMessage } from '../core/auth/auth-error';
import { AuthService } from '../core/auth/auth.service';
import { INACTIVE_SIGN_OUT_REASON } from '../core/auth/session-timeout.service';

@Component({
  selector: 'app-login',
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
  providers: [provideIcons({ lucideMail, lucideLock, lucideEye, lucideEyeOff, lucideLogIn })],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  // Set when the inactivity timeout, rather than the user, ended the previous session.
  protected readonly signedOutForInactivity =
    inject(ActivatedRoute).snapshot.queryParamMap.get('reason') === INACTIVE_SIGN_OUT_REASON;

  // Toggles masking on the password field.
  protected readonly showPassword = signal(false);
  // Tracks whether the form has been submitted, to surface validation errors.
  protected readonly submitted = signal(false);
  // True while the sign-in request is in flight.
  protected readonly loading = signal(false);
  // Message from the last failed sign-in, cleared as soon as the user edits the form.
  protected readonly errorMessage = signal<string | null>(null);

  private readonly _fb = new FormBuilder();

  protected readonly form = this._fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.errorMessage.set(null));
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((value: boolean) => !value);
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

    const { email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);

    this._authService
      .login(email, password)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          void this._router.navigateByUrl('/dashboard');
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(toAuthErrorMessage(error, 'login'));
        },
      });
  }
}
