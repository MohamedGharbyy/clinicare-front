import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';

import { AuthService } from '../../auth/auth.service';
import type { UserRole } from '../../auth/auth.models';
import { normalizeRole } from '../../auth/jwt.utils';

/** Role → the user's dashboard path. */
const ROLE_TO_DASHBOARD: Record<UserRole, string> = {
  PATIENT: '/patient/dashboard',
  DOCTOR: '/doctor/dashboard',
  ADMIN: '/admin/dashboard',
};

/**
 * Route guard for the login/signup pages. Prevents authenticated users from
 * viewing them. If a genuinely authenticated user tries to access /login or /signup,
 * they are redirected to their role-specific dashboard.
 */
export const loginGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Only redirect if there is a genuinely valid, unexpired authenticated session
  if (authService.isAuthenticated()) {
    const user = authService.user();
    const normalizedRole = user ? normalizeRole(user.role) : null;
    if (normalizedRole && ROLE_TO_DASHBOARD[normalizedRole]) {
      const redirectUrl = ROLE_TO_DASHBOARD[normalizedRole];
      return router.createUrlTree([redirectUrl]);
    }
    // If user info or role is invalid, clear the corrupted state
    authService.logout();
  } else if (authService.state().token !== null || authService.state().user !== null) {
    // If state contains expired or partial data, clean it up
    authService.logout();
  }

  // Not authenticated, allow access to login/signup
  return true;
};

