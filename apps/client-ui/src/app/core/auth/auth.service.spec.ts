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

    const profileReq = http.expectOne('/api/auth/register');
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
    http.expectOne('/api/auth/register').flush({}, { status: 201, statusText: 'Created' });

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
      .expectOne('/api/auth/register')
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

  it('asks the auth service to email a reset link', async () => {
    const result = firstValueFrom(service.requestPasswordReset('jane@example.com'));

    const req = http.expectOne('http://localhost:3001/auth/forgot-password');
    expect(req.request.body).toEqual({ email: 'jane@example.com' });
    req.flush({ message: 'If that email has an account, a reset link is on its way.' });

    await expect(result).resolves.toBeUndefined();
  });

  it('sends no password when asking for a reset link', async () => {
    const result = firstValueFrom(service.requestPasswordReset('jane@example.com'));

    const req = http.expectOne('http://localhost:3001/auth/forgot-password');
    expect(JSON.stringify(req.request.body)).not.toContain('password');
    req.flush({ message: 'accepted' });

    await result;
  });

  it('resets the password with the emailed token and clears the stored session', async () => {
    // The reset revokes every refresh token server-side, so a session left in this browser
    // would only send the guards after a token that no longer works.
    storage.save(TOKENS);

    const result = firstValueFrom(service.resetPassword('the-reset-token', 'new-pass1!'));
    const req = http.expectOne('http://localhost:3001/auth/reset-password');
    expect(req.request.body).toEqual({ token: 'the-reset-token', password: 'new-pass1!' });
    req.flush({ message: 'Your password has been reset.' });

    await result;
    expect(service.isAuthenticated()).toBe(false);
    expect(storage.accessToken).toBeNull();
  });

  it('keeps the session when the reset is rejected', async () => {
    storage.save(TOKENS);

    const result = firstValueFrom(service.resetPassword('expired', 'new-pass1!'));
    http.expectOne('http://localhost:3001/auth/reset-password').flush(
      { message: 'This password reset link is invalid or has expired' },
      { status: 400, statusText: 'Bad Request' },
    );

    await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('sends no bearer token on either reset call', async () => {
    // Both routes are unauthenticated by design: someone resetting a password cannot
    // present the credential they have forgotten.
    storage.save(TOKENS);

    void firstValueFrom(service.requestPasswordReset('jane@example.com'));
    const forgot = http.expectOne('http://localhost:3001/auth/forgot-password');
    expect(forgot.request.headers.has('Authorization')).toBe(false);
    forgot.flush({ message: 'accepted' });

    void firstValueFrom(service.resetPassword('the-reset-token', 'new-pass1!'));
    const reset = http.expectOne('http://localhost:3001/auth/reset-password');
    expect(reset.request.headers.has('Authorization')).toBe(false);
    reset.flush({ message: 'reset' });
  });
});
