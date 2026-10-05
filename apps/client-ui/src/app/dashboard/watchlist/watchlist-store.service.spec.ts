import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from '../../core/auth/token-storage.service';
import { WatchlistStore } from './watchlist-store.service';

describe('WatchlistStore', () => {
  let store: WatchlistStore;
  let http: HttpTestingController;
  const entry = { symbol: 'AAPL', createdAt: '2026-01-05T16:00:00Z' };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(WatchlistStore);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('deduplicates loads and keeps cached entries visible during revalidation', () => {
    store.load().subscribe();
    store.load().subscribe();
    http.expectOne('/api/me/watchlist').flush([entry]);
    store.load().subscribe();
    http.expectNone('/api/me/watchlist');
    store.load(true).subscribe();
    expect(store.entries()).toEqual([entry]);
    expect(store.status()).toBe('ready');
    http.expectOne('/api/me/watchlist').flush([]);
    expect(store.entries()).toEqual([]);
  });

  it('updates optimistically, blocks duplicate writes, and rolls back a failed removal', () => {
    store.load().subscribe();
    http.expectOne('/api/me/watchlist').flush([entry]);
    store.toggle('aapl').subscribe({ error: () => undefined });
    store.toggle('AAPL').subscribe();
    expect(store.has('AAPL')).toBe(false);
    expect(store.pending().has('AAPL')).toBe(true);
    http.expectOne('/api/me/watchlist/AAPL').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(store.entries()).toEqual([entry]);
    expect(store.pending().size).toBe(0);
    expect(store.error()).toContain('retry');
    store.toggle('AAPL').subscribe();
    http.expectOne('/api/me/watchlist/AAPL').flush(null);
    expect(store.has('AAPL')).toBe(false);
  });

  it('does not let a GET started before an add erase the saved entry', () => {
    store.load().subscribe();
    http.expectOne('/api/me/watchlist').flush([]);
    store.load(true).subscribe();
    const old = http.expectOne('/api/me/watchlist');
    store.toggle('AAPL').subscribe();
    http.expectOne('/api/me/watchlist/AAPL').flush(entry);
    old.flush([]);
    http.expectOne('/api/me/watchlist').flush([entry]);
    expect(store.entries()).toEqual([entry]);
  });

  it('cancels pending work and clears entries synchronously on logout', () => {
    store.load().subscribe();
    http.expectOne('/api/me/watchlist').flush([entry]);
    store.load(true).subscribe();
    const pending = http.expectOne('/api/me/watchlist');
    TestBed.inject(TokenStorageService).clear();
    expect(pending.cancelled).toBe(true);
    expect(store.entries()).toEqual([]);
    expect(store.status()).toBe('idle');
  });
});
