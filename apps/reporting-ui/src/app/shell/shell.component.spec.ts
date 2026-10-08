import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { accessToken, profile, report, run, schedulerStatus } from '../../testing/fixtures';
import { AuthService } from '../core/auth/auth.service';
import { TokenStorageService } from '../core/auth/token-storage.service';
import { UserProfile } from '../reporting/report.models';
import { ReportingApiService } from '../reporting/reporting-api.service';
import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;
  let logout: ReturnType<typeof vi.fn>;
  let loadProfile: ReturnType<typeof vi.fn<() => Observable<UserProfile>>>;

  beforeEach(() => {
    localStorage.clear();
    logout = vi.fn(() => of(undefined));
    loadProfile = vi.fn<() => Observable<UserProfile>>(() => of(profile()));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { logout } },
        {
          provide: ReportingApiService,
          useValue: {
            profile: () => loadProfile(),
            runs: () => of({ latest: run().runId, runs: [run()], timestamp: '' }),
            latestReport: () => of(report()),
            schedulerStatus: () => of(schedulerStatus()),
          },
        },
      ],
    });
  });

  const signIn = (claims: Record<string, unknown>) =>
    TestBed.inject(TokenStorageService).save({
      accessToken: accessToken(claims),
      refreshToken: 'refresh-1',
      expiresIn: 900,
    });

  const render = () => {
    fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  // Initials, name and the role line of the signed-in user, in that order.
  const user = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('aside > div:last-child span'))
      .filter((part) => !part.querySelector('span'))
      .map((part) => part.textContent!.trim());

  it('frames the reporting screens with navigation', async () => {
    signIn({ email: 'sean@example.com', roles: ['TRADER'] });
    await TestBed.inject(Router).navigateByUrl('/');
    const root = render();
    await fixture.whenStable();
    fixture.detectChanges();

    const links = Array.from(root.querySelectorAll('nav a'));
    expect(links.map((link) => link.textContent!.trim())).toEqual(['Activity', 'Report runs']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/runs']);
    expect(links[0].getAttribute('aria-current')).toBe('page');
    expect(links[1].hasAttribute('aria-current')).toBe(false);
    expect(root.querySelector('router-outlet')).not.toBeNull();
  });

  it("shows the signed-in trader's name, role and level", () => {
    signIn({ email: 'sean@example.com', roles: ['TRADER'] });
    const root = render();
    expect(user(root)).toEqual(['SC', 'Sean Cheema', 'Trader · Advanced']);
  });

  it('falls back to the sign-in email for a user without a trading profile', () => {
    loadProfile.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    signIn({ email: 'admin@example.com', roles: ['ADMIN'] });
    const root = render();
    expect(user(root)).toEqual(['AE', 'admin@example.com', 'Admin']);
  });

  it('still renders when neither a profile nor token claims are available', () => {
    loadProfile.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const root = render();
    expect(user(root)).toEqual(['?', 'Signed in']);
  });

  it('signs out and returns to the login page', () => {
    signIn({ email: 'sean@example.com' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const root = render();

    root.querySelector<HTMLButtonElement>('button[aria-label="Log out"]')!.click();

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
