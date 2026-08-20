import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AdminService } from '../../../core/services/admin.service';
import type { AdminDoctor } from '../../../core/services/admin.service';
import { DoctorNamePipe } from '../../../core/pipes/doctor-name.pipe';

@Component({
  selector: 'app-admin-doctors',
  imports: [DoctorNamePipe],
  templateUrl: './admin-doctors.component.html',
  styleUrls: ['./admin-doctors.component.scss'],
})
export class AdminDoctorsComponent {
  private readonly adminService = inject(AdminService);

  readonly doctors = signal<AdminDoctor[]>([]);
  readonly doctorsFilter = signal('');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastRefreshed = signal<Date | null>(null);

  readonly filteredDoctors = computed(() => {
    const query = this.doctorsFilter().trim().toLowerCase();
    if (!query) return this.doctors();
    return this.doctors().filter(
      (d) =>
        matches(d.name, query) ||
        matches(d.email, query) ||
        matches(d.specialty, query) ||
        matches(d.licenseNumber, query),
    );
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.adminService
      .getDoctors()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => {
          this.doctors.set(list);
          this.lastRefreshed.set(new Date());
        },
        error: () => this.error.set('Could not load doctors. Please try again.'),
      });
  }

  onDoctorsFilterChange(event: Event): void {
    this.doctorsFilter.set((event.target as HTMLInputElement).value);
  }

  doctorInitials(name: string): string {
    return initialsFromName(name);
  }

  registeredAt(registeredAt: string | null): string {
    return formatRegisteredAt(registeredAt);
  }

  orDash(value: string | null | undefined): string {
    return (value ?? '').trim() || '—';
  }

  refreshLabel(): string {
    const date = this.lastRefreshed();
    if (!date) return '';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
}

function initialsFromName(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function matches(value: string | null | undefined, query: string): boolean {
  return (value ?? '').toLowerCase().includes(query);
}

function formatRegisteredAt(registeredAt: string | null): string {
  if (!registeredAt) return '—';
  const parsed = new Date(registeredAt);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
