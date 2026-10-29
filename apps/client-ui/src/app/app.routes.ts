import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { dropAccountIdGuard } from './core/drop-account-id.guard';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./landing/landing.component').then((m) => m.LandingComponent),
  },
  { path: 'login', title: 'Sign in', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'register', title: 'Create account', component: RegisterComponent, canActivate: [guestGuard] },
  {
    path: 'dashboard/markets/:symbol',
    title: (route) => `${route.paramMap.get('symbol')} market`,
    canActivate: [dropAccountIdGuard, authGuard],
    loadComponent: () =>
      import('./market-page/market-page.component').then((m) => m.MarketPageComponent),
  },
  {
    path: 'dashboard',
    title: 'Dashboard',
    canActivate: [dropAccountIdGuard, authGuard],
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  { path: '**', redirectTo: '' },
];
