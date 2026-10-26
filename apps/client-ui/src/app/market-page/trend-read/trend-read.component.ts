import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DatePipe, PercentPipe } from '@angular/common';
import { MIN_RECORD_DAYS, RECORD_WINDOW } from '../risk-outlook/platform-signals';
import { PlatformTrendService } from './platform-trend.service';
import { TrendCall, TrendReading, trendReadingFor } from './platform-trend';

/**
 * The trade signal card for one instrument: whether the read suggests buying or
 * selling over the next trading days. It leads with the strong-trend read, which
 * calls the last days' direction only when that move is large against the stock's
 * usual swings and otherwise says there is no clear direction; its record counts
 * its closed calls, quoted with how often it called. The machine-learning model and
 * the momentum pattern are shown beside it in Details. It carries its own notice on
 * every render: the read comes from a model on a simulated market, can be wrong, and
 * must not be taken as true or as advice.
 */
@Component({
  selector: 'app-trend-read',
  imports: [DatePipe, PercentPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'trend-read' },
  template: `
    @switch (store.status()) {
      @case ('error') {
        <p class="text-loss text-xs" role="alert">Trade signal unavailable.</p>
        <button type="button" class="text-primary mt-2 text-xs" (click)="store.load().subscribe()">
          Retry signal
        </button>
      }
      @case ('ready') {
        @if (reading(); as r) {
          @switch (r.kind) {
            @case ('unknown-symbol') {
              <p class="text-muted-foreground py-6 text-center text-sm">
                No trade signal for {{ symbol() }}: the model does not cover this stock.
              </p>
            }
            @case ('too-early') {
              <p class="text-muted-foreground py-6 text-center text-sm">
                No trade signal yet. Readings start {{ r.firstDay }}.
              </p>
            }
            @case ('ready') {
              <section
                class="glance"
                [class.glance-up]="r.call === 'up'"
                [class.glance-down]="r.call === 'down'"
                data-testid="trend-headline"
              >
                <svg class="glance-mark" viewBox="0 0 24 24" aria-hidden="true" fill="none">
                  @if (r.call === null) {
                    <path
                      d="M4 12h16"
                      stroke="currentColor"
                      stroke-width="2.2"
                      stroke-linecap="round"
                    />
                  } @else if (r.call === 'up') {
                    <path
                      d="M4 17l6-6 4 4 6-6M14 9h6v6"
                      stroke="currentColor"
                      stroke-width="2.2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  } @else {
                    <path
                      d="M4 7l6 6 4-4 6 6M14 15h6V9"
                      stroke="currentColor"
                      stroke-width="2.2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  }
                </svg>
                <h3 class="glance-title">{{ title(r.call) }}</h3>
                <p class="glance-sub" data-testid="trend-basis-line">
                  @if (r.call === null) {
                    Next {{ horizon() }} trading days · {{ symbol() }}'s recent move is too small
                    against its usual swings to call
                  } @else {
                    Next {{ horizon() }} trading days · {{ symbol() }} moved {{ r.call }} over the
                    last {{ signalDays() }} days, by more than its usual swings
                  }
                </p>
                <div class="glance-record">
                  @if (r.recent.length) {
                    <span class="dots" role="img" [attr.aria-label]="dotsLabel(r)">
                      @for (read of recentOldestFirst(r); track read.date) {
                        <span
                          class="dot"
                          [class.dot-hit]="read.hit"
                          [class.dot-miss]="!read.hit"
                        ></span>
                      }
                    </span>
                  }
                  <span class="glance-accuracy" data-testid="trend-basis">
                    @if (r.signalCalls) {
                      Right {{ r.signalHits }} of last {{ r.signalCalls }} calls · called
                      {{ r.signalCalls }} of {{ r.signalWeeks }} weeks
                    } @else {
                      First reads on {{ symbol() }}; no record yet
                    }
                  </span>
                </div>
              </section>

              <p class="notice" role="note" data-testid="trend-notice">
                This is a machine-learning read on a simulated market, not a prediction of any real
                market and not investment advice. It can be wrong. Do not take it as true or as
                advice to buy or sell.
              </p>

              <button
                type="button"
                class="details-toggle"
                [attr.aria-expanded]="detailsOpen()"
                aria-controls="trend-details"
                data-testid="trend-toggle"
                (click)="detailsOpen.update((open) => !open)"
              >
                {{ detailsOpen() ? 'Hide details' : 'Details' }}
                <span aria-hidden="true">{{ detailsOpen() ? '▴' : '▾' }}</span>
              </button>

              @if (detailsOpen()) {
                <div id="trend-details" class="details" data-testid="trend-details">
                  <section
                    class="meter-block"
                    aria-label="Model estimate"
                    data-testid="trend-meter"
                  >
                    <div class="meter-labels">
                      <span>Lower</span>
                      <span>Higher</span>
                    </div>
                    <div
                      class="meter meter-direction"
                      role="img"
                      [attr.aria-label]="meterLabel(r.probability)"
                    >
                      <span class="meter-midline" aria-hidden="true"></span>
                      <span
                        class="meter-marker"
                        aria-hidden="true"
                        [style.left.%]="r.probability * 100"
                      ></span>
                    </div>
                    <p class="meter-caption">
                      Model estimate: {{ r.probability | percent: '1.0-0' }} chance the price is
                      higher in {{ horizon() }} trading days
                    </p>
                  </section>

                  <dl class="outlook-grid mt-3">
                    <div
                      class="outlook-card read-tile read-tile-shown read-tile-wide"
                      data-testid="trend-signal"
                    >
                      <dt class="tile-label">
                        Strong-trend read
                        <span class="read-badge">leads</span>
                      </dt>
                      <dd
                        class="tile-call"
                        [class.text-gain]="r.call === 'up'"
                        [class.text-loss]="r.call === 'down'"
                      >
                        {{ r.call ? label(r.call) : 'No call' }}
                      </dd>
                      <dd class="tile-note">
                        @if (r.signalCalls) {
                          Last {{ r.signalCalls }} calls
                          {{ accuracy(r.signalHits, r.signalCalls) | percent: '1.0-0' }} ({{
                            r.signalHits
                          }}
                          of {{ r.signalCalls }}), made on {{ r.signalCalls }} of
                          {{ r.signalWeeks }} weeks
                        } @else {
                          No closed calls yet
                        }
                      </dd>
                    </div>
                    <div class="outlook-card read-tile" data-testid="trend-model">
                      <dt class="tile-label">Trading Season model</dt>
                      <dd
                        class="tile-call"
                        [class.text-gain]="r.modelCall === 'up'"
                        [class.text-loss]="r.modelCall === 'down'"
                      >
                        {{ label(r.modelCall) }}
                      </dd>
                      <dd class="tile-note">
                        @if (r.modelDays >= minRecord) {
                          Last {{ r.modelDays }} weeks
                          {{ accuracy(r.modelHits, r.modelDays) | percent: '1.0-0' }} ({{
                            r.modelHits
                          }}
                          of {{ r.modelDays }})
                        } @else {
                          Still learning: {{ r.modelDays }} of {{ minRecord }} weeks of record
                        }
                      </dd>
                    </div>
                    <div class="outlook-card read-tile" data-testid="trend-pattern">
                      <dt class="tile-label">Momentum pattern</dt>
                      <dd
                        class="tile-call"
                        [class.text-gain]="r.ruleCall === 'up'"
                        [class.text-loss]="r.ruleCall === 'down'"
                      >
                        {{ label(r.ruleCall) }}
                      </dd>
                      <dd class="tile-note">
                        Last {{ r.ruleDays }} weeks
                        {{ accuracy(r.ruleHits, r.ruleDays) | percent: '1.0-0' }} ({{
                          r.ruleHits
                        }}
                        of {{ r.ruleDays }})
                      </dd>
                    </div>
                  </dl>
                  <p class="text-muted-foreground mt-2 text-xs">
                    The strong-trend read calls the last {{ signalDays() }} days' direction only
                    when that move is large against {{ symbol() }}'s usual swings, and makes no call
                    otherwise: in a range-bound market a week's direction is close to a coin flip.
                    The pattern reads "the next {{ horizon() }} days continue the last
                    {{ momentumDays() }}" every week, and the model calls every week too; both are
                    scored over the last {{ recordWindow }} closed weeks. As of the
                    {{ r.asOf }} close.
                  </p>

                  <section class="mt-3" aria-label="Recent reads" data-testid="trend-recent">
                    <h4 class="text-muted-foreground text-xs font-medium">
                      Recent calls and what the price then did
                    </h4>
                    @if (r.recent.length) {
                      <ul class="divide-border mt-1 divide-y text-xs">
                        @for (read of r.recent; track read.date) {
                          <li
                            class="flex items-center justify-between gap-2 py-1"
                            data-testid="trend-read"
                          >
                            <span class="text-muted-foreground tabular-nums">
                              {{ read.date | date: 'MMM d' }}
                            </span>
                            <span class="min-w-0 flex-1 truncate">
                              {{ label(read.call) }}
                            </span>
                            <span
                              class="tabular-nums"
                              [class.text-gain]="read.move > 0"
                              [class.text-loss]="read.move < 0"
                            >
                              {{ read.move > 0 ? '+' : '' }}{{ read.move | percent: '1.1-1' }}
                            </span>
                            <span
                              class="font-medium"
                              [class.text-gain]="read.hit"
                              [class.text-loss]="!read.hit"
                            >
                              {{ read.hit ? 'Correct' : 'Missed' }}
                            </span>
                          </li>
                        }
                      </ul>
                    } @else {
                      <p class="text-muted-foreground mt-1 text-xs">
                        No called week has closed yet at this simulated date.
                      </p>
                    }
                  </section>
                </div>
              }
            }
          }
        }
      }
      @default {
        <span class="sr-only" role="status">Loading trade signal…</span>
        <div class="outlook-card glance-skeleton" aria-hidden="true">
          <span class="skeleton h-8 w-8 rounded-full"></span>
          <span class="skeleton mt-2 h-7 w-56"></span>
          <span class="skeleton mt-1.5 h-3 w-40"></span>
          <span class="skeleton mt-3 h-3 w-48"></span>
        </div>
      }
    }
  `,
  styleUrl: '../risk-outlook/outlook-card.css',
})
export class TrendReadComponent {
  readonly symbol = input.required<string>();
  readonly marketTimestamp = input.required<string>();
  protected readonly store = inject(PlatformTrendService);
  protected readonly minRecord = MIN_RECORD_DAYS;
  protected readonly recordWindow = RECORD_WINDOW;
  protected readonly detailsOpen = signal(false);
  protected readonly horizon = computed(() => this.store.trend()?.horizonDays ?? 5);
  protected readonly momentumDays = computed(() => this.store.trend()?.momentumDays ?? 10);
  protected readonly signalDays = computed(() => this.store.trend()?.signalDays ?? 5);
  protected readonly reading = computed<TrendReading | null>(() => {
    const trend = this.store.trend();
    const at = this.marketTimestamp();
    return trend && at ? trendReadingFor(trend, this.symbol(), at) : null;
  });

  constructor() {
    effect(() => {
      if (this.store.status() === 'idle') {
        this.store.load().subscribe({ error: () => undefined });
      }
    });
  }

  protected title(call: TrendCall | null): string {
    return call === null
      ? 'No clear direction'
      : call === 'up'
        ? 'Consider buying'
        : 'Consider selling';
  }

  protected label(call: TrendCall): string {
    return call === 'up' ? 'Price higher' : 'Price lower';
  }

  protected accuracy(hits: number, days: number): number {
    return days ? hits / days : 0;
  }

  protected recentOldestFirst(r: TrendReading & { kind: 'ready' }) {
    return [...r.recent].reverse();
  }

  protected dotsLabel(r: TrendReading & { kind: 'ready' }): string {
    const hits = r.recent.filter((read) => read.hit).length;
    return `${hits} of the last ${r.recent.length} calls were right`;
  }

  protected meterLabel(probability: number): string {
    return `${Math.round(probability * 100)} percent chance the price is higher`;
  }
}
