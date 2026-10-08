import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

// Only signed-in users may enter; everyone else is sent to the login page.
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .ensureValidSession()
    .pipe(
      map((valid) => valid || router.createUrlTree(['/login'])),
      // The auth service is unreachable but the refresh token may still be good:
      // let the screen load and show its own error rather than a blank page.
      catchError(() => of(true)),
    );
};

// Keeps signed-in users off the login page.
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .ensureValidSession()
    .pipe(
      map((valid) => (valid ? router.createUrlTree(['/']) : true)),
      catchError(() => of(true)),
    );
};
