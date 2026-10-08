import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';
import { NO_ACCESS_REASON } from './reporting-access';
import { TokenStorageService } from './token-storage.service';

// Only signed-in analysts may enter. Everyone else is sent to the login page; an account
// that is signed in without the role is signed out first and told why.
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const storage = inject(TokenStorageService);
  const login = router.createUrlTree(['/login']);
  return auth.ensureValidSession().pipe(
    switchMap((valid) => {
      if (!valid) return of(login);
      if (storage.isAnalyst()) return of(true);
      return auth
        .logout()
        .pipe(
          map(() => router.createUrlTree(['/login'], { queryParams: { reason: NO_ACCESS_REASON } })),
        );
    }),
    // The auth service is unreachable but the refresh token may still be good:
    // let an analyst's screen load and show its own error rather than a blank page.
    catchError(() => of(storage.isAnalyst() || login)),
  );
};

// Keeps signed-in analysts off the login page.
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const storage = inject(TokenStorageService);
  return inject(AuthService)
    .ensureValidSession()
    .pipe(
      map((valid) => (valid && storage.isAnalyst() ? router.createUrlTree(['/']) : true)),
      catchError(() => of(true)),
    );
};
