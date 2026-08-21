import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AppointmentService } from '../../../core/services/appointment.service';
import type { Appointment } from '../../../core/services/appointment.service';
import { AuthService } from '../../../auth/auth.service';
import { DoctorNamePipe } from '../../../core/pipes/doctor-name.pipe';

@Component({
  selector: 'app-doctor-appointments',
  imports: [DoctorNamePipe],
  templateUrl: './doctor-appointments.component.html',
  styleUrls: ['./doctor-appointments.component.scss'],
})
export class DoctorAppointmentsComponent {
  private readonly appointmentService = inject(AppointmentService);
  private readonly authService = inject(AuthService);

  readonly appointments = signal<Appointment[]>([]);
  readonly appointmentsLoading = signal(true);
  readonly appointmentsError = signal<string | null>(null);
  readonly actionInProgress = signal<{ id: number; kind: 'accept' | 'reject' } | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly user = this.authService.user;

  readonly rawDoctorName = computed(() => {
    const fromAppointment = this.appointments()[0]?.doctorName?.trim();
    if (fromAppointment) return fromAppointment;
    return deriveNameFromEmail(this.user()?.email);
  });

  readonly doctorSpecialty = computed(() => this.appointments()[0]?.doctorSpecialty?.trim() ?? '');

  readonly pendingCount = computed(() => this.appointments().filter((a) => a.status === 'PENDING').length);
  readonly todayCount = computed(() => this.todayAppointments().length);
  readonly upcomingCount = computed(() => this.upcomingAppointments().length);
  readonly completedCount = computed(() => this.appointments().filter((a) => a.status === 'COMPLETED').length);

  readonly pendingAppointments = computed(() =>
    this.appointments()
      .filter((a) => a.status === 'PENDING')
      .sort((a, b) => toLocalDateTime(a).getTime() - toLocalDateTime(b).getTime()),
  );

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

  constructor() {
    this.loadAppointments();
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

  actionPending(id: number, kind: 'accept' | 'reject'): boolean {
    const current = this.actionInProgress();
    return current !== null && current.id === id && current.kind === kind;
  }

  acceptRequest(appointment: Appointment): void { this.respond(appointment, 'accept'); }
  rejectRequest(appointment: Appointment): void { this.respond(appointment, 'reject'); }

  private respond(appointment: Appointment, action: 'accept' | 'reject'): void {
    if (this.actionInProgress() !== null) return;
    this.actionInProgress.set({ id: appointment.id, kind: action });
    this.actionError.set(null);
    const call =
      action === 'accept'
        ? this.appointmentService.acceptAppointment(appointment.id)
        : this.appointmentService.rejectAppointment(appointment.id);
    call.pipe(finalize(() => this.actionInProgress.set(null))).subscribe({
      next: () => this.loadAppointments(),
      error: () =>
        this.actionError.set(
          action === 'accept'
            ? `Could not accept the request from ${appointment.patientName}. Please try again.`
            : `Could not reject the request from ${appointment.patientName}. Please try again.`,
        ),
    });
  }

  notesText(notes: string | null): string { return (notes ?? '').trim() || '—'; }

  appointmentSlot(appointment: Appointment): string {
    return `${formatDate(appointment.appointmentDate)} · ${formatTime(appointment.appointmentTime)}`;
  }

  appointmentTime(appointment: Appointment): string { return formatTime(appointment.appointmentTime); }

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

  patientInitials(patientName: string): string { return initialsFromName(patientName); }
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

function isAccepted(status: string): boolean { return status === 'CONFIRMED' || status === 'IN_PROGRESS' || status === 'COMPLETED'; }

function initialsFromName(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function deriveNameFromEmail(email: string | undefined): string {
  const local = (email ?? '').split('@')[0] ?? '';
  if (!local) return '';
  const parts = local
    .split(/[._-]/)
    .map((p) => p.replace(/[^a-zA-Z]/g, ''))
    .filter((p) => p && !/^dr$/i.test(p));
  if (parts.length === 0) return '';
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}
