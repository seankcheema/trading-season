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
import { PlatformSignalsService } from './platform-signals.service';
import { Call, MIN_RECORD_DAYS, RECORD_WINDOW, Reading, readingFor } from './platform-signals';

/**
 * The week-ahead volatility card for one instrument, built to be read in one
 * glance: bigger or smaller price swings likely over the next trading days, up
 * or down, with a row of recent hits and misses and one accuracy figure. The
 * proof (the numbers, the model against the recent pattern, every recent read)
 * sits behind a Details toggle. The headline goes to the model only where its
 * own track record on this stock beats the rule "next week like last week";
 * otherwise the rule's read leads. It is about how much the price may move,
 * never which way, and never a recommendation.
 */
@Component({
  selector: 'app-risk-outlook',
  imports: [DatePipe, PercentPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'risk-outlook' },
  template: `
    @switch (store.status()) {
      @case ('error') {
        <p class="text-loss text-xs" role="alert">Volatility outlook unavailable.</p>
        <button type="button" class="text-primary mt-2 text-xs" (click)="store.load().subscribe()">
          Retry outlook
        </button>
      }
      @case ('ready') {
        @if (reading(); as r) {
          @switch (r.kind) {
            @case ('unknown-symbol') {
              <p class="text-muted-foreground py-6 text-center text-sm">
                No outlook for {{ symbol() }}: the model does not cover this stock.
              </p>
            }
            @case ('too-early') {
              <p class="text-muted-foreground py-6 text-center text-sm">
                No outlook yet. The model needs this market's first months to learn from; readings
                start {{ r.firstDay }}.
              </p>
            }
            @case ('ready') {
              <section
                class="glance"
                [class.glance-bigger]="r.call === 'stormier'"
                [class.glance-smaller]="r.call === 'calmer'"
                data-testid="outlook-headline"
              >
                <svg class="glance-mark" viewBox="0 0 24 24" aria-hidden="true" fill="none">
                  <path
                    d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <h3 class="glance-title">{{ title(r.call) }}</h3>
                <p class="glance-sub" data-testid="outlook-direction">
                  Next {{ horizon() }} days · up or down, not a direction
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
                  <span class="glance-accuracy" data-testid="outlook-basis">
                    @if (leadDays(r)) {
                      Right {{ leadAccuracy(r) | percent: '1.0-0' }} of the last
                      {{ leadDays(r) }} weeks on {{ symbol() }}
                    } @else {
                      First reads on {{ symbol() }}; no record yet
                    }
                  </span>
                </div>
              </section>

              <button
                type="button"
                class="details-toggle"
                [attr.aria-expanded]="detailsOpen()"
                aria-controls="outlook-details"
                data-testid="outlook-toggle"
                (click)="detailsOpen.update((open) => !open)"
              >
                {{ detailsOpen() ? 'Hide details' : 'Details' }}
                <span aria-hidden="true">{{ detailsOpen() ? '▴' : '▾' }}</span>
              </button>

              @if (detailsOpen()) {
                <div id="outlook-details" class="details" data-testid="outlook-details">
                  <p class="text-sm">
                    Daily moves are likely to be
                    {{ r.call === 'stormier' ? 'larger' : 'smaller' }} than this stock's recent
                    normal of about {{ r.usualVolatility | percent: '1.1-1' }} a day. The last
                    {{ horizon() }} days averaged {{ r.recentVolatility | percent: '1.1-1' }}.
                  </p>

                  <section
                    class="meter-block"
                    aria-label="Model estimate"
                    data-testid="outlook-meter"
                  >
                    <div class="meter-labels">
                      <span>Smaller swings</span>
                      <span>Bigger swings</span>
                    </div>
                    <div class="meter" role="img" [attr.aria-label]="meterLabel(r.probability)">
                      <span class="meter-midline" aria-hidden="true"></span>
                      <span
                        class="meter-marker"
                        aria-hidden="true"
                        [style.left.%]="r.probability * 100"
                      ></span>
                    </div>
                    <p class="meter-caption">
                      Model estimate: {{ r.probability | percent: '1.0-0' }} chance of bigger
                      swings, in either direction
                    </p>
                  </section>

                  <dl class="outlook-grid mt-3">
                    <div
                      class="outlook-card read-tile"
                      [class.read-tile-shown]="r.source === 'model'"
                      data-testid="outlook-model"
                    >
                      <dt class="tile-label">
                        Trading Season model
                        @if (r.source === 'model') {
                          <span class="read-badge">leads</span>
                        }
                      </dt>
                      <dd
                        class="tile-call"
                        [class.text-loss]="r.modelCall === 'stormier'"
                        [class.text-gain]="r.modelCall === 'calmer'"
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
                    <div
                      class="outlook-card read-tile"
                      [class.read-tile-shown]="r.source === 'rule'"
                      data-testid="outlook-pattern"
                    >
                      <dt class="tile-label">
                        Recent pattern
                        @if (r.source === 'rule') {
                          <span class="read-badge">leads</span>
                        }
                      </dt>
                      <dd
                        class="tile-call"
                        [class.text-loss]="r.ruleCall === 'stormier'"
                        [class.text-gain]="r.ruleCall === 'calmer'"
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
                    Whichever has the better record on {{ symbol() }} over the last
                    {{ recordWindow }} closed weeks leads. As of the {{ r.asOf }} close.
                  </p>

                  <section class="mt-3" aria-label="Recent reads" data-testid="outlook-recent">
                    <h4 class="text-muted-foreground text-xs font-medium">
                      Recent reads and how they turned out
                    </h4>
                    @if (r.recent.length) {
                      <ul class="divide-border mt-1 divide-y text-xs">
                        @for (read of r.recent; track read.date) {
                          <li
                            class="flex items-center justify-between gap-2 py-1"
                            data-testid="outlook-read"
                          >
                            <span class="text-muted-foreground tabular-nums">
                              {{ read.date | date: 'MMM d' }}
                            </span>
                            <span class="min-w-0 flex-1 truncate">
                              {{ label(read.call) }}
                              <span class="text-muted-foreground">
                                ({{ read.source === 'model' ? 'model' : 'pattern' }})
                              </span>
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
                        No week has closed yet at this simulated date.
                      </p>
                    }
                  </section>
                </div>
              }
              <p class="text-muted-foreground mt-auto pt-3 text-xs">
                How much the price may move, not which way. Simulated market; never a recommendation
                to buy or sell.
              </p>
            }
          }
        }
      }
      @default {
        <span class="sr-only" role="status">Loading volatility outlook…</span>
        <div class="outlook-card glance-skeleton" aria-hidden="true">
          <span class="skeleton h-8 w-8 rounded-full"></span>
          <span class="skeleton mt-2 h-7 w-56"></span>
          <span class="skeleton mt-1.5 h-3 w-40"></span>
          <span class="skeleton mt-3 h-3 w-48"></span>
        </div>
      }
    }
  `,
  styleUrl: './outlook-card.css',
})
export class RiskOutlookComponent {
  readonly symbol = input.required<string>();
  readonly marketTimestamp = input.required<string>();
  protected readonly store = inject(PlatformSignalsService);
  protected readonly minRecord = MIN_RECORD_DAYS;
  protected readonly recordWindow = RECORD_WINDOW;
  protected readonly detailsOpen = signal(false);
  protected readonly horizon = computed(() => this.store.signals()?.horizonDays ?? 5);
  protected readonly reading = computed<Reading | null>(() => {
    const signals = this.store.signals();
    const at = this.marketTimestamp();
    return signals && at ? readingFor(signals, this.symbol(), at) : null;
  });

  constructor() {
    effect(() => {
      if (this.store.status() === 'idle') {
        this.store.load().subscribe({ error: () => undefined });
      }
    });
  }

  protected title(call: Call): string {
    return call === 'stormier' ? 'Bigger price swings likely' : 'Smaller price swings likely';
  }

  protected label(call: Call): string {
    return call === 'stormier' ? 'Bigger swings' : 'Smaller swings';
  }

  protected accuracy(hits: number, days: number): number {
    return days ? hits / days : 0;
  }

  /** The record behind the headline: the model's where it leads, otherwise the pattern's. */
  protected leadDays(r: Reading & { kind: 'ready' }): number {
    return r.source === 'model' ? r.modelDays : r.ruleDays;
  }

  protected leadAccuracy(r: Reading & { kind: 'ready' }): number {
    return r.source === 'model'
      ? this.accuracy(r.modelHits, r.modelDays)
      : this.accuracy(r.ruleHits, r.ruleDays);
  }

  /** The recent reads oldest first, so the dots read left to right like a timeline. */
  protected recentOldestFirst(r: Reading & { kind: 'ready' }) {
    return [...r.recent].reverse();
  }

  protected dotsLabel(r: Reading & { kind: 'ready' }): string {
    const hits = r.recent.filter((read) => read.hit).length;
    return `Last ${r.recent.length} reads: ${hits} correct, ${r.recent.length - hits} missed`;
  }

  protected meterLabel(probability: number): string {
    return `Model estimate: ${Math.round(probability * 100)} percent chance of bigger swings`;
  }
}
