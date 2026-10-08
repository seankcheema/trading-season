import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEye, lucideEyeOff, lucideLock, lucideLogIn, lucideMail } from '@ng-icons/lucide';
import { AuthService } from '../core/auth/auth.service';

export const LOGIN_ERROR_MESSAGES = {
  network: "Can't reach the server. Check your connection and try again.",
  unavailable: 'The service is unavailable right now. Please try again shortly.',
  invalidCredentials:
    'Incorrect email or password. Too many failed attempts will temporarily lock your account.',
  failed: 'Something went wrong signing you in. Please try again.',
} as const;

// Maps a failed sign-in to a message that is safe and useful to show the user.
export function toLoginErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return LOGIN_ERROR_MESSAGES.failed;
  }
  if (error.status === 0) {
    return LOGIN_ERROR_MESSAGES.network;
  }
  if (error.status >= 500) {
    return LOGIN_ERROR_MESSAGES.unavailable;
  }
  return error.status === 401 ? LOGIN_ERROR_MESSAGES.invalidCredentials : LOGIN_ERROR_MESSAGES.failed;
}

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgIcon],
  providers: [provideIcons({ lucideMail, lucideLock, lucideEye, lucideEyeOff, lucideLogIn })],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  // Toggles masking on the password field.
  protected readonly showPassword = signal(false);
  // True while the sign-in request is in flight.
  protected readonly loading = signal(false);
  // Message from the last failed sign-in, cleared as soon as the user edits the form.
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormBuilder().nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.errorMessage.set(null));
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  protected onSubmit(): void {
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
          void this._router.navigateByUrl('/');
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(toLoginErrorMessage(error));
        },
      });
  }
}
