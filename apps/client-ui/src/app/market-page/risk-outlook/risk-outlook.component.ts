import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { PercentPipe } from '@angular/common';
import { PlatformSignalsService } from './platform-signals.service';
import { Reading, readingFor, recordLabel } from './platform-signals';

/**
 * The week-ahead risk card for one instrument: will the next trading days be
 * more volatile than usual for this stock? It reads the platform signal file
 * and shows the model's call only where the model's own track record on this
 * stock beats the rule "next week like last week"; otherwise it shows the
 * rule's call and says so. It never recommends a trade.
 */
@Component({
  selector: 'app-risk-outlook',
  imports: [PercentPipe],
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
              <div class="overview-card outlook-headline" data-testid="outlook-headline">
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
                    Platform model, right {{ recordLabel(r.modelHits, r.modelDays) }} times so far
                    on {{ symbol() }}, against {{ recordLabel(r.ruleHits, r.ruleDays) }} for
                    assuming last week repeats.
                  } @else {
                    Recent pattern. The platform model has not beaten it on {{ symbol() }}
                    @if (recordLabel(r.modelDays, r.modelDays)) {
                      ({{ recordLabel(r.modelHits, r.modelDays) }} right, against
                      {{ recordLabel(r.ruleHits, r.ruleDays) }} for the pattern)
                    }
                    so the pattern is shown.
                  }
                </p>
              </div>
              <dl class="account-value-balances mt-2">
                <div class="overview-card account-balance-card">
                  <dt class="text-muted-foreground text-xs">Usual daily move</dt>
                  <dd class="text-base font-semibold tabular-nums">
                    {{ r.usualVolatility | percent: '1.1-1' }}
                  </dd>
                </div>
                <div class="overview-card account-balance-card">
                  <dt class="text-muted-foreground text-xs">Last {{ horizon() }} days</dt>
                  <dd class="text-base font-semibold tabular-nums">
                    {{ r.recentVolatility | percent: '1.1-1' }}
                  </dd>
                </div>
              </dl>
              <p class="text-muted-foreground mt-2 text-xs">
                Model probability of a stormier week: {{ r.probability | percent: '1.0-0' }}. As of
                the {{ r.asOf }} close.
              </p>
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
        <div class="overview-card" aria-hidden="true">
          <span class="skeleton h-3 w-28"></span>
          <span class="skeleton mt-1.5 h-6 w-40"></span>
          <span class="skeleton mt-1.5 h-3 w-full"></span>
        </div>
        <div class="account-value-balances mt-2" aria-hidden="true">
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
    .outlook-headline {
      display: grid;
      gap: 0.15rem;
      padding: 0.6rem 0.75rem;
    }
  `,
})
export class RiskOutlookComponent {
  readonly symbol = input.required<string>();
  readonly marketTimestamp = input.required<string>();
  protected readonly store = inject(PlatformSignalsService);
  protected readonly recordLabel = recordLabel;
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
