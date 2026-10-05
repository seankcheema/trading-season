import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { BACKEND_API_URL } from '../api.config';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

// Auth calls bypass renewal: refresh credentials travel in the body.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(TokenStorageService);
  const api = inject(BACKEND_API_URL).replace(/\/$/, '');
  if (!storage.hasSession() || !(req.url === api || req.url.startsWith(`${api}/`) || req.url.startsWith(`${api}?`))) {
    return next(req);
  }
  const auth = inject(AuthService);
  const router = inject(Router);
  const identity = storage.identityRevision;
  const expired = () => {
    if (!storage.hasSession()) void router.navigate(['/login']);
    return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Session expired', url: req.url }));
  };
  const send = (token: string) => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  return auth.ensureValidSession().pipe(switchMap((valid) => {
    if (!valid || identity !== storage.identityRevision) return expired();
    const token = storage.accessToken!;
    return send(token).pipe(catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) return throwError(() => error);
      if (identity !== storage.identityRevision) return expired();
      return auth.ensureValidSession(token).pipe(switchMap((renewed) => {
        if (!renewed || identity !== storage.identityRevision) return expired();
        // This retry is outside the catch above, so another 401 cannot loop.
        return send(storage.accessToken!);
      }));
    }));
  }));
};
