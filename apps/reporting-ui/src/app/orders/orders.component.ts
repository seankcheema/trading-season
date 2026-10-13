import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert } from '@ng-icons/lucide';
import { ReportingApiService } from '../reporting/reporting-api.service';
import { ExportMenuComponent, downloadCsv } from '../shared/export-menu.component';
import { live } from '../shared/live';
import { PageHeaderComponent } from '../shared/page-header.component';
import { OrderBrowserComponent } from './order-browser.component';
import { OrderDetailComponent } from './order-detail.component';

// How often the order list is read again.
export const ORDERS_REFRESH_MS = 30_000;

// Every order on the platform and the deposits and withdrawals among them,
// searchable and filterable. An order's row opens the order with its ledger
// impact and audit trail.
@Component({
  selector: 'app-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIcon,
    PageHeaderComponent,
    ExportMenuComponent,
    OrderBrowserComponent,
    OrderDetailComponent,
  ],
  providers: [provideIcons({ lucideCircleAlert })],
  host: { class: 'flex min-h-[32rem] flex-1 basis-0 flex-col gap-3' },
  template: `
    <app-page-header title="Orders" [subtitle]="subtitle()">
      <app-export-menu (exportCsv)="exportCsv()" />
    </app-page-header>

    <section class="dash-card flex min-h-0 flex-1 flex-col p-5">
      @switch (list.state()) {
        @case ('loading') {
          <p class="text-muted-foreground text-sm" aria-busy="true">Loading orders…</p>
        }
        @case ('error') {
          <div class="flex flex-col items-center gap-3 py-14 text-center" role="alert">
            <ng-icon name="lucideCircleAlert" size="24" class="text-loss" />
            <p class="text-sm">We couldn't load the orders.</p>
            <button type="button" class="ghost-button" (click)="list.reload()">Try again</button>
          </div>
        }
        @case ('ready') {
          @let data = list.data()!;
          <app-order-browser
            [orders]="data.orders"
            [transfers]="data.transfers"
            (opened)="open.set($event.orderId)"
          />
        }
      }
    </section>

    @if (open(); as orderId) {
      <app-order-detail [orderId]="orderId" (closed)="open.set(null)" />
    }
  `,
})
export class OrdersComponent {
  private readonly _api = inject(ReportingApiService);
  private readonly _browser = viewChild(OrderBrowserComponent);

  protected readonly list = live(() => this._api.orders(), ORDERS_REFRESH_MS);
  // The order whose detail is open.
  protected readonly open = signal<number | null>(null);

  protected readonly subtitle = computed(() => {
    const session = this.list.data()?.sessionId;
    return session ? `All accounts · simulation session #${session}` : 'All accounts';
  });

  // The rows on screen, in the order they are shown.
  protected exportCsv(): void {
    downloadCsv(
      'orders',
      ['Order', 'Time', 'Customer', 'Account', 'Asset', 'Side', 'Qty', 'Fill price', 'Amount', 'Status', 'Client reference'],
      (this._browser()?.shown() ?? []).map((row) => [
        row.order ? row.id : '',
        row.at,
        row.userName,
        row.accountName,
        row.symbol,
        row.side,
        row.quantity ?? '',
        row.price ?? '',
        row.amount ?? '',
        row.status,
        row.reference,
      ]),
    );
  }
}
