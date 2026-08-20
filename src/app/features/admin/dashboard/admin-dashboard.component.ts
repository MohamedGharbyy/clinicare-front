import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../auth/auth.service';
import type { AdminDashboard } from '../../../core/services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent {
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthService);

  readonly user = this.authService.user;
  readonly summary = signal<AdminDashboard | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastRefreshed = signal<Date | null>(null);

  readonly totalPatients = computed(() => this.summary()?.totalPatients ?? null);
  readonly totalDoctors = computed(() => this.summary()?.totalDoctors ?? null);
  readonly totalAppointments = computed(() => this.summary()?.totalAppointments ?? null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.adminService
      .getDashboard()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.summary.set(data);
          this.lastRefreshed.set(new Date());
        },
        error: () => this.error.set('Could not load the admin dashboard. Please try again.'),
      });
  }

  refreshLabel(): string {
    const date = this.lastRefreshed();
    if (!date) return '';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
}
