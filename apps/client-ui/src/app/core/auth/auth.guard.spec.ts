import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('auth guards', () => {
  let ensureValidSession: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ensureValidSession = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { ensureValidSession } }],
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

  it('lets a signed-in user into protected routes', async () => {
    ensureValidSession.mockReturnValue(of(true));
    expect(await run(authGuard)).toBe(true);
  });

  it('sends a signed-out user to the login page', async () => {
    ensureValidSession.mockReturnValue(of(false));
    expect(serialize(await run(authGuard))).toBe('/login');
  });

  it('sends a signed-in user from the login and register pages to the dashboard', async () => {
    ensureValidSession.mockReturnValue(of(true));
    expect(serialize(await run(guestGuard))).toBe('/dashboard');
  });

  it('lets a signed-out user see the login and register pages', async () => {
    ensureValidSession.mockReturnValue(of(false));
    expect(await run(guestGuard)).toBe(true);
  });
});
