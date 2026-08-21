import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AdminService } from '../../../core/services/admin.service';
import type { Appointment } from '../../../core/services/appointment.service';
import { DoctorNamePipe } from '../../../core/pipes/doctor-name.pipe';

export type AppointmentStatusFilter =
  | 'ALL'
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

@Component({
  selector: 'app-admin-appointments',
  imports: [DoctorNamePipe],
  templateUrl: './admin-appointments.component.html',
  styleUrls: ['./admin-appointments.component.scss'],
})
export class AdminAppointmentsComponent {
  private readonly adminService = inject(AdminService);

  readonly appointments = signal<Appointment[]>([]);
  readonly appointmentsFilter = signal('');
  readonly appointmentStatusFilter = signal<AppointmentStatusFilter>('ALL');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastRefreshed = signal<Date | null>(null);
  readonly appointmentToCancel = signal<Appointment | null>(null);
  readonly cancelling = signal(false);
  readonly actionSuccess = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly filteredAppointments = computed(() => {
    const query = this.appointmentsFilter().trim().toLowerCase();
    const statusFilter = this.appointmentStatusFilter();
    return this.appointments().filter((a) => {
      const matchesStatus = statusFilter === 'ALL' ? true : a.status === statusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;
      return (
        matches(a.patientName, query) ||
        matches(a.doctorName, query) ||
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
      inProgress: list.filter((a) => a.status === 'IN_PROGRESS').length,
      completed: list.filter((a) => a.status === 'COMPLETED').length,
      cancelled: list.filter((a) => a.status === 'CANCELLED').length,
      rejected: list.filter((a) => a.status === 'REJECTED').length,
    };
  });

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
    this.adminService
      .getAppointments()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => {
          this.appointments.set(list);
          this.lastRefreshed.set(new Date());
        },
        error: () => this.error.set('Could not load appointments. Please try again.'),
      });
  }

  onAppointmentsFilterChange(event: Event): void {
    this.appointmentsFilter.set((event.target as HTMLInputElement).value);
  }

  setStatusFilter(status: AppointmentStatusFilter): void {
    this.appointmentStatusFilter.set(status);
  }

  openCancelModal(appointment: Appointment): void {
    this.actionSuccess.set(null);
    this.actionError.set(null);
    this.appointmentToCancel.set(appointment);
  }

  closeCancelModal(): void {
    if (this.cancelling()) return;
    this.appointmentToCancel.set(null);
  }

  confirmCancelAppointment(): void {
    const appointment = this.appointmentToCancel();
    if (!appointment || this.cancelling()) return;
    this.cancelling.set(true);
    this.actionError.set(null);
    this.adminService
      .cancelAppointment(appointment.id)
      .pipe(finalize(() => this.cancelling.set(false)))
      .subscribe({
        next: () => {
          this.appointmentToCancel.set(null);
          this.actionSuccess.set(`Appointment #${appointment.id} for ${appointment.patientName} was cancelled successfully.`);
          this.load(true);
        },
        error: (err) => {
          const message = err?.error?.message ?? `Could not cancel appointment #${appointment.id}. Please try again.`;
          this.actionError.set(message);
          this.appointmentToCancel.set(null);
        },
      });
  }

  dismissSuccess(): void { this.actionSuccess.set(null); }
  dismissError(): void { this.actionError.set(null); }

  isCancelable(appointment: Appointment): boolean {
    return appointment.status === 'PENDING' || appointment.status === 'CONFIRMED';
  }

  appointmentSlot(appointment: Appointment): string {
    return `${formatAppointmentDate(appointment.appointmentDate)} · ${formatTime(appointment.appointmentTime)}`;
  }

  statusClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'is-pending';
      case 'CONFIRMED': return 'is-confirmed';
      case 'IN_PROGRESS': return 'is-in-progress';
      case 'COMPLETED': return 'is-completed';
      case 'CANCELLED': return 'is-cancelled';
      case 'REJECTED': return 'is-negative';
      default: return '';
    }
  }

  appointmentPatientInitials(name: string): string { return initialsFromName(name); }
  appointmentDoctorInitials(name: string): string { return initialsFromName(name); }
  orDash(value: string | null | undefined): string { return (value ?? '').trim() || '—'; }
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

function formatAppointmentDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
