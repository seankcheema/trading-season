import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { accessToken } from '../../../testing/fixtures';
import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

describe('auth guards', () => {
  let ensureValidSession: ReturnType<typeof vi.fn>;
  let logout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    ensureValidSession = vi.fn();
    logout = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { ensureValidSession, logout } }],
    });
  });

  function run(guard: typeof authGuard) {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Observable<boolean | UrlTree>;
    return firstValueFrom(result);
  }

  const serialize = (tree: boolean | UrlTree) =>
    tree instanceof UrlTree ? TestBed.inject(Router).serializeUrl(tree) : tree;

  const signInAs = (role: string) =>
    TestBed.inject(TokenStorageService).save({
      accessToken: accessToken({ roles: [role] }),
      refreshToken: 'refresh-1',
      expiresIn: 900,
    });

  it('lets a signed-in analyst into the reporting screens', async () => {
    signInAs('ANALYST');
    ensureValidSession.mockReturnValue(of(true));
    expect(await run(authGuard)).toBe(true);
    expect(logout).not.toHaveBeenCalled();
  });

  it('signs a trader out and sends them to the login page with the reason', async () => {
    signInAs('TRADER');
    ensureValidSession.mockReturnValue(of(true));
    expect(serialize(await run(authGuard))).toBe('/login?reason=role');
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('sends a signed-out user to the login page', async () => {
    ensureValidSession.mockReturnValue(of(false));
    expect(serialize(await run(authGuard))).toBe('/login');
  });

  it('sends a signed-in analyst from the login page to the reporting screens', async () => {
    signInAs('ANALYST');
    ensureValidSession.mockReturnValue(of(true));
    expect(serialize(await run(guestGuard))).toBe('/');
  });

  it('lets a signed-out user and a signed-in trader see the login page', async () => {
    ensureValidSession.mockReturnValue(of(false));
    expect(await run(guestGuard)).toBe(true);

    signInAs('TRADER');
    ensureValidSession.mockReturnValue(of(true));
    expect(await run(guestGuard)).toBe(true);
  });

  it('still routes an analyst when the auth service cannot be reached', async () => {
    signInAs('ANALYST');
    ensureValidSession.mockReturnValue(throwError(() => new Error('offline')));
    expect(await run(authGuard)).toBe(true);
    expect(await run(guestGuard)).toBe(true);
  });

  it('keeps everyone else out when the auth service cannot be reached', async () => {
    ensureValidSession.mockReturnValue(throwError(() => new Error('offline')));
    expect(serialize(await run(authGuard))).toBe('/login');

    signInAs('TRADER');
    expect(serialize(await run(authGuard))).toBe('/login');
  });
});
