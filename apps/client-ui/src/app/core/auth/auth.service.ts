import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { AUTH_API_URL, BACKEND_API_URL } from '../api.config';
import { EmailTakenError, RegistrationStepError } from './auth-error';
import { AuthTokens, TokenStorageService } from './token-storage.service';

export interface RegistrationDetails {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  ssn: string;
  address: string;
  traderLevel: string;
  availableFunds: number;
  password: string;
}

interface Credentials {
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _http = inject(HttpClient);
  private readonly _storage = inject(TokenStorageService);
  private readonly _authApiUrl = inject(AUTH_API_URL);
  private readonly _backendApiUrl = inject(BACKEND_API_URL);

  readonly isAuthenticated = this._storage.hasSession;

  login(email: string, password: string): Observable<void> {
    return this.requestTokens('login', { email, password }).pipe(map(() => undefined));
  }

  // Creates the credentials in the auth service, then the trading profile in the backend.
  // The auth service only ever receives email and password; the backend never receives the password.
  register(details: RegistrationDetails): Observable<void> {
    const credentials: Credentials = { email: details.email, password: details.password };

    return this.requestTokens('register', credentials).pipe(
      catchError((error: unknown) => {
        if (!(error instanceof HttpErrorResponse && error.status === 409)) {
          return throwError(() => new RegistrationStepError('register-auth', error));
        }
        // The email already has credentials, most likely from an earlier attempt whose
        // profile step failed. If the same password signs in, resume from the profile step.
        return this.requestTokens('login', credentials).pipe(
          catchError((loginError: unknown) =>
            throwError(() =>
              loginError instanceof HttpErrorResponse && loginError.status === 401
                ? new EmailTakenError()
                : new RegistrationStepError('register-auth', loginError),
            ),
          ),
        );
      }),
      switchMap(() =>
        this._http.post<unknown>(`${this._backendApiUrl}/auth/register`, toProfile(details)).pipe(
          catchError((error: unknown) => {
            // Without a profile the account can't use the dashboard, so don't leave it signed in.
            this._storage.clear();
            return throwError(() => new RegistrationStepError('register-profile', error));
          }),
        ),
      ),
      map(() => undefined),
    );
  }

  logout(): Observable<void> {
    const refreshToken = this._storage.refreshToken;
    this._storage.clear();
    if (!refreshToken) {
      return of(undefined);
    }
    return this._http.post<unknown>(`${this._authApiUrl}/auth/logout`, { refreshToken }).pipe(
      map(() => undefined),
      // The local session is already gone; a failed revoke shouldn't block signing out.
      catchError(() => of(undefined)),
    );
  }

  // Resolves true when there is a usable access token, refreshing an expired one if possible.
  ensureValidSession(): Observable<boolean> {
    if (this._storage.isAccessTokenValid()) {
      return of(true);
    }
    const refreshToken = this._storage.refreshToken;
    if (!refreshToken) {
      return of(false);
    }
    return this._http
      .post<AuthTokens>(`${this._authApiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap((tokens) => this._storage.save(tokens)),
        map(() => true),
        catchError(() => {
          this._storage.clear();
          return of(false);
        }),
      );
  }

  private requestTokens(
    endpoint: 'login' | 'register',
    credentials: Credentials,
  ): Observable<AuthTokens> {
    return this._http
      .post<AuthTokens>(`${this._authApiUrl}/auth/${endpoint}`, credentials)
      .pipe(tap((tokens) => this._storage.save(tokens)));
  }
}

function toProfile(details: RegistrationDetails) {
  return {
    email: details.email,
    firstName: details.firstName,
    middleName: details.middleName || null,
    lastName: details.lastName,
    dateOfBirth: details.dateOfBirth,
    ssn: details.ssn,
    address: details.address,
    traderLevel: details.traderLevel,
    availableFunds: details.availableFunds,
  };
}
