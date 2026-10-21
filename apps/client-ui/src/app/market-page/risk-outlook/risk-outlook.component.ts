import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { DatePipe, PercentPipe } from '@angular/common';
import { PlatformSignalsService } from './platform-signals.service';
import { Call, MIN_RECORD_DAYS, Reading, readingFor } from './platform-signals';

/**
 * The week-ahead volatility card for one instrument, in a user's words: should
 * they expect bigger or smaller price swings over the next trading days than
 * this stock's recent normal? It reads the platform signal file and gives the
 * headline to the model only where the model's own track record on this stock
 * beats the rule "next week like last week"; otherwise the rule's read leads and
 * the model's sits beside it. It is about how much the price may move, never
 * which way, and never a recommendation.
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
                class="headline"
                [class.headline-bigger]="r.call === 'stormier'"
                [class.headline-smaller]="r.call === 'calmer'"
                data-testid="outlook-headline"
              >
                <p class="headline-kicker">Next {{ horizon() }} trading days · {{ symbol() }}</p>
                <h3 class="headline-title">Expect {{ swings(r.call) }} price swings</h3>
                <p class="headline-detail">
                  Daily moves are likely to be
                  {{ r.call === 'stormier' ? 'larger' : 'smaller' }} than this stock's recent normal
                  of about {{ r.usualVolatility | percent: '1.1-1' }} a day. The last
                  {{ horizon() }} days averaged {{ r.recentVolatility | percent: '1.1-1' }}.
                </p>
                <p class="headline-source" data-testid="outlook-basis">
                  @if (r.source === 'model') {
                    Based on the Trading Season model, accuracy so far
                    {{ accuracy(r.modelHits, r.modelDays) | percent: '1.0-0' }} on {{ symbol() }}.
                  } @else {
                    Based on the recent pattern, accuracy so far
                    {{ accuracy(r.ruleHits, r.ruleDays) | percent: '1.0-0' }} on {{ symbol() }}.
                  }
                </p>
              </section>

              <section class="meter-block" aria-label="Model estimate" data-testid="outlook-meter">
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
                  Model estimate: {{ r.probability | percent: '1.0-0' }} chance of bigger swings
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
                      Accuracy so far
                      {{ accuracy(r.modelHits, r.modelDays) | percent: '1.0-0' }} ({{
                        r.modelHits
                      }}
                      of {{ r.modelDays }} weeks)
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
                    Accuracy so far {{ accuracy(r.ruleHits, r.ruleDays) | percent: '1.0-0' }} ({{
                      r.ruleHits
                    }}
                    of {{ r.ruleDays }} weeks)
                  </dd>
                </div>
              </dl>
              <p class="text-muted-foreground mt-2 text-xs">
                Whichever has the better record on {{ symbol() }} leads. As of the
                {{ r.asOf }} close.
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
              <p class="text-muted-foreground mt-auto pt-3 text-xs">
                This is about how much the price may move, not which way. Simulated market; never a
                recommendation to buy or sell.
              </p>
            }
          }
        }
      }
      @default {
        <span class="sr-only" role="status">Loading volatility outlook…</span>
        <div class="outlook-card" aria-hidden="true">
          <span class="skeleton h-3 w-28"></span>
          <span class="skeleton mt-1.5 h-7 w-48"></span>
          <span class="skeleton mt-1.5 h-3 w-full"></span>
        </div>
        <div class="outlook-grid mt-3" aria-hidden="true">
          <span class="skeleton h-16 w-full"></span>
          <span class="skeleton h-16 w-full"></span>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      min-height: 0;
      flex: 1;
      flex-direction: column;
    }
    /* The market page's card classes are scoped to that component, so the card styles its own. */
    .outlook-card {
      display: grid;
      min-width: 0;
      align-content: start;
      gap: 0.15rem;
      border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
      border-radius: 0.55rem;
      background: color-mix(in srgb, var(--foreground) 1.8%, transparent);
      padding: 0.45rem 0.65rem;
    }
    .headline {
      display: grid;
      gap: 0.3rem;
      border: 1px solid var(--border);
      border-radius: 0.7rem;
      padding: 0.8rem 0.9rem;
    }
    .headline-bigger {
      border-color: color-mix(in srgb, var(--color-loss) 45%, var(--border));
      background: color-mix(in srgb, var(--color-loss) 12%, transparent);
    }
    .headline-smaller {
      border-color: color-mix(in srgb, var(--color-gain) 45%, var(--border));
      background: color-mix(in srgb, var(--color-gain) 12%, transparent);
    }
    .headline-kicker {
      color: var(--muted-foreground);
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .headline-title {
      font-size: 1.25rem;
      font-weight: 700;
      line-height: 1.2;
    }
    .headline-bigger .headline-title {
      color: var(--color-loss);
    }
    .headline-smaller .headline-title {
      color: var(--color-gain);
    }
    .headline-detail {
      font-size: 0.8125rem;
      line-height: 1.35;
    }
    .headline-source {
      color: var(--muted-foreground);
      font-size: 0.75rem;
    }
    .meter-block {
      margin-top: 0.75rem;
    }
    .meter-labels {
      display: flex;
      justify-content: space-between;
      color: var(--muted-foreground);
      font-size: 0.6875rem;
    }
    .meter {
      position: relative;
      margin-top: 0.25rem;
      height: 0.5rem;
      border-radius: 999px;
      background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--color-gain) 55%, transparent),
        color-mix(in srgb, var(--muted-foreground) 30%, transparent) 50%,
        color-mix(in srgb, var(--color-loss) 55%, transparent)
      );
    }
    .meter-midline {
      position: absolute;
      top: -0.2rem;
      bottom: -0.2rem;
      left: 50%;
      width: 1px;
      background: color-mix(in srgb, var(--foreground) 40%, transparent);
    }
    .meter-marker {
      position: absolute;
      top: 50%;
      width: 0.9rem;
      height: 0.9rem;
      border: 2px solid var(--background);
      border-radius: 999px;
      background: var(--foreground);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--foreground) 30%, transparent);
      transform: translate(-50%, -50%);
    }
    .meter-caption {
      margin-top: 0.35rem;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .outlook-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: stretch;
      gap: 0.4rem;
    }
    .read-tile {
      gap: 0.1rem;
    }
    .read-tile-shown {
      border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
      background: color-mix(in srgb, var(--primary) 5%, transparent);
    }
    .tile-label {
      color: var(--muted-foreground);
      font-size: 0.6875rem;
    }
    .tile-call {
      font-size: 1rem;
      font-weight: 700;
    }
    .tile-note {
      color: var(--muted-foreground);
      font-size: 0.6875rem;
      overflow-wrap: anywhere;
    }
    .read-badge {
      margin-left: 0.3rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--primary) 15%, transparent);
      padding: 0.05rem 0.4rem;
      color: var(--primary);
      font-size: 0.625rem;
      font-weight: 600;
    }
  `,
})
export class RiskOutlookComponent {
  readonly symbol = input.required<string>();
  readonly marketTimestamp = input.required<string>();
  protected readonly store = inject(PlatformSignalsService);
  protected readonly minRecord = MIN_RECORD_DAYS;
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

  /** "bigger" or "smaller", the user's words for the two calls. */
  protected swings(call: Call): 'bigger' | 'smaller' {
    return call === 'stormier' ? 'bigger' : 'smaller';
  }

  protected label(call: Call): string {
    return call === 'stormier' ? 'Bigger swings' : 'Smaller swings';
  }

  protected accuracy(hits: number, days: number): number {
    return days ? hits / days : 0;
  }

  protected meterLabel(probability: number): string {
    return `Model estimate: ${Math.round(probability * 100)} percent chance of bigger swings`;
  }
}
