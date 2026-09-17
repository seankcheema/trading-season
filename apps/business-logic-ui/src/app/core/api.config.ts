import { InjectionToken } from '@angular/core';

// NestJS auth service. Called directly: its CORS policy already allows the dev server.
export const AUTH_API_URL = new InjectionToken<string>('AUTH_API_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:3001',
});

// Java business backend. Relative so the dev server proxy (proxy.conf.json) forwards it,
// since the backend has no CORS policy of its own.
export const BACKEND_API_URL = new InjectionToken<string>('BACKEND_API_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
