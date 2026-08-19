import { Component, computed, inject, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';

import { AuthService } from '../../../auth/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import type {
  AdminDashboard,
  AdminDoctor,
  AdminPatient,
} from '../../../core/services/admin.service';
import type { Appointment } from '../../../core/services/appointment.service';
import { DoctorNamePipe } from '../../../core/pipes/doctor-name.pipe';

export type AppointmentStatusFilter =
  | 'ALL'
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

/** Converts a backend `yyyy-MM-dd` value to a short label, e.g. "1990-05-14" -> "May 14, 1990". */
function formatDate(date: string | null): string {
  if (!date) {
    return '—';
  }
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Converts a backend date-time (ISO or `yyyy-MM-ddTHH:mm:ss`) to "Aug 19, 2026". */
function formatRegisteredAt(registeredAt: string | null): string {
  if (!registeredAt) {
    return '—';
  }
  const parsed = new Date(registeredAt);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Converts an appointment date to a short weekday label, e.g. "2026-08-27" -> "Thu, Aug 27". */
function formatAppointmentDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Converts a backend `HH:mm:ss` value to a 12-hour label, e.g. "14:30:00" -> "2:30 PM". */
function formatTime(time: string): string {
  const match = /^(\d{2}):(\d{2})/.exec(time);
  if (!match) {
    return time;
  }
  const hours = Number(match[1]);
  const minutes = match[2];
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${minutes} ${period}`;
}

/** Two-letter avatar initials from a name, e.g. "Sarah Mitchell" -> "SM". */
function initialsFromName(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** Case-insensitive substring match across the text searchable in a table. */
function matches(value: string | null | undefined, query: string): boolean {
  return (value ?? '').toLowerCase().includes(query);
}

/**
 * Admin dashboard shell.
 *
 * Sourced entirely from the real admin API endpoints:
 * - `GET /api/admin/dashboard` for live summary counters
 * - `GET /api/admin/patients` for patient records
 * - `GET /api/admin/doctors` for registered doctor records
 * - `GET /api/admin/appointments` for platform-wide appointments
 * - `DELETE /api/admin/appointments/{id}` for administrative appointment cancellation
 */
@Component({
  selector: 'app-admin-dashboard',
  imports: [DoctorNamePipe],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent {
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthService);

  /** Authenticated admin — email and role are the identity available from the JWT. */
  readonly user = this.authService.user;

  /** Live summary counters, loaded from the backend. */
  readonly summary = signal<AdminDashboard | null>(null);

  /** All registered patients, loaded from the backend. */
  readonly patients = signal<AdminPatient[]>([]);

  /** All registered doctors, loaded from the backend. */
  readonly doctors = signal<AdminDoctor[]>([]);

  /** All appointments across the platform, loaded from the backend. */
  readonly appointments = signal<Appointment[]>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** Timestamp of the most recent successful data load, for the "last updated" label. */
  readonly lastRefreshed = signal<Date | null>(null);

  /** Local (client-side) search text for the patients table. */
  readonly patientsFilter = signal('');

  /** Local (client-side) search text for the doctors table. */
  readonly doctorsFilter = signal('');

  /** Local (client-side) search text for the appointments table. */
  readonly appointmentsFilter = signal('');

  /** Active status tab filter for the appointments table. */
  readonly appointmentStatusFilter = signal<AppointmentStatusFilter>('ALL');

  /** Appointment currently pending cancellation confirmation. */
  readonly appointmentToCancel = signal<Appointment | null>(null);

  /** Indicates an administrative cancellation request is currently inflight. */
  readonly cancelling = signal(false);

  /** Banner feedback messages for administrative actions. */
  readonly actionSuccess = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  /** Value shown inside each summary card; null renders as '—' while loading. */
  readonly totalPatients = computed(() => this.summary()?.totalPatients ?? null);
  readonly totalDoctors = computed(() => this.summary()?.totalDoctors ?? null);
  readonly totalAppointments = computed(() => this.summary()?.totalAppointments ?? null);

  /** Counts per appointment status for the quick filter pills. */
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

  /** Patients narrowed by the search box (name, email, or phone). */
  readonly filteredPatients = computed(() => {
    const query = this.patientsFilter().trim().toLowerCase();
    if (!query) {
      return this.patients();
    }
    return this.patients().filter(
      (patient) =>
        matches(patient.name, query) ||
        matches(patient.email, query) ||
        matches(patient.phoneNumber, query),
    );
  });

  /** Doctors narrowed by the search box (name, email, specialty, or license). */
  readonly filteredDoctors = computed(() => {
    const query = this.doctorsFilter().trim().toLowerCase();
    if (!query) {
      return this.doctors();
    }
    return this.doctors().filter(
      (doctor) =>
        matches(doctor.name, query) ||
        matches(doctor.email, query) ||
        matches(doctor.specialty, query) ||
        matches(doctor.licenseNumber, query),
    );
  });

  /** Appointments narrowed by both the search query and the selected status filter. */
  readonly filteredAppointments = computed(() => {
    const query = this.appointmentsFilter().trim().toLowerCase();
    const statusFilter = this.appointmentStatusFilter();

    return this.appointments().filter((appointment) => {
      const matchesStatus =
        statusFilter === 'ALL' ? true : appointment.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        matches(appointment.patientName, query) ||
        matches(appointment.doctorName, query) ||
        matches(appointment.reason, query) ||
        matches(appointment.status, query)
      );
    });
  });

  /** Human-readable "last updated" label, e.g. "10:42 AM". */
  readonly refreshLabel = computed(() => {
    const date = this.lastRefreshed();
    if (!date) {
      return '';
    }
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  });

  constructor() {
    this.load();
  }

  /** Loads the summary counters and all three management lists in parallel. */
  load(preserveFeedback = false): void {
    this.loading.set(true);
    this.error.set(null);
    if (!preserveFeedback) {
      this.actionSuccess.set(null);
      this.actionError.set(null);
    }

    forkJoin({
      summary: this.adminService.getDashboard(),
      patients: this.adminService.getPatients(),
      doctors: this.adminService.getDoctors(),
      appointments: this.adminService.getAppointments(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ summary, patients, doctors, appointments }) => {
          this.summary.set(summary);
          this.patients.set(patients);
          this.doctors.set(doctors);
          this.appointments.set(appointments);
          this.lastRefreshed.set(new Date());
        },
        error: () => {
          this.error.set('Could not load the admin dashboard. Please try again.');
        },
      });
  }

  onPatientsFilterChange(event: Event): void {
    this.patientsFilter.set((event.target as HTMLInputElement).value);
  }

  onDoctorsFilterChange(event: Event): void {
    this.doctorsFilter.set((event.target as HTMLInputElement).value);
  }

  onAppointmentsFilterChange(event: Event): void {
    this.appointmentsFilter.set((event.target as HTMLInputElement).value);
  }

  setStatusFilter(status: AppointmentStatusFilter): void {
    this.appointmentStatusFilter.set(status);
  }

  /** Opens the cancellation confirmation dialog for an appointment. */
  openCancelModal(appointment: Appointment): void {
    this.actionSuccess.set(null);
    this.actionError.set(null);
    this.appointmentToCancel.set(appointment);
  }

  /** Closes the cancellation dialog. */
  closeCancelModal(): void {
    if (this.cancelling()) {
      return;
    }
    this.appointmentToCancel.set(null);
  }

  /** Submits the cancellation action to the backend. */
  confirmCancelAppointment(): void {
    const appointment = this.appointmentToCancel();
    if (!appointment || this.cancelling()) {
      return;
    }

    this.cancelling.set(true);
    this.actionError.set(null);

    this.adminService
      .cancelAppointment(appointment.id)
      .pipe(finalize(() => this.cancelling.set(false)))
      .subscribe({
        next: () => {
          this.appointmentToCancel.set(null);
          this.actionSuccess.set(
            `Appointment #${appointment.id} for ${appointment.patientName} was cancelled successfully.`,
          );
          // Reload dashboard data while preserving the success notification
          this.load(true);
        },
        error: (err) => {
          const message =
            err?.error?.message ??
            `Could not cancel appointment #${appointment.id}. Please try again.`;
          this.actionError.set(message);
          this.appointmentToCancel.set(null);
        },
      });
  }

  dismissSuccess(): void {
    this.actionSuccess.set(null);
  }

  dismissError(): void {
    this.actionError.set(null);
  }

  /** True if the appointment is in a status eligible for administrative cancellation. */
  isCancelable(appointment: Appointment): boolean {
    return appointment.status === 'PENDING' || appointment.status === 'CONFIRMED';
  }

  /** Avatar initials for a patient row. */
  patientInitials(name: string): string {
    return initialsFromName(name);
  }

  /** Avatar initials for a doctor row. */
  doctorInitials(name: string): string {
    return initialsFromName(name);
  }

  /** Human-friendly birth date for a patient row. */
  birthDate(dateOfBirth: string | null): string {
    return formatDate(dateOfBirth);
  }

  /** Human-friendly registration date for a list row. */
  registeredAt(registeredAt: string | null): string {
    return formatRegisteredAt(registeredAt);
  }

  /** Placeholder for optional fields in a table cell. */
  orDash(value: string | null | undefined): string {
    return (value ?? '').trim() || '—';
  }

  /** Avatar initials for an appointment's patient. */
  appointmentPatientInitials(name: string): string {
    return initialsFromName(name);
  }

  /** Avatar initials for an appointment's doctor. */
  appointmentDoctorInitials(name: string): string {
    return initialsFromName(name);
  }

  /** Human-friendly date/time slot for an appointment row, e.g. "Thu, Aug 27 · 10:00 AM". */
  appointmentSlot(appointment: Appointment): string {
    return `${formatAppointmentDate(appointment.appointmentDate)} · ${formatTime(appointment.appointmentTime)}`;
  }

  /** Semantic CSS class for an appointment's status pill. */
  statusClass(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'is-pending';
      case 'CONFIRMED':
        return 'is-confirmed';
      case 'COMPLETED':
        return 'is-completed';
      case 'CANCELLED':
        return 'is-cancelled';
      case 'REJECTED':
        return 'is-negative';
      default:
        return '';
    }
  }
}
