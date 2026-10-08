import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivityComponent } from './activity/activity.component';
import { App } from './app';
import { appConfig } from './app.config';
import { routes } from './app.routes';
import { authGuard, guestGuard } from './core/auth/auth.guard';
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

  it('loads the shell with the activity and runs screens inside it', async () => {
    const [activity, runs] = shell.children!;
    expect(activity.path).toBe('');
    expect(runs.path).toBe('runs');

    const loaded = await Promise.all([
      shell.loadComponent!(),
      activity.loadComponent!(),
      runs.loadComponent!(),
    ]);
    expect(loaded).toEqual([ShellComponent, ActivityComponent, RunsComponent]);
  });
});
