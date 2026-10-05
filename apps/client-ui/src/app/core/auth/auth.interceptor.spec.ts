import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

const tokens = { accessToken: 'old', refreshToken: 'refresh', expiresIn: 900 };
const rotated = { accessToken: 'new', refreshToken: 'rotated', expiresIn: 900 };
const refreshUrl = 'http://localhost:3001/auth/refresh';

describe('authenticated request renewal', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let storage: TokenStorageService;
  let auth: AuthService;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: Router, useValue: { navigate } },
    ] });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    storage = TestBed.inject(TokenStorageService);
    auth = TestBed.inject(AuthService);
    storage.save(tokens);
  });
  afterEach(() => http.verify());

  const reject = (request: ReturnType<HttpTestingController['expectOne']>, status = 401) =>
    request.flush({}, { status, statusText: 'Failure' });

  it('renews before concurrent candle requests and shares the guard refresh', async () => {
    storage.save({ ...tokens, expiresIn: -1 });
    const guard = firstValueFrom(auth.ensureValidSession());
    const a = firstValueFrom(client.get('/api/market/candles?symbol=AAPL'));
    const b = firstValueFrom(client.get('/api/market/candles?symbol=MSFT'));
    http.expectNone('/api/market/candles?symbol=AAPL');
    http.expectOne(refreshUrl).flush(rotated);
    for (const symbol of ['AAPL', 'MSFT']) {
      const request = http.expectOne(`/api/market/candles?symbol=${symbol}`);
      expect(request.request.headers.get('Authorization')).toBe('Bearer new');
      request.flush([]);
    }
    expect(await guard).toBe(true);
    await Promise.all([a, b]);
    expect(storage.refreshToken).toBe('rotated');
  });

  it('finishes rotation after all chart subscribers cancel', () => {
    storage.save({ ...tokens, expiresIn: -1 });
    const subscription = client.get('/api/chart').subscribe();
    const refresh = http.expectOne(refreshUrl);
    subscription.unsubscribe();
    expect(refresh.cancelled).toBe(false);
    refresh.flush(rotated);
    expect(storage.accessToken).toBe('new');
    http.expectNone('/api/chart');
  });

  it('refreshes a locally valid token on 401 and retries only once', async () => {
    const result = firstValueFrom(client.get('/api/chart')).catch((error: unknown) => error);
    reject(http.expectOne('/api/chart'));
    http.expectOne(refreshUrl).flush(rotated);
    const retry = http.expectOne('/api/chart');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
    reject(retry);
    expect(await result).toBeInstanceOf(HttpErrorResponse);
    http.expectNone(refreshUrl);
  });

  it('uses tokens already renewed when a delayed request returns 401', async () => {
    const a = firstValueFrom(client.get('/api/a'));
    const b = firstValueFrom(client.get('/api/b'));
    const first = http.expectOne('/api/a');
    const delayed = http.expectOne('/api/b');
    reject(first);
    http.expectOne(refreshUrl).flush(rotated);
    http.expectOne('/api/a').flush([]);
    reject(delayed);
    const retry = http.expectOne('/api/b');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
    retry.flush([]);
    http.expectNone(refreshUrl);
    await Promise.all([a, b]);
  });

  it('clears rejected credentials and redirects without sending the business request', async () => {
    storage.save({ ...tokens, expiresIn: -1 });
    const result = firstValueFrom(client.get('/api/chart')).catch((error: unknown) => error);
    reject(http.expectOne(refreshUrl));
    expect(await result).toBeInstanceOf(HttpErrorResponse);
    expect(storage.hasSession()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
    http.expectNone('/api/chart');
  });

  it('ends an expired session with no refresh credential', async () => {
    storage.save({ ...tokens, refreshToken: '', expiresIn: -1 });
    const error = await firstValueFrom(client.get('/api/chart')).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(storage.hasSession()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
    http.expectNone(refreshUrl);
    http.expectNone('/api/chart');
  });

  it('shares renewal between concurrent backend 401 responses', async () => {
    const a = firstValueFrom(client.get('/api/a'));
    const b = firstValueFrom(client.get('/api/b'));
    reject(http.expectOne('/api/a'));
    reject(http.expectOne('/api/b'));
    http.expectOne(refreshUrl).flush(rotated);
    http.expectOne('/api/a').flush([]);
    http.expectOne('/api/b').flush([]);
    await Promise.all([a, b]);
  });

  it.each([0, 500, 503])('retains the session after transient refresh failure %s and allows retry', async (status) => {
    storage.save({ ...tokens, expiresIn: -1 });
    const result = firstValueFrom(client.get('/api/chart')).catch((error: unknown) => error);
    const refresh = http.expectOne(refreshUrl);
    if (status === 0) refresh.error(new ProgressEvent('error'));
    else reject(refresh, status);
    expect(await result).toBeInstanceOf(HttpErrorResponse);
    expect(storage.refreshToken).toBe('refresh');
    expect(navigate).not.toHaveBeenCalled();
    const retry = firstValueFrom(client.get('/api/chart'));
    http.expectOne(refreshUrl).flush(rotated);
    http.expectOne('/api/chart').flush([]);
    await retry;
  });

  it.each(['logout', 'login'])('does not overwrite a newer session after %s', async (action) => {
    storage.save({ ...tokens, expiresIn: -1 });
    const result = firstValueFrom(auth.ensureValidSession());
    const refresh = http.expectOne(refreshUrl);
    if (action === 'logout') {
      const logout = firstValueFrom(auth.logout());
      http.expectOne('http://localhost:3001/auth/logout').flush({});
      await logout;
    } else {
      const login = firstValueFrom(auth.login('user@example.com', 'password'));
      http.expectOne('http://localhost:3001/auth/login').flush({ ...tokens, accessToken: 'other' });
      await login;
    }
    refresh.flush(rotated);
    expect(await result).toBe(false);
    expect(storage.accessToken).toBe(action === 'logout' ? null : 'other');
  });

  it('does not refresh or retry ordinary backend 500 errors', async () => {
    const result = firstValueFrom(client.get('/api/chart')).catch((error: unknown) => error);
    reject(http.expectOne('/api/chart'), 500);
    expect(await result).toBeInstanceOf(HttpErrorResponse);
    http.expectNone(refreshUrl);
  });

  it('does not attach business credentials to URLs outside the API path', async () => {
    const result = firstValueFrom(client.get('/api-other'));
    const request = http.expectOne('/api-other');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
    await result;
  });
});
