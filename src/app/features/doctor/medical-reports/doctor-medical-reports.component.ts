import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppointmentService } from '../../../core/services/appointment.service';
import type { Appointment } from '../../../core/services/appointment.service';
import { MedicalReportService } from '../../../core/services/medical-report.service';
import type { MedicalReport } from '../../../core/services/medical-report.service';

interface DoctorPatient {
  id: number;
  name: string;
  initials: string;
}

@Component({
  selector: 'app-doctor-medical-reports',
  imports: [ReactiveFormsModule],
  templateUrl: './doctor-medical-reports.component.html',
  styleUrls: ['./doctor-medical-reports.component.scss'],
})
export class DoctorMedicalReportsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly appointmentService = inject(AppointmentService);
  private readonly medicalReportService = inject(MedicalReportService);

  readonly patients = signal<DoctorPatient[]>([]);
  readonly patientsLoading = signal(true);
  readonly patientsError = signal<string | null>(null);

  readonly reports = signal<MedicalReport[]>([]);
  readonly reportsLoading = signal(false);
  readonly reportsError = signal<string | null>(null);

  readonly selectedPatientId = signal<number | null>(null);
  readonly patientSearchQuery = signal('');

  readonly submitting = signal(false);
  readonly submitSuccess = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);

  readonly showCreateForm = signal(false);

  readonly form = this.fb.nonNullable.group({
    patientId: [null as number | null, Validators.required],
    appointmentId: [null as number | null],
    diagnosis: ['', [Validators.required, Validators.maxLength(255)]],
    symptoms: ['', Validators.maxLength(2000)],
    notes: ['', Validators.maxLength(2000)],
    reportDate: [this.todayString(), Validators.required],
  });

  readonly filteredPatients = computed(() => {
    const query = this.patientSearchQuery().trim().toLowerCase();
    const list = this.patients();
    if (!query) return list;
    return list.filter((p) => p.name.toLowerCase().includes(query));
  });

  readonly selectedPatient = computed(() => {
    const id = this.selectedPatientId();
    return id !== null ? this.patients().find((p) => p.id === id) ?? null : null;
  });

  readonly isFormValid = computed(() => this.form.valid && this.form.controls.patientId.value !== null);

  constructor() {
    this.loadPatients();
  }

  loadPatients(): void {
    this.patientsLoading.set(true);
    this.patientsError.set(null);
    this.appointmentService.getDoctorAppointments().subscribe({
      next: (appointments) => {
        const seen = new Map<number, string>();
        for (const appt of appointments) {
          if (appt.status === 'CONFIRMED' || appt.status === 'COMPLETED') {
            if (!seen.has(appt.patientId)) {
              seen.set(appt.patientId, appt.patientName);
            }
          }
        }
        this.patients.set(
          Array.from(seen.entries()).map(([id, name]) => ({
            id,
            name,
            initials: this.initialsFromName(name),
          })),
        );
        this.patientsLoading.set(false);
      },
      error: () => {
        this.patientsError.set('Could not load your patients. Please try again.');
        this.patientsLoading.set(false);
      },
    });
  }

  onPatientSearchChange(event: Event): void {
    this.patientSearchQuery.set((event.target as HTMLInputElement).value);
  }

  selectPatient(patientId: number): void {
    this.selectedPatientId.set(patientId);
    this.reports.set([]);
    this.reportsError.set(null);
    this.loadPatientReports(patientId);
  }

  loadPatientReports(patientId: number): void {
    this.reportsLoading.set(true);
    this.reportsError.set(null);
    this.medicalReportService
      .getPatientReports(patientId)
      .pipe(finalize(() => this.reportsLoading.set(false)))
      .subscribe({
        next: (list) => this.reports.set(list),
        error: () => this.reportsError.set('Could not load medical reports for this patient. Please try again.'),
      });
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    this.submitSuccess.set(null);
    this.submitError.set(null);

    const patientId = this.form.controls.patientId.value;
    if (!patientId) {
      this.form.controls.patientId.setErrors({ required: true });
      return;
    }

    if (this.form.invalid) {
      return;
    }

    this.submitting.set(true);
    const request = {
      patientId,
      appointmentId: this.form.controls.appointmentId.value,
      diagnosis: this.form.controls.diagnosis.value,
      symptoms: this.form.controls.symptoms.value || null,
      notes: this.form.controls.notes.value || null,
      reportDate: this.form.controls.reportDate.value,
    };

    this.medicalReportService.createMedicalReport(request).subscribe({
      next: (report) => {
        this.submitSuccess.set(`Medical report created successfully for ${report.patientName}.`);
        this.form.reset({
          patientId: this.selectedPatientId(),
          appointmentId: null,
          diagnosis: '',
          symptoms: '',
          notes: '',
          reportDate: this.todayString(),
        });
        this.showCreateForm.set(false);
        if (this.selectedPatientId() === report.patientId) {
          this.loadPatientReports(report.patientId);
        }
        this.submitting.set(false);
      },
      error: (error: unknown) => {
        this.submitError.set(this.errorMessage(error));
        this.submitting.set(false);
      },
    });
  }

  resetCreateForm(): void {
    this.form.reset({
      patientId: this.selectedPatientId(),
      appointmentId: null,
      diagnosis: '',
      symptoms: '',
      notes: '',
      reportDate: this.todayString(),
    });
    this.submitSuccess.set(null);
    this.submitError.set(null);
  }

  formatDate(dateString: string): string {
    const parsed = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateString;
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  orDash(value: string | null | undefined): string {
    return (value ?? '').trim() || '—';
  }

  private initialsFromName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  private todayString(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: string } | null;
      if (body?.message) {
        return body.message;
      }
      if (error.status === 0) {
        return 'Unable to reach the server. Please check your connection and try again.';
      }
    }
    return 'Could not create the medical report. Please try again.';
  }
}
