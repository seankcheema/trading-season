import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ForecastRecord, outlookForecastRecord, trendForecastRecord } from '../../dua/dua-insights';
import { ForecastConfidenceComponent } from '../../dua/forecast-confidence.component';
import { PlatformSignalsService } from '../risk-outlook/platform-signals.service';
import { readingFor } from '../risk-outlook/platform-signals';
import { PlatformTrendService } from '../trend-read/platform-trend.service';
import { trendReadingFor } from '../trend-read/platform-trend';

/**
 * The market page's forecast drawer: both model forecasts for the open stock in one place. It
 * leads with each call and its record as one frequency with a track strip, and keeps the reasons
 * and the scoring against simple patterns in two collapsed sections (progressive disclosure).
 * It slides in over the chart, never over the order ticket, and closes on its button or Escape.
 */
@Component({
  selector: 'app-forecast-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ForecastConfidenceComponent, NgTemplateOutlet],
  host: {
    role: 'complementary',
    '[attr.aria-label]': "symbol() + ' forecast'",
    'data-testid': 'forecast-drawer',
    '(keydown.escape)': 'closed.emit()',
  },
  template: `
    <header class="drawer-header">
      <div class="drawer-title">
        <span class="forecast-chip"
          ><span class="forecast-mark" aria-hidden="true"></span>Model forecast</span
        >
        <h2>{{ symbol() }} forecast</h2>
        @if (asOf(); as day) {
          <p class="drawer-meta">
            As of the {{ day | date: 'MMM d' }} close · next {{ horizon() }} trading days
          </p>
        }
      </div>
      <button
        #closeButton
        type="button"
        class="drawer-close"
        aria-label="Close forecast"
        (click)="closed.emit()"
      >
        ×
      </button>
    </header>

    @if (failed()) {
      <p class="drawer-message" role="alert">The forecast is unavailable right now.</p>
    } @else if (!ready()) {
      <p class="drawer-message" role="status">Loading the forecast…</p>
    } @else {
      <div class="drawer-summary">
        <section class="summary-row" data-testid="forecast-direction" aria-labelledby="fd-dir">
          <h3 id="fd-dir">Direction</h3>
          @switch (trend()?.kind) {
            @case ('ready') {
              <p
                class="drawer-call"
                [class.up]="direction() === 'up'"
                [class.down]="direction() === 'down'"
              >
                {{ directionCall() }}
              </p>
              <ng-container
                *ngTemplateOutlet="recordRow; context: { $implicit: directionRecord() }"
              />
            }
            @case ('too-early') {
              <p class="drawer-why">Direction reads start {{ trendFirstDay() }}.</p>
            }
            @default {
              <p class="drawer-why">No direction forecast covers {{ symbol() }}.</p>
            }
          }
        </section>

        <section class="summary-row" data-testid="forecast-volatility" aria-labelledby="fd-vol">
          <h3 id="fd-vol">Price swings</h3>
          @switch (risk()?.kind) {
            @case ('ready') {
              <p
                class="drawer-call"
                [class.swing-more]="risk()?.kind === 'ready' && swingCall().startsWith('Bigger')"
                [class.swing-less]="risk()?.kind === 'ready' && swingCall().startsWith('Smaller')"
              >
                {{ swingCall() }}
              </p>
              <ng-container *ngTemplateOutlet="recordRow; context: { $implicit: swingRecord() }" />
            }
            @case ('too-early') {
              <p class="drawer-why">Swing reads start {{ riskFirstDay() }}.</p>
            }
            @default {
              <p class="drawer-why">No volatility forecast covers {{ symbol() }}.</p>
            }
          }
        </section>
      </div>

      <details class="drawer-more" data-testid="forecast-why">
        <summary>Why these calls</summary>
        <div class="drawer-more-body">
          <p class="drawer-why">
            Confidence is how often each forecast's recent calls were right, over weeks that had
            already closed.
          </p>
          @if (trend()?.kind === 'ready') {
            <p class="drawer-why">{{ directionWhy() }}</p>
            @if (directionRecord()?.coverage; as coverage) {
              <p class="drawer-why">{{ coverage }}</p>
            }
          }
          @if (risk()?.kind === 'ready') {
            <div class="drawer-meter">
              <div class="drawer-meter-labels" aria-hidden="true">
                <span>Smaller swings</span><span>Bigger swings</span>
              </div>
              <div class="drawer-meter-track" role="img" [attr.aria-label]="swingMeterLabel()">
                <span class="drawer-meter-marker" [style.left.%]="swingProbability() * 100"></span>
              </div>
            </div>
            <p class="drawer-why">
              The swings read says how much the price may move, up or down, not which way.
            </p>
          }
        </div>
      </details>

      <details class="drawer-more" data-testid="forecast-scoring">
        <summary>How it's scored</summary>
        <div class="drawer-more-body">
          <ul class="drawer-scores">
            @for (line of scoreLines(); track line.label) {
              <li>
                <span>{{ line.label }}</span>
                <strong>{{ line.value }}</strong>
              </li>
            }
          </ul>
          <p class="drawer-why">
            Each forecast is judged against a simple pattern anyone could follow, over weeks that
            had already closed by this simulated date.
          </p>
        </div>
      </details>
    }

    <p class="drawer-notice" role="note">
      A model's read on a simulated market. Not investment advice; it can be wrong.
    </p>

    <ng-template #recordRow let-record>
      @if (record) {
        <div class="drawer-record">
          <app-forecast-confidence [record]="record" />
        </div>
      } @else {
        <p class="drawer-why">No closed weeks yet, so there is no record to show.</p>
      }
    </ng-template>
  `,
  styleUrl: './forecast-drawer.component.css',
})
export class ForecastDrawerComponent {
  readonly symbol = input.required<string>();
  readonly marketTimestamp = input.required<string>();
  readonly closed = output<void>();

  private readonly trendStore = inject(PlatformTrendService);
  private readonly signalStore = inject(PlatformSignalsService);
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');

  protected readonly failed = computed(
    () => this.trendStore.status() === 'error' && this.signalStore.status() === 'error',
  );
  protected readonly ready = computed(
    () => this.trendStore.status() === 'ready' || this.signalStore.status() === 'ready',
  );
  protected readonly trend = computed(() => {
    const file = this.trendStore.trend();
    const at = this.marketTimestamp();
    return file && at ? trendReadingFor(file, this.symbol(), at) : null;
  });
  protected readonly risk = computed(() => {
    const file = this.signalStore.signals();
    const at = this.marketTimestamp();
    return file && at ? readingFor(file, this.symbol(), at) : null;
  });
  protected readonly horizon = computed(
    () => this.trendStore.trend()?.horizonDays ?? this.signalStore.signals()?.horizonDays ?? 5,
  );
  protected readonly asOf = computed(() => {
    const trend = this.trend();
    if (trend?.kind === 'ready') return trend.asOf;
    const risk = this.risk();
    return risk?.kind === 'ready' ? risk.asOf : null;
  });
  protected readonly trendFirstDay = computed(() => {
    const trend = this.trend();
    return trend?.kind === 'too-early' ? trend.firstDay : '';
  });
  protected readonly riskFirstDay = computed(() => {
    const risk = this.risk();
    return risk?.kind === 'too-early' ? risk.firstDay : '';
  });

  protected readonly direction = computed(() => {
    const trend = this.trend();
    return trend?.kind === 'ready' ? trend.call : null;
  });
  protected readonly directionCall = computed(() => {
    const call = this.direction();
    return call === 'up'
      ? 'Price likely higher'
      : call === 'down'
        ? 'Price likely lower'
        : 'No clear direction';
  });
  protected readonly directionWhy = computed(() => {
    const call = this.direction();
    const days = this.trendStore.trend()?.signalDays ?? 5;
    return call === null
      ? `${this.symbol()}'s recent move is too small against its usual swings to call.`
      : `${this.symbol()} moved ${call} over the last ${days} days, by more than its usual swings.`;
  });
  protected readonly directionRecord = computed<ForecastRecord | undefined>(() => {
    const trend = this.trend();
    return trend?.kind === 'ready' ? trendForecastRecord(trend) : undefined;
  });

  protected readonly swingProbability = computed(() => {
    const risk = this.risk();
    return risk?.kind === 'ready' ? risk.probability : 0.5;
  });
  protected readonly swingCall = computed(() => {
    const risk = this.risk();
    return risk?.kind === 'ready' && risk.call === 'stormier'
      ? 'Bigger price swings likely'
      : 'Smaller price swings likely';
  });
  protected readonly swingMeterLabel = computed(
    () => `Model estimate: ${Math.round(this.swingProbability() * 100)}% chance of bigger swings`,
  );
  protected readonly swingRecord = computed<ForecastRecord | undefined>(() => {
    const risk = this.risk();
    return risk?.kind === 'ready' ? outlookForecastRecord(risk) : undefined;
  });

  /** Each forecast beside the simple pattern it is measured against, over closed weeks. */
  protected readonly scoreLines = computed(() => {
    const lines: { label: string; value: string }[] = [];
    const trend = this.trend();
    if (trend?.kind === 'ready') {
      lines.push(
        { label: 'Direction forecast', value: rate(trend.signalHits, trend.signalCalls, 'calls') },
        {
          label: '"Keeps going the same way"',
          value: rate(trend.ruleHits, trend.ruleDays, 'weeks'),
        },
      );
    }
    const risk = this.risk();
    if (risk?.kind === 'ready') {
      lines.push(
        { label: 'Swings model', value: rate(risk.modelHits, risk.modelDays, 'weeks') },
        { label: '"Like last week"', value: rate(risk.ruleHits, risk.ruleDays, 'weeks') },
      );
    }
    return lines;
  });

  constructor() {
    effect(() => {
      if (this.trendStore.status() === 'idle') {
        this.trendStore.load().subscribe({ error: () => undefined });
      }
      if (this.signalStore.status() === 'idle') {
        this.signalStore.load().subscribe({ error: () => undefined });
      }
    });
    // Focus lands in the drawer when it opens, so Escape and the keyboard reach it.
    afterNextRender(() => this.closeButton()?.nativeElement.focus());
  }
}

function rate(hits: number, total: number, unit: 'calls' | 'weeks'): string {
  return total
    ? `${hits} of last ${total} ${unit} (${Math.round((hits / total) * 100)}%)`
    : 'No record yet';
}
