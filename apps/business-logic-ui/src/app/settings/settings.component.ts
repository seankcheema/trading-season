import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { HlmCardImports } from '@shared/ui-components/card';
import { HlmFieldImports } from '@shared/ui-components/field';
import { HlmNativeSelectImports } from '@shared/ui-components/native-select';
import {
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  IDLE_TIMEOUT_OPTIONS,
  SessionTimeoutService,
} from '../core/auth/session-timeout.service';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    HlmCardImports,
    HlmFieldImports,
    HlmNativeSelectImports,
  ],
  providers: [provideIcons({ lucideArrowLeft })],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  private readonly _sessionTimeout = inject(SessionTimeoutService);

  protected readonly timeoutOptions = IDLE_TIMEOUT_OPTIONS;
  protected readonly defaultTimeout = DEFAULT_IDLE_TIMEOUT_MINUTES;

  // Native select values are strings; the service stores whole minutes.
  protected readonly idleTimeout = new FormControl(String(this._sessionTimeout.timeoutMinutes()), {
    nonNullable: true,
  });

  constructor() {
    this.idleTimeout.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this._sessionTimeout.setTimeoutMinutes(Number(value)));
  }
}
