import {
  ChangeDetectionStrategy,
  DestroyRef,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExecutionSettingsService } from './execution-settings.service';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { HlmFieldImports } from '@shared/ui-components/field';
import { HlmButtonImports } from '@shared/ui-components/button';
import { HlmSeparatorImports } from '@shared/ui-components/separator';
import { HlmNativeSelectImports } from '@shared/ui-components/native-select';
import {
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  IDLE_TIMEOUT_OPTIONS,
  SessionTimeoutService,
} from '../../core/auth/session-timeout.service';

@Component({
  selector: 'app-settings-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    NgIcon,
    HlmFieldImports,
    HlmNativeSelectImports,
    HlmButtonImports,
    HlmSeparatorImports,
  ],
  providers: [provideIcons({ lucideX })],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  templateUrl: './settings-dialog.component.html',
  styleUrl: './settings-dialog.component.css',
})
export class SettingsDialogComponent {
  private readonly _sessionTimeout = inject(SessionTimeoutService);
  private readonly _dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

  private readonly settings = inject(ExecutionSettingsService);
  readonly closed = output<void>();
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  private savedTimer?: ReturnType<typeof setTimeout>;
  protected readonly loadFailed = signal(false);
  protected readonly settingsMessage = signal('');
  protected readonly buffer = new FormControl(1, {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.min(0),
      Validators.max(10),
      (control) =>
        Number.isFinite(control.value) &&
        Math.abs(control.value * 100 - Math.round(control.value * 100)) < 1e-8
          ? null
          : { precision: true },
    ],
  });

  protected saveBuffer(): void {
    if (this.buffer.invalid || this.loading() || this.saving() || this.saved()) return;
    clearTimeout(this.savedTimer);
    this.saved.set(false);
    this.saving.set(true);
    this.settingsMessage.set('');
    this.settings
      .save(this.buffer.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (value) => {
          this.buffer.setValue(value.executionBufferPercent);
          this.saving.set(false);
          this.saved.set(true);
          this.savedTimer = setTimeout(() => this.saved.set(false), 2500);
        },
        error: () => {
          this.saving.set(false);
          this.settingsMessage.set('Unable to save your execution buffer. Please try again.');
        },
      });
  }
  protected loadBuffer(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.settingsMessage.set('');
    this.settings
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (value) => {
          this.buffer.setValue(value.executionBufferPercent);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.settingsMessage.set('Unable to load your execution buffer. Please retry.');
        },
      });
  }
  private readonly destroyRef = inject(DestroyRef);

  protected readonly timeoutOptions = IDLE_TIMEOUT_OPTIONS;
  protected readonly defaultTimeout = DEFAULT_IDLE_TIMEOUT_MINUTES;

  // Native select values are strings; the service stores whole minutes.
  protected readonly idleTimeout = new FormControl(String(this._sessionTimeout.timeoutMinutes()), {
    nonNullable: true,
  });

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.savedTimer));
    this.loadBuffer();
    this.idleTimeout.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this._sessionTimeout.setTimeoutMinutes(Number(value)));
    // Move focus into the dialog so keyboard and screen reader users land on its content.
    afterNextRender(() => this._dialog().nativeElement.focus());
  }
}
