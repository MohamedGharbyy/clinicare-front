import { Component, computed, inject, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';
import { AdminService } from '../../../core/services/admin.service';
import type { AdminUser, AccountStatus } from '../../../core/services/admin.service';

type Scope = 'ACTIVE' | 'DELETED';
type RoleFilter = 'ALL' | 'PATIENT' | 'DOCTOR';
type StatusFilter = 'ALL' | 'ACTIVE' | 'DISABLED' | 'BANNED';

/**
 * Admin "User Management" page: lists PATIENT and DOCTOR accounts and lets an
 * Admin search/filter them, disable, temporarily ban, re-enable, or soft-delete
 * accounts. Admin accounts are protected by the backend. Deleted accounts are
 * shown in a separate scope so their history survives the soft delete.
 */
@Component({
  selector: 'app-admin-user-management',
  imports: [],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss',
})
export class AdminUserManagementComponent {
  private readonly adminService = inject(AdminService);

  readonly activeUsers = signal<AdminUser[]>([]);
  readonly deletedUsers = signal<AdminUser[]>([]);
  readonly scope = signal<Scope>('ACTIVE');
  readonly search = signal('');
  readonly roleFilter = signal<RoleFilter>('ALL');
  readonly statusFilter = signal<StatusFilter>('ALL');

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastRefreshed = signal<Date | null>(null);
  readonly actionSuccess = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly busyId = signal<number | null>(null);

  readonly userToDelete = signal<AdminUser | null>(null);
  readonly deleting = signal(false);
  readonly userToBan = signal<AdminUser | null>(null);
  readonly banDuration = signal<number>(1);
  readonly banning = signal(false);

  readonly filteredUsers = computed<AdminUser[]>(() => {
    const source = this.scope() === 'ACTIVE' ? this.activeUsers() : this.deletedUsers();
    const query = this.search().trim().toLowerCase();
    const role = this.roleFilter();
    const status = this.statusFilter();
    return source.filter((u) => {
      if (this.scope() === 'ACTIVE' && status !== 'ALL' && u.status !== status) return false;
      if (role !== 'ALL' && u.role !== role) return false;
      if (!query) return true;
      return matches(u.name, query) || matches(u.email, query);
    });
  });

  readonly counts = computed(() => ({
    active: this.activeUsers().length,
    deleted: this.deletedUsers().length,
  }));

  constructor() {
    this.load();
  }

  load(preserveFeedback = false): void {
    this.loading.set(true);
    this.error.set(null);
    if (!preserveFeedback) {
      this.actionSuccess.set(null);
      this.actionError.set(null);
    }
    forkJoin({
      active: this.adminService.getUsers(false),
      deleted: this.adminService.getUsers(true),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ active, deleted }) => {
          this.activeUsers.set(active);
          this.deletedUsers.set(deleted.filter((u) => u.status === 'DELETED'));
          this.lastRefreshed.set(new Date());
        },
        error: () => this.error.set('Could not load users. Please try again.'),
      });
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  setScope(scope: Scope): void {
    this.scope.set(scope);
    this.search.set('');
    this.statusFilter.set('ALL');
  }

  setRoleFilter(role: RoleFilter): void {
    this.roleFilter.set(role);
  }

  setStatusFilter(status: StatusFilter): void {
    this.statusFilter.set(status);
  }

  // ---- Actions ----

  openDeleteModal(user: AdminUser): void {
    this.actionSuccess.set(null);
    this.actionError.set(null);
    this.userToDelete.set(user);
  }

  closeDeleteModal(): void {
    if (this.deleting()) return;
    this.userToDelete.set(null);
  }

  confirmDelete(): void {
    const user = this.userToDelete();
    if (!user || this.deleting()) return;
    this.deleting.set(true);
    this.actionError.set(null);
    this.adminService
      .deleteUser(user.id)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe({
        next: () => {
          this.userToDelete.set(null);
          this.actionSuccess.set(`${user.name} was deleted. Their history is preserved.`);
          this.load(true);
        },
        error: (err) => {
          this.userToDelete.set(null);
          this.actionError.set(err?.error?.message ?? `Could not delete ${user.name}.`);
        },
      });
  }

  openBanModal(user: AdminUser): void {
    this.actionSuccess.set(null);
    this.actionError.set(null);
    this.banDuration.set(1);
    this.userToBan.set(user);
  }

  closeBanModal(): void {
    if (this.banning()) return;
    this.userToBan.set(null);
  }

  confirmBan(): void {
    const user = this.userToBan();
    if (!user || this.banning()) return;
    this.banning.set(true);
    this.actionError.set(null);
    this.adminService
      .banUser(user.id, this.banDuration())
      .pipe(finalize(() => this.banning.set(false)))
      .subscribe({
        next: () => {
          this.userToBan.set(null);
          this.actionSuccess.set(`${user.name} was banned for ${this.banDuration()} day(s).`);
          this.load(true);
        },
        error: (err) => {
          this.userToBan.set(null);
          this.actionError.set(err?.error?.message ?? `Could not ban ${user.name}.`);
        },
      });
  }

  toggleDisable(user: AdminUser): void {
    const op = user.status === 'DISABLED' ? this.adminService.enableUser(user.id) : this.adminService.disableUser(user.id);
    this.runAction(user, op, user.status === 'DISABLED' ? 'enabled' : 'disabled');
  }

  enable(user: AdminUser): void {
    this.runAction(user, this.adminService.enableUser(user.id), 'enabled');
  }

  private runAction(user: AdminUser, op: ReturnType<AdminService['enableUser']>, verb: string): void {
    this.busyId.set(user.id);
    this.actionError.set(null);
    this.actionSuccess.set(null);
    op.pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: (updated) => {
        this.actionSuccess.set(`${updated.name} was ${verb}.`);
        this.load(true);
      },
      error: (err) => {
        this.actionError.set(err?.error?.message ?? `Could not update ${user.name}.`);
      },
    });
  }

  dismissSuccess(): void {
    this.actionSuccess.set(null);
  }

  dismissError(): void {
    this.actionError.set(null);
  }

  // ---- Presentation helpers ----

  statusClass(status: AccountStatus): string {
    switch (status) {
      case 'ACTIVE':
        return 'is-active';
      case 'DISABLED':
        return 'is-disabled';
      case 'BANNED':
        return 'is-banned';
      case 'DELETED':
        return 'is-deleted';
      default:
        return '';
    }
  }

  roleClass(role: string): string {
    return role === 'DOCTOR' ? 'is-doctor' : 'is-patient';
  }

  canDisable(user: AdminUser): boolean {
    return user.status === 'ACTIVE' || user.status === 'BANNED';
  }

  canEnable(user: AdminUser): boolean {
    return user.status === 'DISABLED' || user.status === 'BANNED';
  }

  canBan(user: AdminUser): boolean {
    return user.status === 'ACTIVE' || user.status === 'DISABLED';
  }

  userInitials(name: string): string {
    return initialsFromName(name);
  }

  orDash(value: string | null | undefined): string {
    return (value ?? '').trim() || '—';
  }

  registeredAt(registeredAt: string): string {
    return formatDateTime(registeredAt);
  }

  banExpiry(banExpiresAt: string | null): string {
    return formatDateTime(banExpiresAt);
  }

  deletedAt(deletedAt: string | null): string {
    return formatDateTime(deletedAt);
  }

  refreshLabel(): string {
    const date = this.lastRefreshed();
    if (!date) return '';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
}

function matches(value: string | null | undefined, query: string): boolean {
  return (value ?? '').toLowerCase().includes(query);
}

function initialsFromName(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
