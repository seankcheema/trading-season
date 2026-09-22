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
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideDollarSign,
  lucideEye,
  lucideEyeOff,
  lucideLock,
  lucideMail,
  lucideMapPin,
  lucideUserPlus,
  lucideX,
} from '@ng-icons/lucide';
import { HlmNativeSelectImports } from '@shared/ui-components/native-select';
import { HlmFieldImports } from '@shared/ui-components/field';
import { HlmCardImports } from '@shared/ui-components/card';
import { HlmInputImports } from '@shared/ui-components/input';
import { toAuthErrorMessage } from '../core/auth/auth-error';
import { AuthService } from '../core/auth/auth.service';

const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9]/;
const NUMBER_PATTERN = /\d/;
const SSN_PATTERN = /^\d{3}-\d{2}-\d{4}$/;
const MINIMUM_AVAILABLE_FUNDS = 5000;

// Cross-field validator applied to the whole form since confirmPassword can't validate against a sibling control on its own.
function passwordsMatchValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  };
}

@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    HlmNativeSelectImports,
    HlmFieldImports,
    HlmCardImports,
    HlmInputImports,
  ],
  providers: [
    provideIcons({
      lucideMail,
      lucideLock,
      lucideMapPin,
      lucideDollarSign,
      lucideEye,
      lucideEyeOff,
      lucideUserPlus,
      lucideCheck,
      lucideX,
    }),
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  private readonly _authService = inject(AuthService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly showPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);
  // The SSN is masked like a password, and revealed only when the user asks.
  protected readonly showSsn = signal(false);
  protected readonly submitted = signal(false);
  // True while the registration requests are in flight.
  protected readonly loading = signal(false);
  // Message from the last failed registration, cleared as soon as the user edits the form.
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly traderLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
  protected readonly minimumAvailableFunds = MINIMUM_AVAILABLE_FUNDS;

  private readonly _fb = new FormBuilder();

  protected readonly form = this._fb.nonNullable.group(
    {
      firstName: ['', [Validators.required]],
      middleName: [''],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      dateOfBirth: ['', [Validators.required]],
      ssn: ['', [Validators.required, Validators.pattern(SSN_PATTERN)]],
      address: ['', [Validators.required]],
      traderLevel: ['BEGINNER', [Validators.required]],
      availableFunds: [
        MINIMUM_AVAILABLE_FUNDS,
        [Validators.required, Validators.min(MINIMUM_AVAILABLE_FUNDS)],
      ],
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

  // Mirrors the password control as a signal so the strength checklist below updates live.
  private readonly _passwordValue = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });

  protected readonly hasMinLength = computed(() => this._passwordValue().length >= 8);
  protected readonly hasNumber = computed(() => NUMBER_PATTERN.test(this._passwordValue()));
  protected readonly hasSpecialCharacter = computed(() =>
    SPECIAL_CHARACTER_PATTERN.test(this._passwordValue()),
  );

  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.errorMessage.set(null));
  }

  // Auto-formats raw digit input into XXX-XX-XXXX as the user types.
  protected onSsnInput(event: Event): void {
    const digits = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 9);
    const formatted = [digits.slice(0, 3), digits.slice(3, 5), digits.slice(5, 9)]
      .filter(Boolean)
      .join('-');
    this.form.controls.ssn.setValue(formatted);
  }

  // Blocks the number input's scientific-notation and sign keys ('e', '+', '-').
  protected onAvailableFundsKeydown(event: KeyboardEvent): void {
    if (['e', 'E', '+', '-'].includes(event.key)) {
      event.preventDefault();
    }
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  protected toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((value) => !value);
  }

  protected toggleSsnVisibility(): void {
    this.showSsn.update((value) => !value);
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

    const { confirmPassword: _confirmPassword, ...details } = this.form.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);

    this._authService
      .register(details)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          void this._router.navigateByUrl('/dashboard');
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(toAuthErrorMessage(error, 'register-auth'));
        },
      });
  }
}

