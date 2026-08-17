import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { AuthService } from '../../auth/auth.service';
import type { UserRole } from '../../auth/auth.models';

const ROLE_TO_DASHBOARD: Record<UserRole, string> = {
  PATIENT: '/patient/dashboard',
  DOCTOR: '/doctor/dashboard',
  ADMIN: '/login',
};

export const authRedirectGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.user();
  if (!user) {
    return true;
  }

  return router.createUrlTree([ROLE_TO_DASHBOARD[user.role] ?? '/login']);
};
