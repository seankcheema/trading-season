import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { TokenStorageService } from './token-storage.service';

describe('authInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let storage: TokenStorageService;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    storage = TestBed.inject(TokenStorageService);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  const signIn = (accessToken = 'access-1') =>
    storage.save({ accessToken, refreshToken: 'refresh-1', expiresIn: 900 });

  it('adds the bearer token to reporting calls', () => {
    signIn();
    client.get('/api/reporting/runs').subscribe();
    const request = http.expectOne('/api/reporting/runs');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    request.flush({});
  });

  it('leaves auth calls and other URLs alone', () => {
    signIn();
    client.post('/auth/refresh', {}).subscribe();
    client.get('/api/reportingx').subscribe();
    expect(http.expectOne('/auth/refresh').request.headers.has('Authorization')).toBe(false);
    expect(http.expectOne('/api/reportingx').request.headers.has('Authorization')).toBe(false);
  });

  it('sends reporting calls without a token when signed out', () => {
    client.get('/api/reporting/scheduler/status').subscribe();
    const request = http.expectOne('/api/reporting/scheduler/status');
    expect(request.request.headers.has('Authorization')).toBe(false);
  });

  it('renews the token and retries once after a 401', async () => {
    signIn();
    const done = firstValueFrom(client.get('/api/reporting/runs'));

    http
      .expectOne('/api/reporting/runs')
      .flush({ error: 'Token has expired' }, { status: 401, statusText: 'Unauthorized' });
    http
      .expectOne('/auth/refresh')
      .flush({ accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 });
    const retry = http.expectOne('/api/reporting/runs');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush({ runs: [] });

    await expect(done).resolves.toEqual({ runs: [] });
  });

  it('sends the user to sign in when the session cannot be renewed', async () => {
    signIn();
    const done = firstValueFrom(client.get('/api/reporting/runs'));

    http.expectOne('/api/reporting/runs').flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(done).rejects.toMatchObject({ status: 401, statusText: 'Session expired' });
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('fails without a request when an expired session cannot be refreshed', async () => {
    storage.save({ accessToken: 'old', refreshToken: 'refresh-1', expiresIn: -1 });
    const done = firstValueFrom(client.get('/api/reporting/runs'));

    http.expectOne('/auth/refresh').flush({}, { status: 403, statusText: 'Forbidden' });

    await expect(done).rejects.toMatchObject({ status: 401 });
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('signs out and says why when the service refuses the role', async () => {
    signIn();
    const done = firstValueFrom(client.get('/api/reporting/runs/latest'));

    http
      .expectOne('/api/reporting/runs/latest')
      .flush({ error: 'The ANALYST role is required' }, { status: 403, statusText: 'Forbidden' });

    await expect(done).rejects.toMatchObject({ status: 403 });
    expect(http.expectOne('/auth/logout').request.body).toEqual({ refreshToken: 'refresh-1' });
    expect(storage.hasSession()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'role' } });
  });

  it('signs out when a renewed token no longer carries the role', async () => {
    signIn();
    const done = firstValueFrom(client.get('/api/reporting/runs'));

    http.expectOne('/api/reporting/runs').flush({}, { status: 401, statusText: 'Unauthorized' });
    http
      .expectOne('/auth/refresh')
      .flush({ accessToken: 'access-2', refreshToken: 'refresh-2', expiresIn: 900 });
    http.expectOne('/api/reporting/runs').flush({}, { status: 403, statusText: 'Forbidden' });

    await expect(done).rejects.toMatchObject({ status: 403 });
    expect(http.expectOne('/auth/logout').request.body).toEqual({ refreshToken: 'refresh-2' });
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'role' } });
  });

  it('passes other failures through untouched', async () => {
    signIn();
    const done = firstValueFrom(client.get('/api/reporting/runs/latest'));
    http
      .expectOne('/api/reporting/runs/latest')
      .flush({ error: 'No report has been generated yet' }, { status: 404, statusText: 'Not Found' });

    await expect(done).rejects.toMatchObject({ status: 404 });
    expect(navigate).not.toHaveBeenCalled();
  });
});
