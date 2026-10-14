import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivityComponent } from './activity/activity.component';
import { App } from './app';
import { appConfig } from './app.config';
import { routes } from './app.routes';
import { adminGuard, authGuard, guestGuard } from './core/auth/auth.guard';
import { CustomerDetailComponent } from './customers/customer-detail.component';
import { CustomersComponent } from './customers/customers.component';
import { OrdersComponent } from './orders/orders.component';
import { RunsComponent } from './runs/runs.component';
import { ShellComponent } from './shell/shell.component';

describe('App', () => {
  it('renders the routed screen', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
  });

  it('configures routing and HTTP', () => {
    expect(appConfig.providers.length).toBeGreaterThan(0);
  });
});

describe('routes', () => {
  const [login, shell, fallback] = routes;

  it('keeps signed-in users off the login page and guests out of the reporting screens', () => {
    expect(login.path).toBe('login');
    expect(login.canActivate).toEqual([guestGuard]);
    expect(shell.path).toBe('');
    expect(shell.canActivate).toEqual([authGuard]);
    expect(fallback).toEqual({ path: '**', redirectTo: '' });
  });

  it('loads the shell with every reporting screen inside it', async () => {
    const screens = shell.children!;
    expect(screens.map((screen) => screen.path)).toEqual([
      '',
      'customers',
      'customers/:userId',
      'orders',
      'runs',
    ]);

    // Every screen but the report runs is an admin's.
    expect(screens.map((screen) => screen.canActivate)).toEqual([
      [adminGuard],
      [adminGuard],
      [adminGuard],
      [adminGuard],
      undefined,
    ]);

    const loaded = await Promise.all([
      shell.loadComponent!(),
      ...screens.map((screen) => screen.loadComponent!()),
    ]);
    expect(loaded).toEqual([
      ShellComponent,
      ActivityComponent,
      CustomersComponent,
      CustomerDetailComponent,
      OrdersComponent,
      RunsComponent,
    ]);
  });
});
