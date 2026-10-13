import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth/auth.guard';
import { LoginComponent } from './login/login.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    children: [
      // Activity, customers and orders are an admin's; an analyst is sent on to the runs.
      {
        path: '',
        pathMatch: 'full',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./activity/activity.component').then((m) => m.ActivityComponent),
      },
      {
        path: 'customers',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./customers/customers.component').then((m) => m.CustomersComponent),
      },
      {
        path: 'customers/:userId',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./customers/customer-detail.component').then((m) => m.CustomerDetailComponent),
      },
      {
        path: 'orders',
        canActivate: [adminGuard],
        loadComponent: () => import('./orders/orders.component').then((m) => m.OrdersComponent),
      },
      {
        path: 'runs',
        loadComponent: () => import('./runs/runs.component').then((m) => m.RunsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
