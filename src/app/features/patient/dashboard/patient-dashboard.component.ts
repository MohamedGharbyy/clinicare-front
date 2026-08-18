import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DoctorNamePipe } from '../../../core/pipes/doctor-name.pipe';
import { finalize, forkJoin } from 'rxjs';

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

@Component({
  selector: 'app-patient-dashboard',
  imports: [RouterLink, DoctorNamePipe],
  templateUrl: './patient-dashboard.component.html',
  styleUrls: ['./patient-dashboard.component.scss', '../../../layout/dashboard-page.scss'],
})
export class PatientDashboardComponent {
  private readonly appointmentService = inject(AppointmentService);

  /** All of the authenticated patient's appointments, loaded from the backend. */
  readonly appointments = signal<Appointment[]>([]);

  /** Upcoming (future) appointments, loaded from the backend. */
  readonly upcomingAppointments = signal<Appointment[]>([]);

  readonly appointmentsLoading = signal(true);
  readonly appointmentsError = signal<string | null>(null);

  /** The patient's next upcoming appointment, if any. */
  readonly nextUpcomingAppointment = computed(() => this.upcomingAppointments()[0] ?? null);

  /** Total number of appointments ever booked by this patient. */
  readonly totalAppointments = computed(() => this.appointments().length);

  /** Appointment requests still waiting for clinic confirmation. */
  readonly pendingRequests = computed(
    () => this.appointments().filter((a) => a.status === 'PENDING').length,
  );

  /** Label for the "Upcoming Appointment" stat card, e.g. "Wed, Aug 27 · 10:00 AM". */
  readonly upcomingAppointmentLabel = computed(() => {
    const appointment = this.nextUpcomingAppointment();
    if (!appointment) {
      return '—';
    }
    return appointmentSlotLabel(appointment);
  });

  constructor() {
    this.loadAppointments();
  }

  loadAppointments(): void {
    this.appointmentsLoading.set(true);
    this.appointmentsError.set(null);
    forkJoin({
      all: this.appointmentService.getMyAppointments(),
      upcoming: this.appointmentService.getUpcomingAppointments(),
    })
      .pipe(finalize(() => this.appointmentsLoading.set(false)))
      .subscribe({
        next: ({ all, upcoming }) => {
          this.appointments.set(all);
          this.upcomingAppointments.set(upcoming);
        },
        error: () => {
          this.appointmentsError.set('Could not load your appointments. Please try again.');
        },
      });
  }

  /** Human-friendly date/time slot for an appointment, e.g. "Wed, Aug 27 · 10:00 AM". */
  appointmentSlot(appointment: Appointment): string {
    return appointmentSlotLabel(appointment);
  }
}

/** Shared label builder used by the stat card and the upcoming panel. */
function appointmentSlotLabel(appointment: Appointment): string {
  return `${formatDate(appointment.appointmentDate)} · ${formatTime(appointment.appointmentTime)}`;
}
