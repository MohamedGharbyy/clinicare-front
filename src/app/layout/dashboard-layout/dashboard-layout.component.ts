import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../auth/auth.service';
import { normalizeRole } from '../../auth/jwt.utils';
import type { UserRole } from '../../auth/auth.models';

type NavIcon =
  | 'dashboard'
  | 'appointments'
  | 'schedule'
  | 'users'
  | 'records'
  | 'prescriptions'
  | 'messages'
  | 'settings';

interface DashboardNavItem {
  label: string;
  icon: NavIcon;
  route?: string;
}

interface DashboardNavSection {
  label: string;
  items: DashboardNavItem[];
}

const ROLE_DASHBOARD_URL: Record<UserRole, string> = {
  PATIENT: '/patient/dashboard',
  DOCTOR: '/doctor/dashboard',
  ADMIN: '/admin/dashboard',
};

const NAV_BY_ROLE: Record<UserRole, DashboardNavSection[]> = {
  PATIENT: [
    {
      label: 'Menu',
      items: [{ label: 'Dashboard', icon: 'dashboard', route: '/patient/dashboard' }],
    },
    {
      label: 'Care',
      items: [
        { label: 'Appointments', icon: 'appointments', route: '/patient/appointments' },
        { label: 'Medical reports', icon: 'records', route: '/patient/medical-reports' },
        { label: 'Prescriptions', icon: 'prescriptions', route: '/patient/prescriptions' },
      ],
    },
    {
      label: 'Account',
      items: [{ label: 'Profile & settings', icon: 'settings', route: '/patient/profile' }],
    },
  ],
  DOCTOR: [
    {
      label: 'Menu',
      items: [{ label: 'Dashboard', icon: 'dashboard', route: '/doctor/dashboard' }],
    },
    {
      label: 'Practice',
      items: [
        { label: 'Patients', icon: 'users', route: '/doctor/patients' },
        { label: 'Appointments', icon: 'appointments', route: '/doctor/appointments' },
        { label: 'Medical reports', icon: 'records', route: '/doctor/medical-reports' },
        { label: 'Prescriptions', icon: 'prescriptions', route: '/doctor/prescriptions' },
      ],
    },
    {
      label: 'Account',
      items: [{ label: 'Profile & settings', icon: 'settings', route: '/doctor/profile' }],
    },
  ],
  ADMIN: [
    {
      label: 'Menu',
      items: [{ label: 'Dashboard', icon: 'dashboard', route: '/admin/dashboard' }],
    },
    {
      label: 'Management',
      items: [
        { label: 'Patients', icon: 'users', route: '/admin/patients' },
        { label: 'Doctors', icon: 'users', route: '/admin/doctors' },
        { label: 'Appointments', icon: 'appointments', route: '/admin/appointments' },
      ],
    },
    {
      label: 'Account',
      items: [{ label: 'User Management', icon: 'users', route: '/admin/users' }],
    },
  ],
};

@Component({
  selector: 'app-dashboard-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet],
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.scss',
})
export class DashboardLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.authService.user;
  readonly sidebarOpen = signal(false);

  readonly navSections = computed<DashboardNavSection[]>(() => {
    const role = normalizeRole(this.user()?.role);
    return role ? NAV_BY_ROLE[role] : [];
  });

  readonly dashboardUrl = computed(() => {
    const role = normalizeRole(this.user()?.role);
    return role ? ROLE_DASHBOARD_URL[role] : '/login';
  });

  readonly initials = computed(() => {
    const localPart = (this.user()?.email ?? '').split('@')[0] ?? '';
    return localPart.slice(0, 2).toUpperCase();
  });

  readonly roleLabel = computed(() => {
    switch (normalizeRole(this.user()?.role)) {
      case 'ADMIN':
        return 'Admin';
      case 'DOCTOR':
        return 'Doctor';
      case 'PATIENT':
        return 'Patient';
      default:
        return '';
    }
  });

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
