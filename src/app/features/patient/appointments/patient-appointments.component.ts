import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AppointmentService } from '../../../core/services/appointment.service';
import type { Appointment } from '../../../core/services/appointment.service';

export type PatientAppointmentStatusFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';

@Component({
  selector: 'app-patient-appointments',
  templateUrl: './patient-appointments.component.html',
  styleUrls: ['./patient-appointments.component.scss'],
})
export class PatientAppointmentsComponent {
  private readonly appointmentService = inject(AppointmentService);

  readonly appointments = signal<Appointment[]>([]);
  readonly appointmentsFilter = signal('');
  readonly appointmentStatusFilter = signal<PatientAppointmentStatusFilter>('ALL');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly filteredAppointments = computed(() => {
    const query = this.appointmentsFilter().trim().toLowerCase();
    const statusFilter = this.appointmentStatusFilter();
    return this.appointments().filter((a) => {
      const matchesStatus = statusFilter === 'ALL' ? true : a.status === statusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;
      return (
        matches(a.doctorName, query) ||
        matches(a.doctorSpecialty, query) ||
        matches(a.reason, query) ||
        matches(a.status, query)
      );
    });
  });

  readonly statusCounts = computed(() => {
    const list = this.appointments();
    return {
      all: list.length,
      pending: list.filter((a) => a.status === 'PENDING').length,
      confirmed: list.filter((a) => a.status === 'CONFIRMED').length,
      completed: list.filter((a) => a.status === 'COMPLETED').length,
      cancelled: list.filter((a) => a.status === 'CANCELLED').length,
      rejected: list.filter((a) => a.status === 'REJECTED').length,
    };
  });

  constructor() {
    this.loadAppointments();
  }

  loadAppointments(): void {
    this.loading.set(true);
    this.error.set(null);
    this.appointmentService
      .getMyAppointments()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => this.appointments.set(list),
        error: () => this.error.set('Could not load your appointments. Please try again.'),
      });
  }

  onAppointmentsFilterChange(event: Event): void {
    this.appointmentsFilter.set((event.target as HTMLInputElement).value);
  }

  setStatusFilter(status: PatientAppointmentStatusFilter): void {
    this.appointmentStatusFilter.set(status);
  }

  appointmentSlot(appointment: Appointment): string {
    return `${formatDate(appointment.appointmentDate)} · ${formatTime(appointment.appointmentTime)}`;
  }

  statusClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'is-pending';
      case 'CONFIRMED': return 'is-confirmed';
      case 'COMPLETED': return 'is-completed';
      case 'CANCELLED': return 'is-cancelled';
      case 'REJECTED': return 'is-negative';
      default: return '';
    }
  }

  appointmentInitials(name: string | null | undefined): string {
    return initialsFromName(name ?? '');
  }
}

function formatTime(time: string): string {
  const match = /^(\d{2}):(\d{2})/.exec(time);
  if (!match) return time;
  const hours = Number(match[1]);
  const minutes = match[2];
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${minutes} ${period}`;
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
