import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { HlmFieldImports } from '@shared/ui-components/field';
import { HlmNativeSelectImports } from '@shared/ui-components/native-select';
import {
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  IDLE_TIMEOUT_OPTIONS,
  SessionTimeoutService,
} from '../../core/auth/session-timeout.service';

@Component({
  selector: 'app-settings-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgIcon, HlmFieldImports, HlmNativeSelectImports],
  providers: [provideIcons({ lucideX })],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  templateUrl: './settings-dialog.component.html',
  styleUrl: './settings-dialog.component.css',
})
export class SettingsDialogComponent {
  private readonly _sessionTimeout = inject(SessionTimeoutService);
  private readonly _dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

  readonly closed = output<void>();

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
    // Move focus into the dialog so keyboard and screen reader users land on its content.
    afterNextRender(() => this._dialog().nativeElement.focus());
  }
}
