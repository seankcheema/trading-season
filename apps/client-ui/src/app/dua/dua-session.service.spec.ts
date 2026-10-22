import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { DuaSession, ReadContext } from './dua-session.service';
import { TokenStorageService } from '../core/auth/token-storage.service';

describe('Dua viewed versions', () => {
  let session: DuaSession;
  let http: HttpTestingController;
  let changeIdentity: () => void;
  const context: ReadContext = {
    accountId: 1,
    sessionId: 1,
    insight: 'stock',
    symbol: 'JPM',
    version: 'old',
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: TokenStorageService,
          useValue: { onIdentityChange: (fn: () => void) => (changeIdentity = fn) },
        },
      ],
    });
    session = TestBed.inject(DuaSession);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('opening the menu leaves content unread', () => {
    session.minimized.set(false);
    expect(session.unread(context)).toBe(true);
  });
  it('acknowledges exact versions and leaves newer versions unread', () => {
    session.viewedSummary(context);
    http.expectOne((r) => r.method === 'PUT').flush(null);
    expect(session.unread(context)).toBe(false);
    expect(session.unread({ ...context, version: 'new' })).toBe(true);
    expect(session.unread({ ...context, accountId: 2 })).toBe(true);
  });
  it('synchronizes acknowledgments from another device', () => {
    session.query([context]);
    http.expectOne((r) => r.method === 'POST').flush([context]);
    expect(session.unread(context)).toBe(false);
  });
  it('keeps failed writes viewed locally until identity changes', () => {
    session.viewedSummary(context);
    http.expectOne((r) => r.method === 'PUT').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(session.unread(context)).toBe(false);
    changeIdentity();
    expect(session.unread(context)).toBe(true);
    expect(session.minimized()).toBe(true);
  });
  it('never unreads a local acknowledgment when an older query finishes', () => {
    session.query([context]);
    const query = http.expectOne((r) => r.method === 'POST');
    session.viewedSummary(context);
    http.expectOne((r) => r.method === 'PUT').flush(null);
    query.flush([]);
    expect(session.unread(context)).toBe(false);
  });
  it('ignores a query response after identity changes', () => {
    session.query([context]);
    const request = http.expectOne((r) => r.method === 'POST');
    changeIdentity();
    request.flush([context]);
    expect(session.unread(context)).toBe(true);
  });
});
