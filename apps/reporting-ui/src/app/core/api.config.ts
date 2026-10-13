import { InjectionToken } from '@angular/core';

// NestJS auth service. Relative so the dev server proxy (proxy.conf.json) and the Nginx image
// forward it: the auth service's CORS policy allows the client UI's origin, not this one.
export const AUTH_API_URL = new InjectionToken<string>('AUTH_API_URL', {
  providedIn: 'root',
  factory: () => '/auth',
});

// Flask reporting service, forwarded the same way.
export const REPORTING_API_URL = new InjectionToken<string>('REPORTING_API_URL', {
  providedIn: 'root',
  factory: () => '/api/reporting',
});
