import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, TitleStrategy } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { authInterceptor } from './core/auth/auth.interceptor';
import { PageTitleStrategy } from './core/title/page-title.strategy';
import { SessionTimeoutService } from './core/auth/session-timeout.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes), provideClientHydration(),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Constructing the service starts the inactivity countdown whenever a session exists.
    provideAppInitializer(() => void inject(SessionTimeoutService)),
  ]
};
