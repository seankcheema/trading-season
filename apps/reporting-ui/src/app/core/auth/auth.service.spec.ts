import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { accessToken } from '../../../testing/fixtures';
import { AuthService } from './auth.service';
import { AuthTokens, TokenStorageService } from './token-storage.service';

const tokens = (overrides: Partial<AuthTokens> = {}): AuthTokens => ({
  accessToken: accessToken({ email: 'ada@example.com' }),
  refreshToken: 'refresh-1',
  expiresIn: 900,
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let storage: TokenStorageService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    storage = TestBed.inject(TokenStorageService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const expireSession = () => storage.save(tokens({ accessToken: 'expired', expiresIn: -1 }));

  it('signs in through the proxied auth service and stores the tokens', async () => {
    const done = firstValueFrom(service.login('ada@example.com', 'secret'));

    const request = http.expectOne('/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'ada@example.com', password: 'secret' });
    request.flush(tokens());

    await done;
    expect(service.isAuthenticated()).toBe(true);
    expect(storage.refreshToken).toBe('refresh-1');
  });

  it('signs out locally and revokes the refresh token', async () => {
    storage.save(tokens());
    const done = firstValueFrom(service.logout());

    expect(storage.hasSession()).toBe(false);
    const request = http.expectOne('/auth/logout');
    expect(request.request.body).toEqual({ refreshToken: 'refresh-1' });
    request.flush({});
    await done;
  });

  it('still signs out when the revoke call fails', async () => {
    storage.save(tokens());
    const done = firstValueFrom(service.logout());
    http.expectOne('/auth/logout').flush('down', { status: 503, statusText: 'Unavailable' });
    await expect(done).resolves.toBeUndefined();
  });

  it('signs out without a call when there is no session', async () => {
    await expect(firstValueFrom(service.logout())).resolves.toBeUndefined();
    http.expectNone('/auth/logout');
  });

  it('accepts a session whose access token is still valid', async () => {
    storage.save(tokens());
    await expect(firstValueFrom(service.ensureValidSession())).resolves.toBe(true);
  });

  it('reports no session when nothing is stored', async () => {
    await expect(firstValueFrom(service.ensureValidSession())).resolves.toBe(false);
  });

  it('refreshes an expired access token once for every waiting caller', async () => {
    expireSession();
    const first = firstValueFrom(service.ensureValidSession());
    const second = firstValueFrom(service.ensureValidSession());

    const request = http.expectOne('/auth/refresh');
    expect(request.request.body).toEqual({ refreshToken: 'refresh-1' });
    request.flush(tokens({ refreshToken: 'refresh-2' }));

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(storage.refreshToken).toBe('refresh-2');
  });

  it('refreshes when the service rejected the current access token', async () => {
    storage.save(tokens());
    const done = firstValueFrom(service.ensureValidSession(storage.accessToken!));
    http.expectOne('/auth/refresh').flush(tokens({ refreshToken: 'refresh-2' }));
    await expect(done).resolves.toBe(true);
  });

  it('ends the session when the refresh token is rejected', async () => {
    expireSession();
    const done = firstValueFrom(service.ensureValidSession());
    http.expectOne('/auth/refresh').flush('no', { status: 401, statusText: 'Unauthorized' });

    await expect(done).resolves.toBe(false);
    expect(storage.hasSession()).toBe(false);
  });

  it('keeps the session when the refresh call itself fails', async () => {
    expireSession();
    const done = firstValueFrom(service.ensureValidSession());
    http.expectOne('/auth/refresh').flush('down', { status: 503, statusText: 'Unavailable' });

    await expect(done).rejects.toMatchObject({ status: 503 });
    expect(storage.hasSession()).toBe(true);

    // The failed attempt is not reused: the next caller starts a new refresh.
    const retry = firstValueFrom(service.ensureValidSession());
    http.expectOne('/auth/refresh').flush(tokens());
    await expect(retry).resolves.toBe(true);
  });

  it('discards a refresh that finishes after the user signed out', async () => {
    expireSession();
    const done = firstValueFrom(service.ensureValidSession());
    const request = http.expectOne('/auth/refresh');
    storage.clear();
    request.flush(tokens());

    await expect(done).resolves.toBe(false);
    expect(storage.hasSession()).toBe(false);
  });

  it('ignores a refresh failure that arrives after the user signed out', async () => {
    expireSession();
    const done = firstValueFrom(service.ensureValidSession());
    const request = http.expectOne('/auth/refresh');
    storage.clear();
    request.flush('down', { status: 503, statusText: 'Unavailable' });

    await expect(done).resolves.toBe(false);
  });
});
