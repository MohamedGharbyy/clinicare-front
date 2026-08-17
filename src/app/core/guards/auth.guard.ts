import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';

import { AuthService } from '../../auth/auth.service';

/**
 * Route guard: allows genuinely authenticated users through and redirects everyone else
 * to /login. Clears any stale or expired auth state before redirecting.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Clear any expired or partial session data
  if (authService.state().token !== null || authService.state().user !== null) {
    authService.logout();
  }

  return router.createUrlTree(['/login']);
};