import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  activity,
  customerDetail,
  customers,
  orderDetail,
  orderRows,
} from '../../testing/console-fixtures';
import { profile, report, run, schedulerStatus } from '../../testing/fixtures';
import { ReportingApiService } from './reporting-api.service';

describe('ReportingApiService', () => {
  let service: ReportingApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReportingApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads each reporting endpoint through the proxied path', () => {
    const seen: unknown[] = [];
    service.profile().subscribe((value) => seen.push(value));
    service.runs().subscribe((value) => seen.push(value));
    service.latestReport().subscribe((value) => seen.push(value));
    service.schedulerStatus().subscribe((value) => seen.push(value));

    http.expectOne('/api/reporting/profile').flush(profile());
    http.expectOne('/api/reporting/runs').flush({ latest: run().runId, runs: [run()], timestamp: '' });
    http.expectOne('/api/reporting/runs/latest').flush(report());
    http.expectOne('/api/reporting/scheduler/status').flush(schedulerStatus());

    expect(seen).toHaveLength(4);
    expect(seen[2]).toEqual(report());
  });

  it('reads the analyst console, telling the service how far the viewer is from UTC', () => {
    const seen: unknown[] = [];
    service.activity('7d').subscribe((value) => seen.push(value));
    service.orders().subscribe((value) => seen.push(value));
    service.order(10482).subscribe((value) => seen.push(value));
    service.customers().subscribe((value) => seen.push(value));
    service.customer('6f1c/0a52').subscribe((value) => seen.push(value));

    const request = http.expectOne((candidate) => candidate.url === '/api/reporting/activity');
    expect(request.request.params.get('range')).toBe('7d');
    expect(request.request.params.get('tzOffset')).toBe(String(-new Date().getTimezoneOffset()));
    request.flush(activity({ range: '7d' }));
    http.expectOne('/api/reporting/orders').flush({ orders: orderRows(), total: 3, sessionId: 12 });
    http.expectOne('/api/reporting/orders/10482').flush(orderDetail());
    http.expectOne('/api/reporting/customers').flush({ customers: customers() });
    http.expectOne('/api/reporting/customers/6f1c%2F0a52').flush(customerDetail());

    expect(seen).toHaveLength(5);
    expect(seen[2]).toEqual(orderDetail());
  });

  it('fetches a chart as a blob', () => {
    let received: Blob | undefined;
    service.runFile('20261008T194500Z', 'daily_trades.png').subscribe((blob) => (received = blob));

    const request = http.expectOne('/api/reporting/runs/20261008T194500Z/files/daily_trades.png');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['png'], { type: 'image/png' }));

    expect(received?.size).toBe(3);
  });
});
