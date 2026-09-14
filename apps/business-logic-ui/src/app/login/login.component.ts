import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEye, lucideEyeOff, lucideLock, lucideLogIn, lucideMail } from '@ng-icons/lucide';
import { HlmCardImports } from '@shared/ui-components/card';
import { HlmFieldImports } from '@shared/ui-components/field';
import { HlmInputImports } from '@shared/ui-components/input';

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
  // Toggles masking on the password field.
  protected readonly showPassword = signal(false);
  // Tracks whether the form has been submitted, to surface validation errors.
  protected readonly submitted = signal(false);

  private readonly _fb = new FormBuilder();

  protected readonly form = this._fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected togglePasswordVisibility(): void {
    this.showPassword.update((value: boolean) => !value);
  }

  protected onSubmit(): void {
    this.submitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // TODO: wire up to authentication service once backend endpoint is available
    console.log('Login submitted', this.form.getRawValue());
  }
}
