import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';

import { AuthService } from '../../auth/auth.service';
import type { UserRole } from '../../auth/auth.models';

/** Role → the user's dashboard path. */
const ROLE_TO_DASHBOARD: Record<UserRole, string> = {
  PATIENT: '/patient/dashboard',
  DOCTOR: '/doctor/dashboard',
  ADMIN: '/admin/dashboard',
};

/**
 * Route guard for the login/signup pages. Prevents authenticated users from
 * viewing them. If an authenticated user tries to access /login or /signup,
 * they are redirected to their role-specific dashboard.
 */
export const loginGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If already authenticated, redirect to role-specific dashboard
  if (authService.isAuthenticated()) {
    const user = authService.user();
    if (user) {
      const normalizedRole = normalizeRole(user.role);
      const redirectUrl = ROLE_TO_DASHBOARD[normalizedRole];
      console.debug(`Login guard: user is authenticated as ${normalizedRole}, redirecting to ${redirectUrl}`);
      return router.createUrlTree([redirectUrl]);
    }
  }

  // Not authenticated, allow access to login/signup
  return true;
};

/**
 * Normalize role from various possible formats to a known UserRole.
 */
function normalizeRole(role: unknown): UserRole {
  if (typeof role === 'string') {
    const upper = role.toUpperCase();
    if (upper === 'PATIENT' || upper === 'DOCTOR' || upper === 'ADMIN') {
      return upper as UserRole;
    }
  }
  
  if (typeof role === 'object' && role !== null && 'name' in role) {
    return normalizeRole((role as any).name);
  }
  
  console.warn('Could not normalize role in loginGuard:', role);
  return 'PATIENT';
}
