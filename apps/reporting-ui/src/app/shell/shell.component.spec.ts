import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { text } from '../../testing/dom';
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

  it('frames every reporting screen with navigation for an admin', async () => {
    signIn({ email: 'sean@example.com', roles: ['ADMIN'] });
    await TestBed.inject(Router).navigateByUrl('/');
    const root = render();
    await fixture.whenStable();
    fixture.detectChanges();

    const links = Array.from(root.querySelectorAll('nav a'));
    expect(links.map((link) => link.textContent!.trim())).toEqual([
      'Activity',
      'Customers',
      'Orders',
      'Report runs',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/customers',
      '/orders',
      '/runs',
    ]);
    expect(links[0].getAttribute('aria-current')).toBe('page');
    expect(links[1].hasAttribute('aria-current')).toBe(false);
    expect(root.querySelector('router-outlet')).not.toBeNull();
  });

  it('offers an analyst the report runs and nothing else', () => {
    signIn({ email: 'analyst@example.com', roles: ['ANALYST'] });
    const links = Array.from(render().querySelectorAll('nav a'));

    expect(links.map((link) => link.textContent!.trim())).toEqual(['Report runs']);
    expect(links[0].getAttribute('href')).toBe('/runs');
  });

  it('collapses to its icons, keeps the names for assistive tech, and remembers the choice', () => {
    signIn({ email: 'sean@example.com', roles: ['ADMIN'] });
    const root = render();
    const grid = root.firstElementChild!;
    const toggle = () => root.querySelector<HTMLButtonElement>('aside button[aria-controls="reporting-nav"]')!;
    const labels = () => Array.from(root.querySelectorAll('nav a span')).map((label) => label.className);

    expect(toggle().getAttribute('aria-label')).toBe('Collapse sidebar');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(grid.className).toContain('md:grid-cols-[232px_minmax(0,1fr)]');
    expect(labels().every((name) => !name.includes('sr-only'))).toBe(true);
    expect(root.querySelector('nav a')!.hasAttribute('title')).toBe(false);

    toggle().click();
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-label')).toBe('Expand sidebar');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(grid.className).toContain('md:grid-cols-[60px_minmax(0,1fr)]');
    // Hidden from the wide layout only; the names stay in the accessibility tree and as tooltips.
    expect(labels().every((name) => name.includes('md:sr-only'))).toBe(true);
    expect(Array.from(root.querySelectorAll('nav a')).map((link) => link.getAttribute('title'))).toEqual([
      'Activity',
      'Customers',
      'Orders',
      'Report runs',
    ]);
    expect(root.querySelector('aside a[aria-label="TradingSeason Reporting"] > span')!.className).toContain(
      'md:hidden',
    );
    expect(root.querySelector('button[aria-label="Log out"]')).not.toBeNull();
    expect(localStorage.getItem('ts.reporting.sidebar-collapsed')).toBe('true');

    // A new visit starts collapsed, and opening it is remembered too.
    fixture.destroy();
    const again = render();
    expect(again.querySelector('button[aria-label="Expand sidebar"]')).not.toBeNull();
    again.querySelector<HTMLButtonElement>('button[aria-label="Expand sidebar"]')!.click();
    expect(localStorage.getItem('ts.reporting.sidebar-collapsed')).toBe('false');
  });

  it('opens an exported PDF with what it is, when it was made and by whom', () => {
    signIn({ email: 'sean@example.com', roles: ['ADMIN'] });
    const root = render();
    const header = root.querySelector('[data-print-header]')!;
    const line = () => text(header);

    // Hidden on screen, shown only in print.
    expect(header.className).toContain('hidden');
    expect(header.className).toContain('print:flex');
    expect(line()).toMatch(/^TradingSeason Reporting Exported \w{3} \d{1,2}, \d{4}, .+ by Sean Cheema$/);

    // The time is taken again each time the screen goes to print.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2031-03-04T15:06:07Z'));
    window.dispatchEvent(new Event('beforeprint'));
    vi.useRealTimers();
    expect(line()).toContain('Exported Mar 4, 2031');
  });

  it('still collapses when the browser refuses to store the choice', () => {
    signIn({ email: 'sean@example.com', roles: ['ADMIN'] });
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === 'ts.reporting.sidebar-collapsed') throw new Error('blocked');
      return null;
    });
    const root = render();
    getItem.mockRestore();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    root.querySelector<HTMLButtonElement>('button[aria-label="Collapse sidebar"]')!.click();
    fixture.detectChanges();

    expect(root.querySelector('button[aria-label="Expand sidebar"]')).not.toBeNull();
    setItem.mockRestore();
  });

  it("shows the signed-in analyst's name, role and trader level", () => {
    signIn({ email: 'sean@example.com', roles: ['ANALYST'] });
    const root = render();
    expect(user(root)).toEqual(['SC', 'Sean Cheema', 'Analyst · Advanced']);
  });

  it('falls back to the sign-in email for a user without a trading profile', () => {
    loadProfile.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    signIn({ email: 'analyst@example.com', roles: ['ANALYST'] });
    const root = render();
    expect(user(root)).toEqual(['AE', 'analyst@example.com', 'Analyst']);
  });

  it('still renders when neither a profile nor token claims are available', () => {
    loadProfile.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const root = render();
    expect(user(root)).toEqual(['?', 'Signed in']);
  });

  it('signs out and returns to the login page', () => {
    signIn({ email: 'sean@example.com', roles: ['ANALYST'] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const root = render();

    root.querySelector<HTMLButtonElement>('button[aria-label="Log out"]')!.click();

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
