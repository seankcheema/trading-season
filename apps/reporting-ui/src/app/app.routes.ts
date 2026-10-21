import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth/auth.guard';
import { LoginComponent } from './login/login.component';

// Each screen names itself in the browser tab and to screen readers (WCAG 2.4.2).
const title = (page: string) => `${page} | TradingSeason Reporting`;

export const routes: Routes = [
  { path: 'login', title: title('Sign in'), component: LoginComponent, canActivate: [guestGuard] },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    children: [
      // Activity, customers and orders are an admin's; an analyst is sent on to the runs.
      {
        path: '',
        pathMatch: 'full',
        title: title('Activity'),
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./activity/activity.component').then((m) => m.ActivityComponent),
      },
      {
        path: 'customers',
        title: title('Customers'),
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./customers/customers.component').then((m) => m.CustomersComponent),
      },
      {
        path: 'customers/:userId',
        title: title('Customer'),
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./customers/customer-detail.component').then((m) => m.CustomerDetailComponent),
      },
      {
        path: 'orders',
        title: title('Orders'),
        canActivate: [adminGuard],
        loadComponent: () => import('./orders/orders.component').then((m) => m.OrdersComponent),
      },
      {
        path: 'runs',
        title: title('Report runs'),
        loadComponent: () => import('./runs/runs.component').then((m) => m.RunsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
