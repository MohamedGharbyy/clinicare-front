import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AdminService } from '../../../core/services/admin.service';
import type { AdminPatient } from '../../../core/services/admin.service';

@Component({
  selector: 'app-admin-patients',
  imports: [],
  templateUrl: './admin-patients.component.html',
  styleUrls: ['./admin-patients.component.scss'],
})
export class AdminPatientsComponent {
  private readonly adminService = inject(AdminService);

  readonly patients = signal<AdminPatient[]>([]);
  readonly patientsFilter = signal('');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastRefreshed = signal<Date | null>(null);

  readonly filteredPatients = computed(() => {
    const query = this.patientsFilter().trim().toLowerCase();
    if (!query) return this.patients();
    return this.patients().filter(
      (p) =>
        matches(p.name, query) ||
        matches(p.email, query) ||
        matches(p.phoneNumber, query),
    );
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.adminService
      .getPatients()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => {
          this.patients.set(list);
          this.lastRefreshed.set(new Date());
        },
        error: () => this.error.set('Could not load patients. Please try again.'),
      });
  }

  onPatientsFilterChange(event: Event): void {
    this.patientsFilter.set((event.target as HTMLInputElement).value);
  }

  patientInitials(name: string): string {
    return initialsFromName(name);
  }

  birthDate(dateOfBirth: string | null): string {
    return formatDate(dateOfBirth);
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

function formatDate(date: string | null): string {
  if (!date) return '—';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRegisteredAt(registeredAt: string | null): string {
  if (!registeredAt) return '—';
  const parsed = new Date(registeredAt);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
