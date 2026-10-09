import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideCircleAlert, lucideLock } from '@ng-icons/lucide';
import { first, switchMap } from 'rxjs';
import { dayClock, dollars, longDay, recent, wholeDollars } from '../reporting/format';
import { ReportingApiService } from '../reporting/reporting-api.service';
import { OrderDetailComponent } from '../orders/order-detail.component';
import { OrderTableComponent } from '../orders/order-table.component';
import { ChangePillComponent, statusTone } from '../shared/change-pill.component';
import { ExportMenuComponent } from '../shared/export-menu.component';
import { live } from '../shared/live';
import { FAILED_SIGN_IN_WARNING, initials, titleCase } from './customers.component';

// How often the customer is read again.
export const CUSTOMER_REFRESH_MS = 30_000;

// One customer: profile, sign-in security, balances, and their orders. Read
// only: a locked account is shown as locked, with when it unlocks.
@Component({
  selector: 'app-customer-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NgIcon,
    ChangePillComponent,
    ExportMenuComponent,
    OrderTableComponent,
    OrderDetailComponent,
  ],
  providers: [provideIcons({ lucideChevronLeft, lucideCircleAlert, lucideLock })],
  host: { class: 'flex flex-1 basis-0 flex-col gap-3 lg:min-h-[44rem]' },
  template: `
    @switch (detail.state()) {
      @case ('loading') {
        <section class="dash-card mt-4 p-5" aria-busy="true">
          <p class="text-muted-foreground text-sm">Loading the customer…</p>
        </section>
      }
      @case ('error') {
        <section
          class="dash-card mt-4 flex flex-col items-center gap-3 px-5 py-14 text-center"
          role="alert"
        >
          <ng-icon name="lucideCircleAlert" size="24" class="text-loss" />
          <p class="text-sm">We couldn't load this customer.</p>
          <div class="flex gap-2">
            <a class="ghost-button" routerLink="/customers">Back to customers</a>
            <button type="button" class="ghost-button" (click)="detail.reload()">Try again</button>
          </div>
        </section>
      }
      @case ('ready') {
        @let customer = detail.data()!;
        <header class="flex min-h-16 shrink-0 flex-wrap items-center gap-3 py-3">
          <a
            class="ghost-button is-icon"
            routerLink="/customers"
            aria-label="Back to customers"
            data-print-hide="true"
          >
            <ng-icon name="lucideChevronLeft" size="16" />
          </a>
          <span
            class="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            aria-hidden="true"
          >
            {{ initials(customer.name) }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h1 class="truncate text-xl font-semibold tracking-tight">{{ customer.name }}</h1>
              <app-change-pill tag [tone]="statusTone(customer.status)">
                {{ customer.status.toLowerCase() }}
              </app-change-pill>
            </div>
            <p class="text-muted-foreground mt-0.5 truncate text-xs">
              {{ customer.email }} · {{ customer.userId }} · {{ customer.role.toLowerCase() }}
            </p>
          </div>
          <app-export-menu [csv]="false" />
        </header>

        @if (customer.status === 'LOCKED') {
          <div
            role="status"
            class="border-loss/30 bg-loss/10 flex shrink-0 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm"
          >
            <ng-icon name="lucideLock" size="16" class="text-loss shrink-0" />
            <span class="flex-1">
              Account locked after {{ customer.failedAttempts }} failed sign-in attempts. Unlocks
              automatically {{ dayClock(customer.lockedUntil) }}.
            </span>
          </div>
        }

        <div class="grid shrink-0 gap-3 lg:grid-cols-3">
          @for (card of cards(); track card.title) {
            <section class="dash-card p-5">
              <h2 class="text-sm font-semibold">{{ card.title }}</h2>
              <dl class="mt-4 grid grid-cols-2 gap-y-3.5">
                @for (fact of card.facts; track fact.label) {
                  <div>
                    <dt class="dash-label text-[11px]">{{ fact.label }}</dt>
                    <dd class="mt-1 text-sm tabular-nums" [class.text-loss]="fact.warn">
                      {{ fact.value }}
                    </dd>
                  </div>
                }
              </dl>
            </section>
          }
          <section class="net-worth-card p-5">
            <h2 class="dash-label">Total balance</h2>
            <p class="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
              {{ wholeDollars(customer.cash + customer.portfolio) }}
            </p>
            <ul class="mt-3 text-sm">
              <li class="border-foreground/12 flex justify-between border-b py-1.5">
                <span class="text-muted-foreground">Cash (shared)</span>
                <span class="tabular-nums">{{ dollars(customer.cash) }}</span>
              </li>
              @for (account of customer.accountBalances; track account.accountId) {
                <li class="border-foreground/12 flex justify-between gap-3 border-b py-1.5">
                  <span class="text-muted-foreground truncate">{{ account.name }}</span>
                  <span class="tabular-nums">{{ dollars(account.value) }}</span>
                </li>
              }
            </ul>
          </section>
        </div>

        <section class="dash-card flex min-h-64 flex-1 flex-col p-5">
          <div class="mb-4 flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold">Orders</h2>
            <span class="text-muted-foreground text-xs">Select an order to see its audit trail</span>
          </div>
          @if (customer.orders.length) {
            <app-order-table
              [orders]="customer.orders"
              [showUser]="false"
              (opened)="open.set($event.orderId)"
            />
          } @else {
            <p class="text-muted-foreground px-2 py-6 text-center text-sm">
              This customer hasn't placed any orders yet.
            </p>
          }
        </section>

        @if (open(); as orderId) {
          <app-order-detail [orderId]="orderId" (closed)="open.set(null)" />
        }
      }
    }
  `,
})
export class CustomerDetailComponent {
  private readonly _api = inject(ReportingApiService);

  // The route's :userId, bound by the router.
  readonly userId = input.required<string>();

  private readonly _userId = toObservable(this.userId);
  protected readonly detail = live(
    () => this._userId.pipe(first(), switchMap((userId) => this._api.customer(userId))),
    CUSTOMER_REFRESH_MS,
  );
  // The order whose detail is open.
  protected readonly open = signal<number | null>(null);

  protected readonly cards = computed(() => {
    const customer = this.detail.data()!;
    const locked = customer.status === 'LOCKED';
    return [
      {
        title: 'Profile',
        facts: [
          { label: 'Trader level', value: titleCase(customer.traderLevel) },
          { label: 'Role', value: customer.role },
          { label: 'Last active', value: recent(customer.lastActiveAt) },
          { label: 'Member since', value: longDay(customer.memberSince) },
        ],
      },
      {
        title: 'Security',
        facts: [
          { label: 'Account status', value: customer.status, warn: locked },
          {
            label: 'Failed attempts',
            value: String(customer.failedAttempts),
            warn: customer.failedAttempts >= FAILED_SIGN_IN_WARNING,
          },
          { label: 'Locked until', value: dayClock(customer.lockedUntil) },
          {
            label: 'Idle timeout',
            value:
              customer.sessionTimeoutMinutes === null
                ? '—'
                : `${customer.sessionTimeoutMinutes} minutes`,
          },
        ],
      },
    ] as { title: string; facts: { label: string; value: string; warn?: boolean }[] }[];
  });

  protected readonly dollars = dollars;
  protected readonly wholeDollars = wholeDollars;
  protected readonly dayClock = dayClock;
  protected readonly initials = initials;
  protected readonly statusTone = statusTone;
}
