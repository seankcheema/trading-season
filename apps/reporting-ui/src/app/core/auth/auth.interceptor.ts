import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { REPORTING_API_URL } from '../api.config';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

// Adds the bearer token to reporting calls and renews it once on a 401.
// Auth calls bypass renewal: refresh credentials travel in the body.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(TokenStorageService);
  const api = inject(REPORTING_API_URL).replace(/\/$/, '');
  if (!storage.hasSession() || !(req.url === api || req.url.startsWith(`${api}/`))) {
    return next(req);
  }
  const auth = inject(AuthService);
  const router = inject(Router);
  const expired = () => {
    if (!storage.hasSession()) void router.navigate(['/login']);
    return throwError(
      () => new HttpErrorResponse({ status: 401, statusText: 'Session expired', url: req.url }),
    );
  };
  const send = (token: string) =>
    next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  return auth.ensureValidSession().pipe(
    switchMap((valid) => {
      const token = storage.accessToken;
      if (!valid || !token) return expired();
      return send(token).pipe(
        catchError((error: unknown) => {
          if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
            return throwError(() => error);
          }
          return auth.ensureValidSession(token).pipe(
            switchMap((renewed) => {
              const renewedToken = storage.accessToken;
              if (!renewed || !renewedToken) return expired();
              // This retry is outside the catch above, so another 401 cannot loop.
              return send(renewedToken);
            }),
          );
        }),
      );
    }),
  );
};
