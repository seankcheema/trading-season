import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy } from '@ng-icons/lucide';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AuditEvent, OrderDetail, OrderStatus } from '../reporting/console.models';
import { count, daySeconds, dollars, fullStamp, signedDollars } from '../reporting/format';
import { ReportingApiService } from '../reporting/reporting-api.service';
import { ChangePillComponent, statusTone } from '../shared/change-pill.component';
import { copyText } from '../shared/clipboard';
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

// The two ids the dialog offers to copy.
type Copied = 'reference' | 'order';

// How long a copy button says it copied.
export const COPIED_NOTE_MS = 2000;

// "BR-09: insufficient funds for this order" reads better without its rule number.
export function plainReason(reason: string | null): string {
  return (reason ?? '').replace(/^BR-\d+:\s*/, '');
}

function signedShares(value: number): string {
  return `${value >= 0 ? '+' : '-'}${count(Math.abs(value))} sh`;
}

// One order in full: who placed it, how it executed and what it did to cash and
// holdings on the left; its audit trail with the price at each stage, and under
// it the ids that tie it to the ledger, on the right.
@Component({
  selector: 'app-order-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, ChangePillComponent, DialogComponent],
  providers: [provideIcons({ lucideCheck, lucideCopy })],
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
                  <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
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
                </div>
              }
            </div>

            <div class="flex min-w-0 flex-col gap-3 self-start">
              <div class="section">
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
                        <!-- The stage and when it was recorded on the left, the price it was recorded at on the right. -->
                        <span class="flex min-w-0 justify-between gap-3">
                          <span class="min-w-0">
                            <span class="block text-[13px] font-medium tracking-[0.02em]">
                              {{ event.eventType }}
                            </span>
                            <span class="text-muted-foreground block text-xs tabular-nums">
                              {{ daySeconds(event.recordedAt) }}{{ event.detail ? ' · ' + event.detail : '' }}
                            </span>
                          </span>
                          @if (event.price !== null) {
                            <span class="shrink-0 text-right" data-stage-price>
                              <span class="block text-[13px] tabular-nums">{{ dollars(event.price) }}</span>
                              <span class="text-muted-foreground block text-xs">{{ priceKind(event) }}</span>
                            </span>
                          }
                        </span>
                      </li>
                    }
                  </ol>
                } @else {
                  <p class="text-muted-foreground text-sm">No audit events were recorded.</p>
                }
              </div>

              <div class="section">
                <h3 class="dash-label mb-3">References</h3>
                <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <!-- The reference has a row to itself, so a UUID is shown whole. -->
                  <div class="col-span-2 min-w-0">
                    <dt class="flex items-center justify-between gap-2">
                      <span class="dash-label text-[11px]">Client reference</span>
                      <button
                        type="button"
                        class="ghost-button is-small shrink-0"
                        aria-label="Copy client reference"
                        (click)="copy('reference', order.clientReference)"
                      >
                        <ng-icon [name]="copied() === 'reference' ? 'lucideCheck' : 'lucideCopy'" size="14" />
                        {{ copied() === 'reference' ? 'Copied' : 'Copy' }}
                      </button>
                    </dt>
                    <dd class="mt-1 break-all tabular-nums select-all" data-reference>
                      {{ order.clientReference }}
                    </dd>
                  </div>
                  @for (fact of references(); track fact.label) {
                    <div class="min-w-0">
                      <dt class="dash-label text-[11px]">{{ fact.label }}</dt>
                      <dd class="mt-1 truncate tabular-nums" [title]="fact.value">{{ fact.value }}</dd>
                    </div>
                  }
                </dl>
                <button
                  type="button"
                  class="ghost-button is-small mt-3"
                  (click)="copy('order', order.orderId.toString())"
                >
                  <ng-icon [name]="copied() === 'order' ? 'lucideCheck' : 'lucideCopy'" size="14" />
                  {{ copied() === 'order' ? 'Copied' : 'Copy order ID' }}
                </button>
                <span class="sr-only" aria-live="polite">{{ copied() ? 'Copied to the clipboard' : '' }}</span>
              </div>
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
  // Which id was just copied, for as long as its button says so.
  protected readonly copied = signal<Copied | null>(null);
  private _copiedTimer?: ReturnType<typeof setTimeout>;

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
    inject(DestroyRef).onDestroy(() => clearTimeout(this._copiedTimer));
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
    const facts = (title: string, list: Fact[], aside = '') => ({ title, facts: list, aside });
    return [
      facts('Customer', [
        { label: 'Name', value: order.userName },
        { label: 'Email', value: order.userEmail ?? '—' },
        { label: 'Account', value: order.accountName },
      ]),
      facts('Execution', [
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
    ];
  });

  // The ids beside the client reference, which is shown whole with its own copy button.
  protected readonly references = computed<Fact[]>(() => {
    const { type, ledger } = this.loaded().order!;
    return [
      { label: 'Order type', value: type },
      {
        label: 'Cash transaction',
        value: ledger.cashTransactionId === null ? '—' : `#${ledger.cashTransactionId}`,
      },
      {
        label: 'Holding movement',
        value: ledger.holdingMovementId === null ? '—' : `#${ledger.holdingMovementId}`,
      },
    ];
  });

  protected readonly count = count;
  protected readonly dollars = dollars;
  protected readonly daySeconds = daySeconds;
  protected readonly fullStamp = fullStamp;
  protected readonly statusTone = statusTone;

  // What the price beside an audit entry is.
  protected priceKind(event: AuditEvent): string {
    return event.priceKind === 'FILL' ? 'fill price' : 'indicative';
  }

  // Red for a failure, green for a fill, cyan for a step on the way.
  protected eventColor(eventType: string): string {
    if (/FAIL|REJECT/.test(eventType)) {
      return 'bg-loss';
    }
    return eventType === 'FILLED' ? 'bg-gain' : 'bg-primary';
  }

  protected copy(what: Copied, text: string): void {
    void copyText(text).then((done) => {
      if (!done) {
        return;
      }
      this.copied.set(what);
      clearTimeout(this._copiedTimer);
      this._copiedTimer = setTimeout(() => this.copied.set(null), COPIED_NOTE_MS);
    });
  }
}
