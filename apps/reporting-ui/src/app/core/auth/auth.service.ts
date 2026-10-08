import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, defer, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { AUTH_API_URL } from '../api.config';
import { AuthTokens, TokenStorageService } from './token-storage.service';

// Sign-in against the auth service. Accounts are created in the client UI, not here.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _http = inject(HttpClient);
  private readonly _storage = inject(TokenStorageService);
  private readonly _authApiUrl = inject(AUTH_API_URL);

  readonly isAuthenticated = this._storage.hasSession;
  private refresh?: { revision: number; result: Observable<boolean> };

  login(email: string, password: string): Observable<void> {
    return this._http.post<AuthTokens>(`${this._authApiUrl}/login`, { email, password }).pipe(
      tap((tokens) => this._storage.save(tokens)),
      map(() => undefined),
    );
  }

  logout(): Observable<void> {
    const refreshToken = this._storage.refreshToken;
    this._storage.clear();
    if (!refreshToken) {
      return of(undefined);
    }
    return this._http.post<unknown>(`${this._authApiUrl}/logout`, { refreshToken }).pipe(
      map(() => undefined),
      // The local session is already gone; a failed revoke shouldn't block signing out.
      catchError(() => of(undefined)),
    );
  }

  // Resolves true when there is a usable access token, refreshing an expired one if possible.
  ensureValidSession(rejectedToken?: string): Observable<boolean> {
    if (this._storage.isAccessTokenValid() && this._storage.accessToken !== rejectedToken) {
      return of(true);
    }
    const revision = this._storage.revision;
    if (this.refresh?.revision === revision) return this.refresh.result;
    const refreshToken = this._storage.refreshToken;
    if (!refreshToken) {
      return of(false);
    }
    const current = () => this._storage.revision === revision;
    const result = defer(() =>
      this._http.post<AuthTokens>(`${this._authApiUrl}/refresh`, { refreshToken }),
    ).pipe(
      map((tokens) => {
        if (!current()) return false;
        this._storage.save(tokens);
        return true;
      }),
      catchError((error: unknown) => {
        if (!current()) return of(false);
        if (error instanceof HttpErrorResponse && [400, 401, 403].includes(error.status)) {
          this._storage.clear();
          return of(false);
        }
        return throwError(() => error);
      }),
      finalize(() => {
        if (this.refresh?.result === result) this.refresh = undefined;
      }),
      // Refresh tokens rotate on use, so every waiting request must share one refresh call.
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.refresh = { revision, result };
    return result;
  }
}
