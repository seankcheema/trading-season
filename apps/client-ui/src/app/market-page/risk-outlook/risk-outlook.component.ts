import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { DatePipe, PercentPipe } from '@angular/common';
import { PlatformSignalsService } from './platform-signals.service';
import { MIN_RECORD_DAYS, Reading, readingFor, recordLabel } from './platform-signals';

/**
 * The week-ahead risk card for one instrument: will the next trading days be
 * more volatile than usual for this stock? It reads the platform signal file
 * and shows the model's call only where the model's own track record on this
 * stock beats the rule "next week like last week"; otherwise it shows the
 * rule's call and says so. It never recommends a trade.
 */
@Component({
  selector: 'app-risk-outlook',
  imports: [DatePipe, PercentPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'risk-outlook' },
  template: `
    @switch (store.status()) {
      @case ('error') {
        <p class="text-loss text-xs" role="alert">Risk outlook unavailable.</p>
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
              <div class="outlook-card outlook-headline" data-testid="outlook-headline">
                <p class="text-muted-foreground text-xs">Next {{ horizon() }} trading days</p>
                <p
                  class="text-lg font-semibold"
                  [class.text-loss]="r.call === 'stormier'"
                  [class.text-gain]="r.call === 'calmer'"
                >
                  {{ r.call === 'stormier' ? 'Stormier' : 'Calmer' }} than usual
                </p>
                <p class="text-muted-foreground text-xs" data-testid="outlook-basis">
                  @if (r.source === 'model') {
                    Headline from the platform model: its record on {{ symbol() }} beats the recent
                    pattern.
                  } @else {
                    Headline from the recent pattern: the platform model has not beaten it on
                    {{ symbol() }} yet.
                  }
                </p>
              </div>
              <dl class="outlook-grid mt-2">
                <div
                  class="outlook-card read-tile"
                  [class.read-tile-shown]="r.source === 'model'"
                  data-testid="outlook-model"
                >
                  <dt class="text-muted-foreground text-xs">
                    Platform model
                    @if (r.source === 'model') {
                      <span class="read-badge">shown</span>
                    }
                  </dt>
                  <dd
                    class="text-base font-semibold capitalize"
                    [class.text-loss]="r.modelCall === 'stormier'"
                    [class.text-gain]="r.modelCall === 'calmer'"
                  >
                    {{ r.modelCall }}
                  </dd>
                  <dd class="text-muted-foreground text-xs">
                    {{ r.probability | percent: '1.0-0' }} chance of stormier
                    @if (r.modelDays >= minRecord) {
                      · right {{ recordLabel(r.modelHits, r.modelDays) }}
                    } @else {
                      · {{ r.modelDays }} of {{ minRecord }} weeks of record
                    }
                  </dd>
                </div>
                <div
                  class="outlook-card read-tile"
                  [class.read-tile-shown]="r.source === 'rule'"
                  data-testid="outlook-pattern"
                >
                  <dt class="text-muted-foreground text-xs">
                    Recent pattern
                    @if (r.source === 'rule') {
                      <span class="read-badge">shown</span>
                    }
                  </dt>
                  <dd
                    class="text-base font-semibold capitalize"
                    [class.text-loss]="r.ruleCall === 'stormier'"
                    [class.text-gain]="r.ruleCall === 'calmer'"
                  >
                    {{ r.ruleCall }}
                  </dd>
                  <dd class="text-muted-foreground text-xs">
                    next week like last · right {{ recordLabel(r.ruleHits, r.ruleDays) }}
                  </dd>
                </div>
              </dl>
              <dl class="outlook-grid mt-2">
                <div class="outlook-card metric-tile">
                  <dt class="text-muted-foreground text-xs">Usual daily move</dt>
                  <dd class="text-base font-semibold tabular-nums">
                    {{ r.usualVolatility | percent: '1.1-1' }}
                  </dd>
                </div>
                <div class="outlook-card metric-tile">
                  <dt class="text-muted-foreground text-xs">Last {{ horizon() }} days</dt>
                  <dd class="text-base font-semibold tabular-nums">
                    {{ r.recentVolatility | percent: '1.1-1' }}
                  </dd>
                </div>
              </dl>
              <p class="text-muted-foreground mt-2 text-xs">As of the {{ r.asOf }} close.</p>
              <section class="mt-3" aria-label="Recent reads" data-testid="outlook-recent">
                <h3 class="text-muted-foreground text-xs font-medium">
                  Recent reads, once their week had closed
                </h3>
                @if (r.recent.length) {
                  <ul class="mt-1 divide-y divide-border text-xs">
                    @for (read of r.recent; track read.date) {
                      <li
                        class="flex items-center justify-between gap-2 py-1"
                        data-testid="outlook-read"
                      >
                        <span class="text-muted-foreground tabular-nums">{{
                          read.date | date: 'MMM d'
                        }}</span>
                        <span class="min-w-0 flex-1 truncate capitalize">
                          {{ read.call }}
                          <span class="text-muted-foreground normal-case">
                            ({{ read.source === 'model' ? 'model' : 'pattern' }})
                          </span>
                        </span>
                        <span
                          class="font-medium"
                          [class.text-gain]="read.hit"
                          [class.text-loss]="!read.hit"
                        >
                          {{ read.hit ? 'came true' : 'did not' }}
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
                A read on how much this stock may move, not on which way. Simulated market; this is
                never a recommendation to buy or sell.
              </p>
            }
          }
        }
      }
      @default {
        <span class="sr-only" role="status">Loading risk outlook…</span>
        <div class="outlook-card" aria-hidden="true">
          <span class="skeleton h-3 w-28"></span>
          <span class="skeleton mt-1.5 h-6 w-40"></span>
          <span class="skeleton mt-1.5 h-3 w-full"></span>
        </div>
        <div class="outlook-grid mt-2" aria-hidden="true">
          <span class="skeleton h-14 w-full"></span>
          <span class="skeleton h-14 w-full"></span>
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
    .outlook-headline {
      padding: 0.6rem 0.75rem;
    }
    .outlook-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: stretch;
      gap: 0.4rem;
    }
    .metric-tile dd {
      overflow-wrap: anywhere;
    }
    .read-tile {
      gap: 0.1rem;
    }
    .read-tile-shown {
      border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
      background: color-mix(in srgb, var(--primary) 5%, transparent);
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
  protected readonly recordLabel = recordLabel;
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
}
