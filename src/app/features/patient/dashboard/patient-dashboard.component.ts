import { Component, computed, inject, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';
import { RouterLink } from '@angular/router';
import { AppointmentService } from '../../../core/services/appointment.service';
import type { Appointment } from '../../../core/services/appointment.service';

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

function appointmentSlotLabel(appointment: Appointment): string {
  return `${formatDate(appointment.appointmentDate)} · ${formatTime(appointment.appointmentTime)}`;
}

@Component({
  selector: 'app-patient-dashboard',
  imports: [RouterLink],
  templateUrl: './patient-dashboard.component.html',
  styleUrls: ['./patient-dashboard.component.scss', '../../../layout/dashboard-page.scss'],
})
export class PatientDashboardComponent {
  private readonly appointmentService = inject(AppointmentService);

  readonly appointments = signal<Appointment[]>([]);
  readonly upcomingAppointments = signal<Appointment[]>([]);
  readonly appointmentsLoading = signal(true);
  readonly appointmentsError = signal<string | null>(null);

  readonly nextUpcomingAppointment = computed(() => this.upcomingAppointments()[0] ?? null);
  readonly totalAppointments = computed(() => this.appointments().length);
  readonly pendingRequests = computed(() => this.appointments().filter((a) => a.status === 'PENDING').length);
  readonly upcomingAppointmentLabel = computed(() => {
    const appointment = this.nextUpcomingAppointment();
    if (!appointment) return '—';
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

  appointmentSlot(appointment: Appointment): string {
    return appointmentSlotLabel(appointment);
  }
}
