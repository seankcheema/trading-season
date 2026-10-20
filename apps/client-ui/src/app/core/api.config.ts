import { InjectionToken } from '@angular/core';

// NestJS auth service. Relative so the dev server proxy (proxy.conf.json), the local nginx and
// CloudFront in front of S3 all forward /auth to it on the UI's own origin, needing no CORS entry.
export const AUTH_API_URL = new InjectionToken<string>('AUTH_API_URL', {
  providedIn: 'root',
  factory: () => '/auth',
});

// Java business backend. Relative so the dev server proxy (proxy.conf.json) forwards it,
// since the backend has no CORS policy of its own.
export const BACKEND_API_URL = new InjectionToken<string>('BACKEND_API_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
