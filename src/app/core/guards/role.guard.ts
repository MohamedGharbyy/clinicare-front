import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type {
  ActivatedRouteSnapshot,
  CanActivateFn,
  RouterStateSnapshot,
} from '@angular/router';

import { AuthService } from '../../auth/auth.service';
import type { UserRole } from '../../auth/auth.models';
import { normalizeRole } from '../../auth/jwt.utils';

/** Route prefix → the role required to access that guarded area. */
const PREFIX_TO_ROLE: Record<string, UserRole> = {
  patient: 'PATIENT',
  doctor: 'DOCTOR',
  admin: 'ADMIN',
};

/** Role → the user's own dashboard path (used when redirecting a mismatched role). */
const ROLE_TO_DASHBOARD: Record<UserRole, string> = {
  PATIENT: '/patient/dashboard',
  DOCTOR: '/doctor/dashboard',
  ADMIN: '/admin/dashboard',
};

/** First path segment of the current URL, e.g. "patient" for /patient/…. */
function firstPathSegment(state: RouterStateSnapshot): string {
  const segments = state.url.split('/').filter(Boolean);
  return segments[0]?.toLowerCase() ?? '';
}

/**
 * Route guard for a role-scoped area (e.g. /patient/** or /doctor/** or /admin/**).
 *
 * - Unauthenticated users are redirected to /login.
 * - An authenticated user whose role doesn't match the area (e.g. a PATIENT
 *   hitting /doctor/dashboard) is redirected to their OWN dashboard — never an
 *   error page.
 */
export const roleGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    if (authService.state().token !== null || authService.state().user !== null) {
      authService.logout();
    }
    return router.createUrlTree(['/login']);
  }

  const user = authService.user();
  const userRole = user ? normalizeRole(user.role) : null;
  if (!userRole) {
    authService.logout();
    return router.createUrlTree(['/login']);
  }

  const requiredRole = PREFIX_TO_ROLE[firstPathSegment(state)];
  if (!requiredRole) {
    // No role constraint for this prefix — allow through.
    return true;
  }

  if (userRole === requiredRole) {
    return true;
  }

  // Wrong role for this area — take them to their own dashboard.
  const redirectTo = ROLE_TO_DASHBOARD[userRole] ?? '/login';
  return router.createUrlTree([redirectTo]);
};