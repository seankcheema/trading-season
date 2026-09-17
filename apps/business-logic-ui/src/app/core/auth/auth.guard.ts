import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

// Only signed-in users may enter; everyone else is sent to the login page.
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .ensureValidSession()
    .pipe(map((valid) => valid || router.createUrlTree(['/login'])));
};

// Keeps signed-in users off the login and register pages.
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .ensureValidSession()
    .pipe(map((valid) => (valid ? router.createUrlTree(['/dashboard']) : true)));
};
