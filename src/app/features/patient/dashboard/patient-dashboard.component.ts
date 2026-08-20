import { Component, computed, inject, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';
import { RouterLink } from '@angular/router';
import { AppointmentService } from '../../../core/services/appointment.service';
import type { Appointment } from '../../../core/services/appointment.service';
import { PrescriptionService } from '../../../core/services/prescription.service';
import type { Prescription } from '../../../core/services/prescription.service';
import { MedicalReportService } from '../../../core/services/medical-report.service';
import type { MedicalReport } from '../../../core/services/medical-report.service';

type ActivityType = 'appointment' | 'prescription' | 'medical-report';

interface PatientActivity {
  key: string;
  type: ActivityType;
  id: number;
  title: string;
  subtitle: string;
  timestamp: number;
  dateLabel: string;
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
  const normalized = date.includes('T') ? date : `${date}T00:00:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function toTimestamp(date: string): number {
  const normalized = date.includes('T') ? date : `${date}T00:00:00`;
  const parsed = new Date(normalized).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
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
  private readonly prescriptionService = inject(PrescriptionService);
  private readonly medicalReportService = inject(MedicalReportService);

  readonly appointments = signal<Appointment[]>([]);
  readonly upcomingAppointments = signal<Appointment[]>([]);
  readonly appointmentsLoading = signal(true);
  readonly appointmentsError = signal<string | null>(null);

  readonly recentActivities = signal<PatientActivity[]>([]);

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
      prescriptions: this.prescriptionService.getMyPrescriptions(),
      reports: this.medicalReportService.getMyReports(),
    })
      .pipe(finalize(() => this.appointmentsLoading.set(false)))
      .subscribe({
        next: ({ all, upcoming, prescriptions, reports }) => {
          this.appointments.set(all);
          this.upcomingAppointments.set(upcoming);
          this.recentActivities.set(this.buildActivities(all, prescriptions, reports));
        },
        error: () => {
          this.appointmentsError.set('Could not load your activity. Please try again.');
        },
      });
  }

  appointmentSlot(appointment: Appointment): string {
    return appointmentSlotLabel(appointment);
  }

  private buildActivities(
    appointments: Appointment[],
    prescriptions: Prescription[],
    reports: MedicalReport[],
  ): PatientActivity[] {
    const items: PatientActivity[] = [];

    for (const appointment of appointments) {
      items.push({
        key: `appointment-${appointment.id}`,
        type: 'appointment',
        id: appointment.id,
        title: `Appointment with ${appointment.doctorName}`,
        subtitle: `${appointment.doctorSpecialty} · ${appointment.status}`,
        timestamp: toTimestamp(`${appointment.appointmentDate}T${appointment.appointmentTime}`),
        dateLabel: `${formatDate(appointment.appointmentDate)} · ${formatTime(appointment.appointmentTime)}`,
      });
    }

    for (const prescription of prescriptions) {
      const medicationCount = prescription.medications.length;
      items.push({
        key: `prescription-${prescription.id}`,
        type: 'prescription',
        id: prescription.id,
        title: 'Prescription issued',
        subtitle: `Dr. ${prescription.doctorName} · ${medicationCount} medication${medicationCount === 1 ? '' : 's'}`,
        timestamp: toTimestamp(prescription.creationDate),
        dateLabel: formatDate(prescription.creationDate),
      });
    }

    for (const report of reports) {
      const reportDate = report.reportDate ?? report.createdAt;
      items.push({
        key: `medical-report-${report.id}`,
        type: 'medical-report',
        id: report.id,
        title: 'Medical report',
        subtitle: `Dr. ${report.doctorName} · ${report.diagnosis}`,
        timestamp: toTimestamp(reportDate),
        dateLabel: formatDate(reportDate),
      });
    }

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }
}
