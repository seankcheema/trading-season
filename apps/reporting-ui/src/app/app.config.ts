import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { PageTitleStrategy } from './core/title/page-title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Route parameters arrive as component inputs, such as a customer's :userId.
    provideRouter(routes, withComponentInputBinding()),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
  ],
};
