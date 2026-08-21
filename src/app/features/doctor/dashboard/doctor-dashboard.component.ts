import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '../../../auth/auth.service';
import { AppointmentService } from '../../../core/services/appointment.service';
import type { Appointment } from '../../../core/services/appointment.service';
import { DoctorService } from '../../../core/services/doctor.service';
import type { DoctorProfile } from '../../../core/services/doctor.service';
import { DoctorNamePipe } from '../../../core/pipes/doctor-name.pipe';
import { RouterLink } from '@angular/router';

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

function localDateToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalDateTime(appointment: Appointment): Date {
  return new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}`);
}

function isFuture(appointment: Appointment): boolean {
  const d = toLocalDateTime(appointment);
  return !Number.isNaN(d.getTime()) && d.getTime() > Date.now();
}

function isAccepted(status: string): boolean {
  return status === 'CONFIRMED' || status === 'IN_PROGRESS' || status === 'COMPLETED';
}

function initialsFromName(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

@Component({
  selector: 'app-doctor-dashboard',
  imports: [DoctorNamePipe, RouterLink],
  templateUrl: './doctor-dashboard.component.html',
  styleUrls: ['./doctor-dashboard.component.scss'],
})
export class DoctorDashboardComponent {
  private readonly appointmentService = inject(AppointmentService);
  private readonly authService = inject(AuthService);
  private readonly doctorService = inject(DoctorService);

  readonly appointments = signal<Appointment[]>([]);
  readonly appointmentsLoading = signal(true);
  readonly appointmentsError = signal<string | null>(null);
  readonly user = this.authService.user;
  readonly profile = signal<DoctorProfile | null>(null);

  /**
   * Display name built from the authenticated doctor's real first and last
   * name, as returned by {@code GET /api/doctor/profile} (sourced from the
   * `users` table). The {@code Dr.} prefix is applied by {@link DoctorNamePipe}.
   */
  readonly rawDoctorName = computed(() => {
    const p = this.profile();
    if (!p) return '';
    return [p.firstName, p.lastName]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(' ')
      .trim();
  });

  readonly doctorSpecialty = computed(() => this.profile()?.specialty?.trim() ?? '');

  readonly pendingCount = computed(() => this.appointments().filter((a) => a.status === 'PENDING').length);
  readonly todayCount = computed(() => this.todayAppointments().length);
  readonly upcomingCount = computed(() => this.upcomingAppointments().length);
  readonly completedCount = computed(() => this.appointments().filter((a) => a.status === 'COMPLETED').length);

  readonly todayAppointments = computed(() =>
    this.appointments()
      .filter((a) => a.appointmentDate === localDateToday() && isAccepted(a.status))
      .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime)),
  );

  readonly upcomingAppointments = computed(() =>
    this.appointments()
      .filter(
        (a) => a.appointmentDate !== localDateToday() && isFuture(a) && isAccepted(a.status),
      )
      .sort((a, b) => toLocalDateTime(a).getTime() - toLocalDateTime(b).getTime()),
  );

  readonly nextUpcomingAppointment = computed(
    () => this.upcomingAppointments().filter((a) => a.status === 'CONFIRMED')[0] ?? null,
  );

  readonly upcomingAppointmentLabel = computed(() => {
    const appointment = this.nextUpcomingAppointment();
    if (!appointment) return '—';
    return `${formatDate(appointment.appointmentDate)} · ${formatTime(appointment.appointmentTime)}`;
  });

  constructor() {
    this.loadAppointments();
    this.loadProfile();
  }

  private loadProfile(): void {
    this.doctorService.getProfile().subscribe({
      next: (profile) => this.profile.set(profile),
      error: () => this.profile.set(null),
    });
  }

  loadAppointments(): void {
    this.appointmentsLoading.set(true);
    this.appointmentsError.set(null);
    this.appointmentService
      .getDoctorAppointments()
      .pipe(finalize(() => this.appointmentsLoading.set(false)))
      .subscribe({
        next: (list) => this.appointments.set(list),
        error: () => this.appointmentsError.set('Could not load your appointments. Please try again.'),
      });
  }

  appointmentSlot(appointment: Appointment): string {
    return `${formatDate(appointment.appointmentDate)} · ${formatTime(appointment.appointmentTime)}`;
  }

  statusClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'is-pending';
      case 'CONFIRMED': return 'is-confirmed';
      case 'IN_PROGRESS': return 'is-in-progress';
      case 'COMPLETED': return 'is-completed';
      case 'REJECTED':
      case 'CANCELLED': return 'is-negative';
      default: return '';
    }
  }
}
