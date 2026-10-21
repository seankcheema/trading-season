import { ResolveFn, Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { dropAccountIdGuard } from './core/drop-account-id.guard';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';

// Each page names itself in the browser tab and to screen readers (WCAG 2.4.2).
const APP_NAME = 'TradingSeason';
const marketTitle: ResolveFn<string> = (route) =>
  `${(route.paramMap.get('symbol') ?? '').toUpperCase()} | ${APP_NAME}`;

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: APP_NAME,
    loadComponent: () => import('./landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'login',
    title: `Sign in | ${APP_NAME}`,
    component: LoginComponent,
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    title: `Create an account | ${APP_NAME}`,
    component: RegisterComponent,
    canActivate: [guestGuard],
  },
  {
    path: 'dashboard/markets/:symbol',
    title: marketTitle,
    canActivate: [dropAccountIdGuard, authGuard],
    loadComponent: () =>
      import('./market-page/market-page.component').then((m) => m.MarketPageComponent),
  },
  {
    path: 'dashboard',
    title: `Dashboard | ${APP_NAME}`,
    canActivate: [dropAccountIdGuard, authGuard],
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  { path: '**', redirectTo: '' },
];
