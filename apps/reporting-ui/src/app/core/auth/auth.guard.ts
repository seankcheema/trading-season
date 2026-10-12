import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';
import { HOME_FOR_EVERY_ROLE, NO_ACCESS_REASON } from './reporting-access';
import { TokenStorageService } from './token-storage.service';

// Only signed-in analysts and admins may enter. Everyone else is sent to the login page; an
// account that is signed in without either role is signed out first and told why.
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const storage = inject(TokenStorageService);
  const login = router.createUrlTree(['/login']);
  return auth.ensureValidSession().pipe(
    switchMap((valid) => {
      if (!valid) {
        return of(login);
      }
      if (storage.hasReportingRole()) {
        return of(true);
      }
      return auth
        .logout()
        .pipe(
          map(() => router.createUrlTree(['/login'], { queryParams: { reason: NO_ACCESS_REASON } })),
        );
    }),
    // The auth service is unreachable but the refresh token may still be good:
    // let the screen load and show its own error rather than a blank page.
    catchError(() => of(storage.hasReportingRole() || login)),
  );
};

// The screens that show individual customers and their orders are an admin's. An analyst
// who asks for one, by a link or by signing in, is taken to the report runs instead. Runs
// under authGuard, which has already settled the session.
export const adminGuard: CanActivateFn = () =>
  inject(TokenStorageService).isAdmin() || inject(Router).createUrlTree([HOME_FOR_EVERY_ROLE]);

// Keeps signed-in analysts and admins off the login page.
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const storage = inject(TokenStorageService);
  return inject(AuthService)
    .ensureValidSession()
    .pipe(
      map((valid) => (valid && storage.hasReportingRole() ? router.createUrlTree(['/']) : true)),
      catchError(() => of(true)),
    );
};
