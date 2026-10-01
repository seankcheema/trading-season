import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PortfolioHistoryService } from './portfolio-history.service';

describe('PortfolioHistoryService', () => {
  let service: PortfolioHistoryService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PortfolioHistoryService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PortfolioHistoryService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify({ ignoreCancelled: true }));

  const history = (id = 1) => `/api/accounts/${id}/portfolio-history?timeframe=1D`;
  const point = { timestamp: '2026-10-01T18:00:00Z', value: 100.5 };

  it('builds simulated value only after an effective purchase and clears it when rewound', () => {
    const at = Date.parse('2026-01-10T17:00:00Z');
    const purchase = at - 60_000;
    const context = {
      accountId: 1,
      at,
      sessionId: 1,
      current: [{ symbol: 'AAPL', quantity: 2, averageCost: 100 }],
      catalogue: [
        {
          instrumentId: 7,
          ticker: 'AAPL',
          simulatedStockSymbol: 'AAPL',
          name: 'Apple',
          assetClass: 'Equity',
          market: 'US',
          currency: 'USD',
          tradable: true,
        },
      ],
      orders: [
        {
          orderId: 1,
          accountId: 1,
          instrumentId: 7,
          status: 'FILLED' as const,
          orderType: 'BUY' as const,
          quantity: 2,
          indicativePrice: 100,
          simulatedAt: new Date(purchase).toISOString(),
          submittedAt: '2026-10-01T18:00:00Z',
          resolvedAt: '2026-10-01T18:00:00Z',
          rejectionReason: null,
        },
      ],
    };
    service.select(1, '1D', context);
    http
      .expectOne((request) => request.url === '/api/market/candles')
      .flush({
        symbol: 'AAPL',
        points: [{ timestamp: new Date(purchase).toISOString(), close: 110 }],
      });
    expect(service.points()[0].value).toBe(0);
    expect(service.points().find((point) => point.time.getTime() === purchase - 1)?.value).toBe(0);
    expect(service.points().at(-1)?.value).toBe(220);
    service.select(1, '1D', { ...context, at: purchase - 1 });
    http
      .expectOne((request) => request.url === '/api/market/candles')
      .flush({ symbol: 'AAPL', points: [] });
    expect(service.points().every((point) => point.value === 0)).toBe(true);
    http.expectNone((request) => request.url.includes('portfolio-valuations'));
  });

  it('uses actual observation timestamps without generating earlier values', () => {
    service.select(1, '1D');
    expect(service.status()).toBe('loading');
    http.expectOne(history()).flush([point]);
    expect(service.points()).toEqual([{ time: new Date(point.timestamp), value: 100.5 }]);
    expect(service.status()).toBe('ready');
  });

  it('cancels stale account and timeframe requests and clears old points', () => {
    service.select(1, '1D');
    const old = http.expectOne(history());
    service.select(2, '1Y');
    expect(old.cancelled).toBe(true);
    http
      .expectOne('/api/accounts/2/portfolio-history?timeframe=1Y')
      .flush([{ ...point, value: 0 }]);
    expect(service.points()[0].value).toBe(0);
    service.select(null, '1D');
    expect(service.points()).toEqual([]);
  });

  it('captures after a filled trade and then reloads history', () => {
    service.select(1, '1D');
    http.expectOne(history()).flush([]);
    service.afterTrade(1);
    const capture = http.expectOne('/api/accounts/1/portfolio-valuations');
    expect(capture.request.method).toBe('POST');
    expect(capture.request.body).toEqual({});
    capture.flush(point);
    http.expectOne(history()).flush([point]);
    expect(service.points()).toHaveLength(1);
  });

  it('keeps capture failures separate from trades and retries on the next refresh', () => {
    service.select(1, '1D');
    http.expectOne(history()).flush([point]);
    service.afterTrade(1);
    http
      .expectOne('/api/accounts/1/portfolio-valuations')
      .flush(null, { status: 500, statusText: 'Error' });
    expect(service.status()).toBe('error');
    expect(service.points()).toHaveLength(1);
    service.refresh();
    http.expectOne('/api/accounts/1/portfolio-valuations').flush(point);
    http.expectOne(history()).flush([point]);
    expect(service.status()).toBe('ready');
  });

  it('retries failed history without recapturing a completed observation', () => {
    service.select(1, '1D');
    http.expectOne(history()).flush([]);
    service.afterTrade(1);
    http.expectOne('/api/accounts/1/portfolio-valuations').flush(point);
    http.expectOne(history()).flush(null, { status: 503, statusText: 'Unavailable' });
    service.refresh();
    http.expectOne(history()).flush([point]);
    http.expectNone('/api/accounts/1/portfolio-valuations');
  });

  it('defers capture for a different account until it is selected', () => {
    service.select(1, '1D');
    http.expectOne(history()).flush([]);
    service.afterTrade(2);
    http.expectNone('/api/accounts/2/portfolio-valuations');
    service.select(2, '1D');
    http.expectOne('/api/accounts/2/portfolio-valuations').flush(point);
    http.expectOne(history(2)).flush([point]);
  });
});
