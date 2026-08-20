import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AppointmentService } from '../../../core/services/appointment.service';
import type { Appointment } from '../../../core/services/appointment.service';
import { PrescriptionService } from '../../../core/services/prescription.service';
import type { Prescription, PrescriptionMedicationRequest } from '../../../core/services/prescription.service';

interface DoctorPatient {
  id: number;
  name: string;
  initials: string;
}

@Component({
  selector: 'app-doctor-prescriptions',
  imports: [ReactiveFormsModule],
  templateUrl: './doctor-prescriptions.component.html',
  styleUrls: ['./doctor-prescriptions.component.scss'],
})
export class DoctorPrescriptionsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly appointmentService = inject(AppointmentService);
  private readonly prescriptionService = inject(PrescriptionService);

  readonly patients = signal<DoctorPatient[]>([]);
  readonly patientsLoading = signal(true);
  readonly patientsError = signal<string | null>(null);

  readonly prescriptions = signal<Prescription[]>([]);
  readonly prescriptionsLoading = signal(false);
  readonly prescriptionsError = signal<string | null>(null);

  readonly selectedPatientId = signal<number | null>(null);
  readonly patientSearchQuery = signal('');

  readonly submitting = signal(false);
  readonly submitSuccess = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);

  readonly showCreateForm = signal(false);

  readonly form = this.fb.nonNullable.group({
    patientId: [null as number | null, Validators.required],
    medications: this.fb.nonNullable.array(
      [
        this.fb.nonNullable.group({
          medicationName: ['', Validators.required],
          dosage: ['', Validators.required],
          frequency: ['', Validators.required],
          duration: ['', Validators.required],
          instructions: ['', Validators.required],
        }),
      ],
      [Validators.required, Validators.minLength(1)],
    ),
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
    this.form.controls.patientId.setValue(patientId);
    this.prescriptions.set([]);
    this.prescriptionsError.set(null);
    this.loadPatientPrescriptions(patientId);
  }

  loadPatientPrescriptions(patientId: number): void {
    this.prescriptionsLoading.set(true);
    this.prescriptionsError.set(null);
    this.prescriptionService
      .getPatientPrescriptions(patientId)
      .pipe(finalize(() => this.prescriptionsLoading.set(false)))
      .subscribe({
        next: (list) => this.prescriptions.set(list),
        error: () => this.prescriptionsError.set('Could not load prescriptions for this patient. Please try again.'),
      });
  }

  toggleCreateForm(): void {
    const next = !this.showCreateForm();
    this.showCreateForm.set(next);
    this.submitSuccess.set(null);
    this.submitError.set(null);
    if (next && this.selectedPatientId() !== null) {
      this.form.controls.patientId.setValue(this.selectedPatientId());
    }
  }

  addMedication(): void {
    const medications = this.form.controls.medications;
    medications.push(
      this.fb.nonNullable.group({
        medicationName: ['', Validators.required],
        dosage: ['', Validators.required],
        frequency: ['', Validators.required],
        duration: ['', Validators.required],
        instructions: ['', Validators.required],
      }),
    );
  }

  removeMedication(index: number): void {
    const medications = this.form.controls.medications;
    if (medications.length > 1) {
      medications.removeAt(index);
    }
  }

  medicationFieldError(medGroup: AbstractControl, fieldName: string): string | null {
    const control = medGroup.get(fieldName);
    if (!control || (!control.touched && !control.dirty)) {
      return null;
    }
    if (control.errors?.['required']) {
      return 'This field is required.';
    }
    return null;
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
    const medications = this.form.controls.medications;
    const request = {
      patientId,
      medications: medications.value as PrescriptionMedicationRequest[],
    };

    this.prescriptionService.createPrescription(request).subscribe({
      next: (prescription) => {
        this.submitSuccess.set(`Prescription created successfully for ${prescription.patientName}.`);
        this.form.reset({
          patientId: null,
          medications: [
            {
              medicationName: '',
              dosage: '',
              frequency: '',
              duration: '',
              instructions: '',
            },
          ],
        });
        this.showCreateForm.set(false);
        if (this.selectedPatientId() === prescription.patientId) {
          this.loadPatientPrescriptions(prescription.patientId);
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
      medications: [
        {
          medicationName: '',
          dosage: '',
          frequency: '',
          duration: '',
          instructions: '',
        },
      ],
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
    return 'Could not create the prescription. Please try again.';
  }
}
