import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
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

  it('fetches a chart as a blob', () => {
    let received: Blob | undefined;
    service.runFile('20261008T194500Z', 'daily_trades.png').subscribe((blob) => (received = blob));

    const request = http.expectOne('/api/reporting/runs/20261008T194500Z/files/daily_trades.png');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['png'], { type: 'image/png' }));

    expect(received?.size).toBe(3);
  });
});
