import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown } from '@ng-icons/lucide';
import {
  Instrument,
  MOCK_ACCOUNTS,
  MOCK_CASH_BALANCE,
  MOCK_HOLDINGS,
  MOCK_INSTRUMENTS,
  MOCK_TRANSACTIONS,
  OrderRequest,
  Timeframe,
  findInstrument,
  mockPriceSeries,
} from './mock-data';
import { OrderSubmissionComponent } from './order-submission/order-submission.component';
import { InstrumentSearchComponent } from './shared/instrument-search.component';
import { PriceChartComponent } from './shared/price-chart.component';
import { SignedPercentPipe } from './shared/signed-percent.pipe';
import { TimeframeToggleComponent } from './shared/timeframe-toggle.component';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    InstrumentSearchComponent,
    NgIcon,
    OrderSubmissionComponent,
    PriceChartComponent,
    SignedPercentPipe,
    TimeframeToggleComponent,
  ],
  providers: [provideIcons({ lucideChevronDown })],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  protected readonly accounts = MOCK_ACCOUNTS;
  protected readonly selectedAccountId = signal(MOCK_ACCOUNTS[0].id);
  protected readonly cashBalance = signal(MOCK_CASH_BALANCE);
  protected readonly tickerInstruments = MOCK_INSTRUMENTS.slice(0, 6);
  protected readonly portfolioTimeframe = signal<Timeframe>('1D');

  // Instrument currently open in the order submission dialog, if any.
  protected readonly orderInstrument = signal<Instrument | null>(null);

  protected readonly holdings = computed(() =>
    MOCK_HOLDINGS.flatMap((holding) => {
      const instrument = findInstrument(holding.symbol);
      if (!instrument) {
        return [];
      }
      const value = holding.shares * instrument.price;
      return [{ ...holding, instrument, value, gainLoss: value - holding.shares * holding.costBasis }];
    }),
  );

  protected readonly transactions = computed(() =>
    MOCK_TRANSACTIONS.map((transaction) => {
      const current = findInstrument(transaction.symbol)?.price ?? transaction.price;
      const direction = transaction.side === 'buy' ? 1 : -1;
      return {
        ...transaction,
        value: transaction.shares * transaction.price,
        gainLoss: direction * transaction.shares * (current - transaction.price),
      };
    }),
  );

  protected readonly positions = computed(() =>
    Object.fromEntries(this.holdings().map((holding) => [holding.symbol, holding.shares])),
  );

  protected readonly investedValue = computed(() =>
    this.holdings().reduce((total, holding) => total + holding.value, 0),
  );

  protected readonly netWorth = computed(() => this.cashBalance() + this.investedValue());

  protected readonly netWorthChangePercent = computed(() => {
    const cost = this.holdings().reduce((total, h) => total + h.shares * h.costBasis, 0);
    return cost ? ((this.investedValue() - cost) / cost) * 100 : 0;
  });

  // Share of net worth that is invested rather than held as cash.
  protected readonly allocationPercent = computed(() =>
    this.netWorth() ? (this.investedValue() / this.netWorth()) * 100 : 0,
  );

  protected readonly portfolioChart = computed(() =>
    mockPriceSeries(`portfolio-${this.selectedAccountId()}`, this.portfolioTimeframe(), this.netWorth()),
  );

  protected onAccountChange(event: Event): void {
    this.selectedAccountId.set((event.target as HTMLSelectElement).value);
  }

  protected openOrder(instrument: Instrument): void {
    this.orderInstrument.set(instrument);
  }

  protected closeOrder(): void {
    this.orderInstrument.set(null);
  }

  protected onOrderSubmitted(order: OrderRequest): void {
    // TODO: send to the order service once the backend endpoint is available
    console.log('Order submitted', order);
    this.closeOrder();
  }

  protected onDeposit(): void {
    // TODO: open deposit flow
  }

  protected onWithdraw(): void {
    // TODO: open withdrawal flow
  }
}
