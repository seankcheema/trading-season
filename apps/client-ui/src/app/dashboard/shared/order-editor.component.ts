import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { OrderSubmissionComponent } from '../order-submission/order-submission.component';
import { OrderService } from '../orders/order.service';
import { AccountStore } from '../accounts/account-store.service';
import { Instrument } from '../mock-data';

/** Reopens the stock ticket with the original account and the order's own reserved resources. */
@Component({
  selector: 'app-order-editor',
  imports: [OrderSubmissionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (orders.editingOrder(); as order) {
      @if (instrument(); as stock) {
        <app-order-submission [instrument]="stock" [instruments]="instruments()" [editOrder]="order"
          [sessionId]="order.sessionId ?? sessionId()" [marketTimestamp]="marketTimestamp()"
          [accountId]="order.accountId?.toString() ?? ''" [cashBalance]="cash()" [positions]="positions()"
          (closed)="orders.editingOrder.set(null)" (submitted)="saved()" />
      }
    }
  `,
})
export class OrderEditorComponent {
  protected readonly orders = inject(OrderService);
  private readonly accounts = inject(AccountStore);
  readonly instruments = input<readonly Instrument[]>([]);
  readonly sessionId = input<number | null>(null);
  readonly marketTimestamp = input('');
  protected readonly instrument = computed(() => {
    const order = this.orders.editingOrder();
    const ref = this.orders.catalogue().find((item) => item.instrumentId === order?.instrumentId);
    if (!order || !ref) return null;
    const symbol = ref.simulatedStockSymbol ?? ref.ticker;
    return this.instruments().find((item) => item.symbol === symbol)
      ?? { symbol, name: ref.name, price: order.referencePrice ?? order.indicativePrice, change: 0, changePercent: 0 };
  });
  protected readonly cash = computed(() => this.accounts.spendableFunds() + (this.orders.editingOrder()?.reservedCash ?? 0));
  protected readonly positions = computed(() => {
    const order = this.orders.editingOrder();
    const stock = this.instrument();
    const holdings = this.accounts.holdingsByAccount().get(order?.accountId ?? -1) ?? [];
    const positions = Object.fromEntries(holdings.map((item) => [item.symbol, item.availableQuantity ?? item.quantity]));
    if (stock && order?.orderType === 'SELL') positions[stock.symbol] = (positions[stock.symbol] ?? 0) + (order.reservedShares ?? 0);
    return positions;
  });
  protected saved(): void {
    const id = this.orders.editingOrder()?.accountId;
    this.orders.editingOrder.set(null);
    if (id) this.accounts.refreshAfterTrade(id).subscribe({ error: () => this.accounts.load(true) });
  }
}
