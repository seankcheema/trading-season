import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideEye,
  lucideEyeOff,
  lucideLock,
  lucideSave,
  lucideX,
} from '@ng-icons/lucide';
import { HlmCardImports } from '@shared/ui-components/card';
import { HlmFieldImports } from '@shared/ui-components/field';
import { HlmInputImports } from '@shared/ui-components/input';
import { toAuthErrorMessage } from '../core/auth/auth-error';
import { AuthService } from '../core/auth/auth.service';
import { PASSWORD_RESET_SUCCESS_REASON } from '../core/auth/password-reset-reason';

const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9]/;
const NUMBER_PATTERN = /\d/;

/** Query parameter the emailed link carries, set by the auth service's MailService. */
const TOKEN_PARAM = 'token';

// Cross-field validator applied to the whole form, since confirmPassword can't validate
// against a sibling control on its own. Same rule as the registration form.
function passwordsMatchValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  };
}

@Component({
  selector: 'app-reset-password',
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
  providers: [
    provideIcons({
      lucideLock,
      lucideEye,
      lucideEyeOff,
      lucideSave,
      lucideCheck,
      lucideX,
    }),
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
})
export class ResetPasswordComponent {
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  // The token identifies the account, so without one there is nothing to submit and the
  // page offers a fresh request instead of a form.
  private readonly _token =
    inject(ActivatedRoute).snapshot.queryParamMap.get(TOKEN_PARAM) ?? '';
  protected readonly hasToken = this._token.length > 0;

  protected readonly showPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);
  protected readonly submitted = signal(false);
  // True while the reset request is in flight.
  protected readonly loading = signal(false);
  // Message from the last failed attempt, cleared as soon as the user edits the form.
  protected readonly errorMessage = signal<string | null>(null);

  private readonly _fb = new FormBuilder();

  protected readonly form = this._fb.nonNullable.group(
    {
      // The same rules the registration form applies, so a password accepted here is one
      // that could have been chosen at sign-up.
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(NUMBER_PATTERN),
          Validators.pattern(SPECIAL_CHARACTER_PATTERN),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator() },
  );

  private readonly _password = toSignal(this.form.controls.password.valueChanges, {
    initialValue: this.form.controls.password.value,
  });

  protected readonly hasMinLength = computed(() => this._password().length >= 8);
  protected readonly hasNumber = computed(() => NUMBER_PATTERN.test(this._password()));
  protected readonly hasSpecialCharacter = computed(() =>
    SPECIAL_CHARACTER_PATTERN.test(this._password()),
  );

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.errorMessage.set(null));
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((value: boolean) => !value);
  }

  protected toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((value: boolean) => !value);
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

    const { password } = this.form.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);

    this._authService
      .resetPassword(this._token, password)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          // The reset ended every session, so there is nothing to sign in with: the login
          // page confirms the change and takes the new password.
          void this._router.navigate(['/login'], {
            queryParams: { reason: PASSWORD_RESET_SUCCESS_REASON },
          });
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(toAuthErrorMessage(error, 'reset-password'));
        },
      });
  }
}
