import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BACKEND_API_URL } from '../api.config';
import { TokenStorageService } from './token-storage.service';

// Attaches the access token to business backend calls. Auth service calls are left alone:
// they authenticate with credentials or a refresh token in the body.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const accessToken = inject(TokenStorageService).accessToken;
  if (!accessToken || !req.url.startsWith(inject(BACKEND_API_URL))) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } }));
};
