import {
  ChangeDetectionStrategy,
  DestroyRef,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExecutionSettingsService } from './execution-settings.service';
import { MarketClockFormComponent } from '../shared/market-clock-form.component';
import { MarketClockService } from '../shared/market-clock.service';
import { MarketSnapshot } from '../market-data.service';
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
    MarketClockFormComponent,
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
  // A new simulated time from the Market clock section; the opening page reloads from it.
  readonly clockApplied = output<MarketSnapshot>();
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

  // The last execution buffer the server confirmed; null until the first load succeeds.
  private readonly savedBuffer = signal<number | null>(null);
  private readonly bufferValue = toSignal(this.buffer.valueChanges, {
    initialValue: this.buffer.value,
  });
  private readonly clock = inject(MarketClockService);
  private readonly clockForm = viewChild.required(MarketClockFormComponent);

  private readonly bufferChanged = computed(
    () => this.savedBuffer() !== null && this.bufferValue() !== this.savedBuffer(),
  );
  private readonly timeoutChanged = computed(
    () => this.idleTimeoutValue() !== String(this._sessionTimeout.timeoutMinutes()),
  );
  // Every section is edited in place and committed together by Save all.
  protected readonly hasChanges = computed(
    () => this.bufferChanged() || this.timeoutChanged() || this.clock.marketDateTimeEdited(),
  );

  // Saves every changed section at once. A section that fails keeps its edit and its own
  // message so the rest stay saved and a retry sends only what is still outstanding.
  protected saveAll(): void {
    if (this.cannotSave()) {
      return;
    }
    clearTimeout(this.savedTimer);
    this.saved.set(false);
    this.saving.set(true);
    this.settingsMessage.set('');
    if (this.timeoutChanged()) {
      this._sessionTimeout.setTimeoutMinutes(Number(this.idleTimeout.value));
    }
    const failures: string[] = [];
    const tasks: Observable<void>[] = [];
    if (this.bufferChanged()) {
      tasks.push(
        this.settings.save(this.buffer.value).pipe(
          map((value) => {
            this.savedBuffer.set(value.executionBufferPercent);
            this.buffer.setValue(value.executionBufferPercent);
          }),
          catchError(() => {
            failures.push('Unable to save your execution buffer. Please try again.');
            return of(undefined);
          }),
        ),
      );
    }
    if (this.clock.marketDateTimeEdited()) {
      tasks.push(
        this.clockForm()
          .apply()
          .pipe(
            map((applied) => {
              if (!applied) {
                failures.push('The market clock was not changed. See Market clock above.');
              }
            }),
          ),
      );
    }
    (tasks.length ? forkJoin(tasks) : of([]))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.saving.set(false);
        if (failures.length) {
          this.settingsMessage.set(failures.join(' '));
          return;
        }
        this.saved.set(true);
        this.savedTimer = setTimeout(() => this.saved.set(false), 2500);
      });
  }

  protected cannotSave(): boolean {
    return this.isBusy() || this.buffer.invalid || !this.hasChanges();
  }

  private isBusy(): boolean {
    return this.loading() || this.saving() || this.saved();
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
          this.savedBuffer.set(value.executionBufferPercent);
          this.buffer.setValue(value.executionBufferPercent);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
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

  private readonly idleTimeoutValue = toSignal(this.idleTimeout.valueChanges, {
    initialValue: this.idleTimeout.value,
  });

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.savedTimer));
    this.loadBuffer();
    // Move focus into the dialog so keyboard and screen reader users land on its content.
    afterNextRender(() => this._dialog().nativeElement.focus());
  }
}
