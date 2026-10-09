import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCopy } from '@ng-icons/lucide';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { OrderDetail, OrderStatus } from '../reporting/console.models';
import { count, daySeconds, dollars, fullStamp, signedDollars } from '../reporting/format';
import { ReportingApiService } from '../reporting/reporting-api.service';
import { ChangePillComponent, statusTone } from '../shared/change-pill.component';
import { DialogComponent } from '../shared/dialog.component';

// What each status means for the ledger.
const STATUS_NOTES: Record<OrderStatus, string> = {
  FILLED: 'Executed at the market quote; holdings and cash posted.',
  PENDING: 'Submitted and waiting to be validated.',
  ACCEPTED: 'Validated and waiting for a market quote.',
  REJECTED: 'Failed validation; no fill, cash or holdings were posted.',
};

// A labelled value in a section; tone colors the value.
interface Fact {
  label: string;
  value: string;
  tone?: 'gain' | 'loss';
}

interface Loaded {
  state: 'loading' | 'error' | 'ready';
  order?: OrderDetail;
}

// "BR-09: insufficient funds for this order" reads better without its rule number.
export function plainReason(reason: string | null): string {
  return (reason ?? '').replace(/^BR-\d+:\s*/, '');
}

function signedShares(value: number): string {
  return `${value >= 0 ? '+' : '-'}${count(Math.abs(value))} sh`;
}

// One order in full: who placed it, how it executed, what it did to cash and
// holdings, the ids that tie it to the ledger, and its audit trail.
@Component({
  selector: 'app-order-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, ChangePillComponent, DialogComponent],
  providers: [provideIcons({ lucideCopy })],
  styles: `
    .section {
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1rem;
    }
  `,
  template: `
    <app-dialog
      [title]="'Order #' + orderId()"
      [width]="960"
      closeLabel="Close order detail"
      (closed)="closed.emit()"
    >
      @switch (loaded().state) {
        @case ('loading') {
          <p class="text-muted-foreground text-sm" aria-busy="true">Loading the order…</p>
        }
        @case ('error') {
          <p class="text-sm" role="alert">We couldn't load this order.</p>
        }
        @case ('ready') {
          @let order = loaded().order!;
          <div class="mb-4 flex flex-wrap items-center gap-4">
            <div
              class="bg-primary/15 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl text-xs font-semibold"
              aria-hidden="true"
            >
              {{ order.symbol.slice(0, 4) }}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-xl font-semibold tracking-tight capitalize">
                  {{ order.side.toLowerCase() }} {{ count(order.quantity) }} {{ order.symbol }}
                </span>
                <app-change-pill tag [tone]="statusTone(order.status)">
                  {{ order.status.toLowerCase() }}
                </app-change-pill>
              </div>
              <div class="text-muted-foreground text-xs">
                {{ order.instrumentName }} · {{ order.type.toLowerCase() }} order ·
                {{ fullStamp(order.submittedAt) }}
              </div>
            </div>
            <div class="ml-auto text-right">
              <div class="dash-label text-[11px]">{{ valueLabel() }}</div>
              <div class="text-2xl font-semibold tracking-tight tabular-nums">{{ value() }}</div>
            </div>
          </div>

          <p
            role="status"
            class="mb-4 rounded-[5px] px-3 py-2 text-sm"
            [class]="order.status === 'REJECTED' ? 'bg-loss/10 text-loss' : 'bg-muted'"
          >
            {{ note() }}
          </p>

          <div class="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div class="flex min-w-0 flex-col gap-3">
              @for (section of sections(); track section.title) {
                <div class="section">
                  <div class="mb-3 flex items-center justify-between">
                    <h3 class="dash-label">{{ section.title }}</h3>
                    @if (section.aside) {
                      <span class="text-muted-foreground text-xs">{{ section.aside }}</span>
                    }
                  </div>
                  <dl
                    class="grid gap-x-4 gap-y-3 text-sm"
                    [class]="section.columns === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'"
                  >
                    @for (fact of section.facts; track fact.label) {
                      <div class="min-w-0">
                        <dt class="dash-label text-[11px]">{{ fact.label }}</dt>
                        <dd
                          class="mt-1 truncate tabular-nums"
                          [class.text-gain]="fact.tone === 'gain'"
                          [class.text-loss]="fact.tone === 'loss'"
                          [title]="fact.value"
                        >
                          {{ fact.value }}
                        </dd>
                      </div>
                    }
                  </dl>
                  @if (section.title === 'References') {
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        class="ghost-button is-small"
                        (click)="copy(order.clientReference)"
                      >
                        <ng-icon name="lucideCopy" size="14" />Copy reference
                      </button>
                      <button
                        type="button"
                        class="ghost-button is-small"
                        (click)="copy(order.orderId.toString())"
                      >
                        <ng-icon name="lucideCopy" size="14" />Copy order ID
                      </button>
                    </div>
                  }
                </div>
              }
            </div>

            <div class="section self-start">
              <div class="mb-3 flex items-center justify-between">
                <h3 class="dash-label">Audit trail</h3>
                <span class="text-muted-foreground text-xs">audit_trail</span>
              </div>
              @if (order.audit.length) {
                <ol>
                  @for (event of order.audit; track $index; let last = $last) {
                    <li class="relative grid grid-cols-[16px_1fr] gap-3" [class]="last ? '' : 'pb-3.5'">
                      @if (!last) {
                        <span class="bg-border absolute top-3.5 bottom-0 left-[7px] w-px"></span>
                      }
                      <span
                        class="ring-card mt-1 ml-[3px] size-[9px] rounded-full ring-[3px]"
                        [class]="eventColor(event.eventType)"
                      ></span>
                      <span>
                        <span class="block text-[13px] font-medium tracking-[0.02em]">
                          {{ event.eventType }}
                        </span>
                        <span class="text-muted-foreground block text-xs tabular-nums">
                          {{ daySeconds(event.recordedAt) }}{{ event.detail ? ' · ' + event.detail : '' }}
                        </span>
                      </span>
                    </li>
                  }
                </ol>
              } @else {
                <p class="text-muted-foreground text-sm">No audit events were recorded.</p>
              }
            </div>
          </div>
        }
      }
    </app-dialog>
  `,
})
export class OrderDetailComponent {
  private readonly _api = inject(ReportingApiService);

  readonly orderId = input.required<number>();
  readonly closed = output<void>();

  protected readonly loaded = signal<Loaded>({ state: 'loading' });

  constructor() {
    toObservable(this.orderId)
      .pipe(
        switchMap((orderId) =>
          this._api.order(orderId).pipe(
            map((order): Loaded => ({ state: 'ready', order })),
            catchError(() => of<Loaded>({ state: 'error' })),
            startWith<Loaded>({ state: 'loading' }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((loaded) => this.loaded.set(loaded));
  }

  // What the order was worth: at its fill price, or at the price it asked for.
  protected readonly value = computed(() => {
    const order = this.loaded().order;
    const price = order?.price ?? order?.indicativePrice ?? null;
    return order && price !== null ? dollars(order.quantity * price) : '—';
  });

  protected readonly valueLabel = computed(() => {
    const order = this.loaded().order;
    if (order?.status !== 'FILLED') {
      return 'Est. value';
    }
    return order.side === 'BUY' ? 'Cost' : 'Proceeds';
  });

  protected readonly note = computed(() => {
    const order = this.loaded().order!;
    const reason = plainReason(order.rejectionReason);
    return `${reason ? `Rejected: ${reason}. ` : ''}${STATUS_NOTES[order.status]}`;
  });

  protected readonly sections = computed(() => {
    const order = this.loaded().order!;
    const { ledger, fill } = order;
    const money = (value: number | null) => (value === null ? '—' : dollars(value));
    const slippage =
      fill && order.indicativePrice !== null ? fill.price - order.indicativePrice : null;
    const facts = (title: string, columns: 2 | 3, list: Fact[], aside = '') => ({
      title,
      columns,
      facts: list,
      aside,
    });
    return [
      facts('Customer', 3, [
        { label: 'Name', value: order.userName },
        { label: 'Email', value: order.userEmail ?? '—' },
        { label: 'Account', value: order.accountName },
      ]),
      facts('Execution', 3, [
        { label: 'Quantity', value: count(order.quantity) },
        { label: 'Fill price', value: money(order.price) },
        { label: 'Fill ID', value: fill ? `#${fill.fillId}` : '—' },
        { label: 'Indicative price', value: money(order.indicativePrice) },
        {
          label: 'Price buffer',
          value: order.bufferPercent === null ? '—' : `${order.bufferPercent.toFixed(2)}%`,
        },
        { label: 'Slippage', value: slippage === null ? '—' : signedDollars(slippage) },
        { label: 'Submitted', value: daySeconds(order.submittedAt) },
        { label: 'Resolved', value: daySeconds(order.resolvedAt) },
        { label: 'Market time', value: daySeconds(order.simulatedAt) },
      ]),
      facts(
        'Ledger impact',
        3,
        [
          { label: 'Cash before', value: dollars(ledger.cashBefore) },
          {
            label: 'Cash change',
            value: ledger.cashChange === null ? '—' : signedDollars(ledger.cashChange),
            tone: ledger.cashChange === null ? undefined : ledger.cashChange < 0 ? 'loss' : 'gain',
          },
          { label: 'Cash after', value: dollars(ledger.cashAfter) },
          { label: `${order.symbol} before`, value: `${count(ledger.holdingBefore)} sh` },
          {
            label: 'Holding change',
            value: ledger.holdingChange === null ? '—' : signedShares(ledger.holdingChange),
          },
          { label: `${order.symbol} after`, value: `${count(ledger.holdingAfter)} sh` },
        ],
        fill ? '' : 'Nothing posted',
      ),
      facts('References', 2, [
        { label: 'Client reference', value: order.clientReference },
        { label: 'Order type', value: order.type },
        {
          label: 'Cash transaction',
          value: ledger.cashTransactionId === null ? '—' : `#${ledger.cashTransactionId}`,
        },
        {
          label: 'Holding movement',
          value: ledger.holdingMovementId === null ? '—' : `#${ledger.holdingMovementId}`,
        },
      ]),
    ];
  });

  protected readonly count = count;
  protected readonly daySeconds = daySeconds;
  protected readonly fullStamp = fullStamp;
  protected readonly statusTone = statusTone;

  // Red for a failure, green for a fill, cyan for a step on the way.
  protected eventColor(eventType: string): string {
    if (/FAIL|REJECT/.test(eventType)) {
      return 'bg-loss';
    }
    return eventType === 'FILLED' ? 'bg-gain' : 'bg-primary';
  }

  protected copy(text: string): void {
    void navigator.clipboard?.writeText(text);
  }
}
