import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { AuthService } from '../../../auth/auth.service';
import { DoctorNamePipe } from '../../../core/pipes/doctor-name.pipe';
import { AppointmentService } from '../../../core/services/appointment.service';
import type { Appointment } from '../../../core/services/appointment.service';

/** Converts a backend `HH:mm:ss` value to a 12-hour label, e.g. "10:00:00" -> "10:00 AM". */
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

/** Converts a backend `yyyy-MM-dd` date to a short label, e.g. "2026-08-27" -> "Wed, Aug 27". */
function formatDate(date: string): string {
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

/** Today's date in the browser's local timezone, formatted as `yyyy-MM-dd`. */
function localDateToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses a backend date+time pair into a local Date for ordering and comparison. */
function toLocalDateTime(appointment: Appointment): Date {
  return new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}`);
}

/** True when the appointment's scheduled slot is strictly in the future. */
function isFuture(appointment: Appointment): boolean {
  const d = toLocalDateTime(appointment);
  return !Number.isNaN(d.getTime()) && d.getTime() > Date.now();
}

/**
 * True when the appointment is part of the doctor's accepted schedule.
 * PENDING requests live in the "Pending" panel, and REJECTED/CANCELLED visits
 * are not scheduled, so only CONFIRMED (and COMPLETED once its slot has passed)
 * count as a scheduled visit.
 */
function isAccepted(status: string): boolean {
  return status === 'CONFIRMED' || status === 'COMPLETED';
}

/**
 * Doctor dashboard shell.
 *
 * The only appointment source for a doctor is the existing
 * `GET /api/doctor/appointments` endpoint, which returns every appointment
 * assigned to the authenticated doctor (resolved from the JWT). The summary
 * cards and listing sections below are derived from that single, real data
 * source on the client — mirroring how the patient dashboard derives its stats
 * from `/api/patient/appointments`. No mock data and no business-logic changes.
 */
@Component({
  selector: 'app-doctor-dashboard',
  imports: [DoctorNamePipe],
  templateUrl: './doctor-dashboard.component.html',
  styleUrls: ['./doctor-dashboard.component.scss', '../../../layout/dashboard-page.scss'],
})
export class DoctorDashboardComponent {
  private readonly appointmentService = inject(AppointmentService);
  private readonly authService = inject(AuthService);

  /** All appointments for the logged-in doctor, loaded from the backend. */
  readonly appointments = signal<Appointment[]>([]);

  readonly appointmentsLoading = signal(true);
  readonly appointmentsError = signal<string | null>(null);

  /** Request currently being accepted/rejected, or null when idle. */
  readonly actionInProgress = signal<{ id: number; kind: 'accept' | 'reject' } | null>(null);

  /** Error surfaced to the user when an accept/reject action fails. */
  readonly actionError = signal<string | null>(null);

  /** Authenticated user — used only as a last-resort name fallback. */
  readonly user = this.authService.user;

  /**
   * The logged-in doctor's full name. Sourced from real appointment data first
   * (every record carries its doctor's name, and all records share one doctor).
   * Falls back to a name parsed from the authenticated user's email when the
   * doctor has no appointments yet. Rendered via DoctorNamePipe to add the
   * "Dr. " prefix.
   */
  readonly rawDoctorName = computed(() => {
    const fromAppointment = this.appointments()[0]?.doctorName?.trim();
    if (fromAppointment) {
      return fromAppointment;
    }
    return deriveNameFromEmail(this.user()?.email);
  });

  /** The logged-in doctor's specialty, derived from real appointment data. */
  readonly doctorSpecialty = computed(
    () => this.appointments()[0]?.doctorSpecialty?.trim() ?? '',
  );

  // ---- Summary cards ----------------------------------------------------

  /** Appointment requests still awaiting the doctor's confirmation (any date). */
  readonly pendingCount = computed(
    () => this.appointments().filter((a) => a.status === 'PENDING').length,
  );

  /** Accepted appointments scheduled on today's local date. */
  readonly todayCount = computed(() => this.todayAppointments().length);

  /** Accepted appointments scheduled for a future day (after today). */
  readonly upcomingCount = computed(() => this.upcomingAppointments().length);

  /** Visits the doctor has already completed. */
  readonly completedCount = computed(
    () => this.appointments().filter((a) => a.status === 'COMPLETED').length,
  );

  // ---- Listing sections -----------------------------------------------------------

  /** Pending requests, soonest scheduled first. */
  readonly pendingAppointments = computed(() =>
    this.appointments()
      .filter((a) => a.status === 'PENDING')
      .sort((a, b) => toLocalDateTime(a).getTime() - toLocalDateTime(b).getTime()),
  );

  /**
   * Today's accepted slots (CONFIRMED/COMPLETED), earliest time first. PENDING
   * requests appear in the "Pending" panel, and REJECTED/CANCELLED visits are
   * not part of the doctor's schedule.
   */
  readonly todayAppointments = computed(() =>
    this.appointments()
      .filter(
        (a) => a.appointmentDate === localDateToday() && isAccepted(a.status),
      )
      .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime)),
  );

  /**
   * Accepted appointments in future days, soonest first. A slot turns COMPLETED
   * only after its time has passed, so an upcoming slot is always CONFIRMED.
   * PENDING/REJECTED/CANCELLED are excluded from the schedule.
   */
  readonly upcomingAppointments = computed(() =>
    this.appointments()
      .filter(
        (a) =>
          a.appointmentDate !== localDateToday() &&
          isFuture(a) &&
          isAccepted(a.status),
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
        error: () =>
          this.appointmentsError.set(
            'Could not load your appointments. Please try again.',
          ),
      });
  }

  /** True while the given kind of action is being applied to the request. */
  actionPending(id: number, kind: 'accept' | 'reject'): boolean {
    const current = this.actionInProgress();
    return current !== null && current.id === id && current.kind === kind;
  }

  /** Accepts a pending request, then refreshes the dashboard. */
  acceptRequest(appointment: Appointment): void {
    this.respond(appointment, 'accept');
  }

  /** Rejects a pending request, then refreshes the dashboard. */
  rejectRequest(appointment: Appointment): void {
    this.respond(appointment, 'reject');
  }

  /**
   * Applies an accept/reject action to a pending request and reloads the
   * dashboard on success so the request leaves the pending list and the summary
   * counters update immediately.
   */
  private respond(appointment: Appointment, action: 'accept' | 'reject'): void {
    if (this.actionInProgress() !== null) {
      return;
    }

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

  /** Placeholder shown when a pending request carries no notes. */
  notesText(notes: string | null): string {
    return (notes ?? '').trim() || '—';
  }

  /** Full date/time label for a slot, e.g. "Wed, Aug 27 · 10:00 AM". */
  appointmentSlot(appointment: Appointment): string {
    return `${formatDate(appointment.appointmentDate)} · ${formatTime(appointment.appointmentTime)}`;
  }

  /** Time-only label for a slot, e.g. "10:00 AM". */
  appointmentTime(appointment: Appointment): string {
    return formatTime(appointment.appointmentTime);
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
      case 'REJECTED':
      case 'CANCELLED':
        return 'is-negative';
      default:
        return '';
    }
  }

  /** Avatar initials for a patient row. */
  patientInitials(patientName: string): string {
    return initialsFromName(patientName);
  }
}

/** Two-letter avatar initials from a patient name, e.g. "Sarah Mitchell" -> "SM". */
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

/**
 * Derives a readable "FirstName LastName" from an email local part as a graceful
 * fallback for the doctor's name when they have no appointments to infer it from.
 * A leading "dr" token is dropped so the DoctorNamePipe never double-prepends.
 */
function deriveNameFromEmail(email: string | undefined): string {
  const local = (email ?? '').split('@')[0] ?? '';
  if (!local) {
    return '';
  }
  const parts = local
    .split(/[._-]/)
    .map((p) => p.replace(/[^a-zA-Z]/g, ''))
    .filter((p) => p && !/^dr$/i.test(p));
  if (parts.length === 0) {
    return '';
  }
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}
