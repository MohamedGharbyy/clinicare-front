import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../auth/auth.service';
import { normalizeRole } from '../../auth/jwt.utils';
import type { UserRole } from '../../auth/auth.models';

/** Icon keys rendered by the shared sidebar icon template. */
type NavIcon =
  | 'dashboard'
  | 'appointments'
  | 'schedule'
  | 'users'
  | 'records'
  | 'prescriptions'
  | 'messages'
  | 'settings';

/** A single entry in the role-specific sidebar. */
interface DashboardNavItem {
  label: string;
  icon: NavIcon;
  /**
   * Router URL the item navigates to. When absent the entry is a
   * "coming soon" placeholder (no route exists for it yet).
   */
  route?: string;
}

/** A labelled group of sidebar entries. */
interface DashboardNavSection {
  label: string;
  items: DashboardNavItem[];
}

/** Home page of each role — where the brand and avatar link. */
const ROLE_DASHBOARD_URL: Record<UserRole, string> = {
  PATIENT: '/patient/dashboard',
  DOCTOR: '/doctor/dashboard',
  ADMIN: '/admin/dashboard',
};

/**
 * Sidebar structure per role. Only the dashboard entry has a live route today;
 * the remaining items describe the app's planned feature areas and are shown
 * as disabled placeholders until those pages exist.
 */
const NAV_BY_ROLE: Record<UserRole, DashboardNavSection[]> = {
  PATIENT: [
    {
      label: 'Menu',
      items: [{ label: 'Dashboard', icon: 'dashboard', route: '/patient/dashboard' }],
    },
    {
      label: 'Care',
      items: [
        { label: 'Appointments', icon: 'appointments' },
        { label: 'Medical records', icon: 'records' },
        { label: 'Prescriptions', icon: 'prescriptions' },
        { label: 'Messages', icon: 'messages' },
      ],
    },
    {
      label: 'Account',
      items: [{ label: 'Profile & settings', icon: 'settings' }],
    },
  ],
  DOCTOR: [
    {
      label: 'Menu',
      items: [
        { label: 'Dashboard', icon: 'dashboard', route: '/doctor/dashboard' },
        { label: 'Schedule', icon: 'schedule' },
      ],
    },
    {
      label: 'Practice',
      items: [
        { label: 'Patients', icon: 'users' },
        { label: 'Appointments', icon: 'appointments' },
        { label: 'Medical records', icon: 'records' },
        { label: 'Messages', icon: 'messages' },
      ],
    },
    {
      label: 'Account',
      items: [{ label: 'Profile & settings', icon: 'settings' }],
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
        { label: 'Users', icon: 'users' },
        { label: 'Doctors', icon: 'users' },
        { label: 'Patients', icon: 'users' },
        { label: 'Appointments', icon: 'appointments' },
      ],
    },
    {
      label: 'System',
      items: [{ label: 'Settings', icon: 'settings' }],
    },
  ],
};

/**
 * Dashboard shell shared by every role: a clean top navbar, a role-aware
 * left sidebar and a routed main area. The routed children (the role
 * dashboards) render inside {@link main}.
 */
@Component({
  selector: 'app-dashboard-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet],
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.scss',
})
export class DashboardLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  /** Current authenticated user (null when logged out). */
  readonly user = this.authService.user;

  /** Sidebar visibility on small screens (off-canvas drawer). */
  readonly sidebarOpen = signal(false);

  /** Sidebar groups for the signed-in user's role. */
  readonly navSections = computed<DashboardNavSection[]>(() => {
    const role = normalizeRole(this.user()?.role);
    return role ? NAV_BY_ROLE[role] : [];
  });

  /** Where the brand links — always the user's own dashboard. */
  readonly dashboardUrl = computed(() => {
    const role = normalizeRole(this.user()?.role);
    return role ? ROLE_DASHBOARD_URL[role] : '/login';
  });

  /** Two-letter monogram shown in the navbar avatar. */
  readonly initials = computed(() => {
    const localPart = (this.user()?.email ?? '').split('@')[0] ?? '';
    return localPart.slice(0, 2).toUpperCase();
  });

  /** Human-friendly role label for the navbar chip. */
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
