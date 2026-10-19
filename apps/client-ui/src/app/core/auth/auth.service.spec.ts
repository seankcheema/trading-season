import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { EmailTakenError, RegistrationStepError } from './auth-error';
import { authInterceptor } from './auth.interceptor';
import { AuthService, RegistrationDetails } from './auth.service';
import { TokenStorageService } from './token-storage.service';

const TOKENS = { accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 };

const DETAILS: RegistrationDetails = {
  firstName: 'Jane',
  middleName: '',
  lastName: 'Doe',
  email: 'jane@example.com',
  dateOfBirth: '1990-01-01',
  ssn: '123-45-6789',
  address: '123 Main St, Springfield',
  traderLevel: 'BEGINNER',
  availableFunds: 5000,
  password: 'secret-pass1!',
};

describe('AuthService', () => {
  let service: AuthService;
  let storage: TokenStorageService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    storage = TestBed.inject(TokenStorageService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('logs in with only email and password and stores the tokens', async () => {
    const result = firstValueFrom(service.login('jane@example.com', 'secret-pass1!'));

    const req = http.expectOne('http://localhost:3001/auth/login');
    expect(req.request.body).toEqual({ email: 'jane@example.com', password: 'secret-pass1!' });
    req.flush(TOKENS);
    await result;

    expect(storage.accessToken).toBe('access');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('does not store anything when login fails', async () => {
    const result = firstValueFrom(service.login('jane@example.com', 'wrong'));
    http
      .expectOne('http://localhost:3001/auth/login')
      .flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('registers credentials with the auth service, then the profile with the backend', async () => {
    const result = firstValueFrom(service.register(DETAILS));

    const authReq = http.expectOne('http://localhost:3001/auth/register');
    expect(authReq.request.body).toEqual({ email: DETAILS.email, password: DETAILS.password });
    authReq.flush(TOKENS);

    const profileReq = http.expectOne('/api/registration');
    expect(profileReq.request.body).toEqual({
      email: 'jane@example.com',
      firstName: 'Jane',
      middleName: null,
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      ssn: '123-45-6789',
      address: '123 Main St, Springfield',
      traderLevel: 'BEGINNER',
      availableFunds: 5000,
    });
    expect(profileReq.request.headers.get('Authorization')).toBe('Bearer access');
    profileReq.flush({}, { status: 201, statusText: 'Created' });

    await result;
    expect(service.isAuthenticated()).toBe(true);
  });

  it('resumes at the profile step when the email already has matching credentials', async () => {
    const result = firstValueFrom(service.register(DETAILS));

    http
      .expectOne('http://localhost:3001/auth/register')
      .flush({ message: 'Email is already in use' }, { status: 409, statusText: 'Conflict' });
    const loginReq = http.expectOne('http://localhost:3001/auth/login');
    expect(loginReq.request.body).toEqual({ email: DETAILS.email, password: DETAILS.password });
    loginReq.flush(TOKENS);
    http.expectOne('/api/registration').flush({}, { status: 201, statusText: 'Created' });

    await result;
    expect(service.isAuthenticated()).toBe(true);
  });

  it('reports a taken email when the existing credentials do not match', async () => {
    const result = firstValueFrom(service.register(DETAILS));

    http
      .expectOne('http://localhost:3001/auth/register')
      .flush({ message: 'Email is already in use' }, { status: 409, statusText: 'Conflict' });
    http
      .expectOne('http://localhost:3001/auth/login')
      .flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toBeInstanceOf(EmailTakenError);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('clears the session and reports the profile step when the backend rejects the profile', async () => {
    const result = firstValueFrom(service.register(DETAILS));

    http.expectOne('http://localhost:3001/auth/register').flush(TOKENS);
    http
      .expectOne('/api/registration')
      .flush({ error: 'username: must not be blank' }, { status: 400, statusText: 'Bad Request' });

    const error = await result.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RegistrationStepError);
    expect((error as RegistrationStepError).step).toBe('register-profile');
    expect(service.isAuthenticated()).toBe(false);
  });

  it('refreshes an expired access token', async () => {
    storage.save({ ...TOKENS, expiresIn: -1 });

    const result = firstValueFrom(service.ensureValidSession());
    const req = http.expectOne('http://localhost:3001/auth/refresh');
    expect(req.request.body).toEqual({ refreshToken: 'refresh' });
    req.flush({ ...TOKENS, accessToken: 'rotated' });

    expect(await result).toBe(true);
    expect(storage.accessToken).toBe('rotated');
  });

  it('revokes the refresh token and clears the session on logout', async () => {
    storage.save(TOKENS);

    const result = firstValueFrom(service.logout());
    expect(service.isAuthenticated()).toBe(false);
    const req = http.expectOne('http://localhost:3001/auth/logout');
    expect(req.request.body).toEqual({ refreshToken: 'refresh' });
    req.flush({ message: 'Logged out successfully' });

    await result;
  });

  it('reports an auth-step failure for any registration error other than a taken email', async () => {
    const result = firstValueFrom(service.register(DETAILS)).catch((e: unknown) => e);
    http
      .expectOne('http://localhost:3001/auth/register')
      .flush({}, { status: 500, statusText: 'Server Error' });
    const error = await result;
    expect(error).toBeInstanceOf(RegistrationStepError);
    expect((error as RegistrationStepError).step).toBe('register-auth');
  });

  it('reports an auth-step failure when the resume login fails for another reason', async () => {
    const result = firstValueFrom(service.register(DETAILS)).catch((e: unknown) => e);
    http
      .expectOne('http://localhost:3001/auth/register')
      .flush({}, { status: 409, statusText: 'Conflict' });
    http
      .expectOne('http://localhost:3001/auth/login')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    const error = await result;
    expect(error).toBeInstanceOf(RegistrationStepError);
    expect((error as RegistrationStepError).step).toBe('register-auth');
  });

  it('signs out locally even when there is no refresh token or revoking it fails', async () => {
    await firstValueFrom(service.logout());
    http.expectNone('http://localhost:3001/auth/logout');

    storage.save(TOKENS);
    const result = firstValueFrom(service.logout());
    http
      .expectOne('http://localhost:3001/auth/logout')
      .flush({}, { status: 500, statusText: 'Server Error' });
    await result;
    expect(service.isAuthenticated()).toBe(false);
  });

  it('answers true without refreshing while the access token is valid', async () => {
    storage.save(TOKENS);
    expect(await firstValueFrom(service.ensureValidSession())).toBe(true);
    http.expectNone('http://localhost:3001/auth/refresh');
  });

  it('shares one in-flight refresh between callers', async () => {
    storage.save({ ...TOKENS, expiresIn: -1 });
    const first = firstValueFrom(service.ensureValidSession());
    const second = firstValueFrom(service.ensureValidSession());
    http.expectOne('http://localhost:3001/auth/refresh').flush(TOKENS);
    expect(await Promise.all([first, second])).toEqual([true, true]);
  });

  it('clears a session that has no refresh token left to use', async () => {
    storage.save({ ...TOKENS, refreshToken: '', expiresIn: -1 });
    expect(service.isAuthenticated()).toBe(true);
    expect(await firstValueFrom(service.ensureValidSession())).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
    expect(await firstValueFrom(service.ensureValidSession())).toBe(false);
  });

  it.each([400, 401, 403])('signs out when the refresh is refused with %s', async (status) => {
    storage.save({ ...TOKENS, expiresIn: -1 });
    const result = firstValueFrom(service.ensureValidSession());
    http
      .expectOne('http://localhost:3001/auth/refresh')
      .flush({}, { status, statusText: 'Refused' });
    expect(await result).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('keeps the session and surfaces the error when the refresh fails for another reason', async () => {
    storage.save({ ...TOKENS, expiresIn: -1 });
    const result = firstValueFrom(service.ensureValidSession()).catch((e: unknown) => e);
    http
      .expectOne('http://localhost:3001/auth/refresh')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(await result).toBeInstanceOf(HttpErrorResponse);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('discards a refresh result that arrives after the session changed', async () => {
    storage.save({ ...TOKENS, expiresIn: -1 });
    const result = firstValueFrom(service.ensureValidSession());
    const request = http.expectOne('http://localhost:3001/auth/refresh');
    storage.clear();
    request.flush({ ...TOKENS, accessToken: 'late' });
    expect(await result).toBe(false);
    expect(storage.accessToken).toBeNull();
  });

  it('ignores a refresh failure that arrives after the session changed', async () => {
    storage.save({ ...TOKENS, expiresIn: -1 });
    const result = firstValueFrom(service.ensureValidSession());
    const request = http.expectOne('http://localhost:3001/auth/refresh');
    storage.clear();
    request.flush({}, { status: 500, statusText: 'Server Error' });
    expect(await result).toBe(false);
  });
});
