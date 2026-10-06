import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WatchlistStarComponent } from './watchlist-star.component';
import { WatchlistStore } from './watchlist-store.service';

describe('WatchlistStarComponent', () => {
  let fixture: ComponentFixture<WatchlistStarComponent>;
  let store: WatchlistStore;
  let http: HttpTestingController;

  const star = () => fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  const retry = () =>
    fixture.nativeElement.querySelector('[role="status"] button') as HTMLButtonElement | null;

  function ready(entries: { symbol: string; createdAt: string }[] = []): void {
    store.load(true).subscribe();
    http.expectOne('/api/me/watchlist').flush(entries);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WatchlistStarComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    store = TestBed.inject(WatchlistStore);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WatchlistStarComponent);
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('is disabled until the watchlist has loaded', () => {
    expect(star().disabled).toBe(true);
    ready();
    expect(star().disabled).toBe(false);
  });

  it('offers to add a stock that is not watched', () => {
    ready();
    expect(star().getAttribute('aria-label')).toBe('Add AAPL to watchlist');
    expect(star().getAttribute('aria-pressed')).toBe('false');
  });

  it('offers to remove a stock that is watched', () => {
    ready([{ symbol: 'AAPL', createdAt: '2026-01-05T00:00:00Z' }]);
    expect(star().getAttribute('aria-label')).toBe('Remove AAPL from watchlist');
    expect(star().getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('ng-icon').className).toContain('text-primary');
  });

  it('adds the stock when clicked and stays disabled while saving', () => {
    ready();
    star().click();
    fixture.detectChanges();

    const request = http.expectOne('/api/me/watchlist/AAPL');
    expect(request.request.method).toBe('PUT');
    expect(star().disabled).toBe(true);
    expect(star().getAttribute('aria-pressed')).toBe('true');

    request.flush({ symbol: 'AAPL', createdAt: '2026-01-05T00:00:00Z' });
    fixture.detectChanges();
    expect(star().disabled).toBe(false);
  });

  it('removes a watched stock when clicked', () => {
    ready([{ symbol: 'AAPL', createdAt: '2026-01-05T00:00:00Z' }]);
    star().click();
    http.expectOne('/api/me/watchlist/AAPL').flush(null);
    fixture.detectChanges();
    expect(star().getAttribute('aria-pressed')).toBe('false');
  });

  it('puts the star back and explains when saving fails', () => {
    ready();
    star().click();
    http.expectOne('/api/me/watchlist/AAPL').flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(star().getAttribute('aria-pressed')).toBe('false');
    expect(fixture.nativeElement.textContent).toContain('Unable to save watchlist');
  });

  it('retries loading from the error message', () => {
    store.load(true).subscribe({ error: () => undefined });
    http.expectOne('/api/me/watchlist').flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Unable to refresh watchlist');

    retry()!.click();
    http.expectOne('/api/me/watchlist').flush([]);
    fixture.detectChanges();

    expect(retry()).toBeNull();
    expect(star().disabled).toBe(false);
  });
});
