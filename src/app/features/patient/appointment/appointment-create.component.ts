import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DoctorNamePipe } from '../../../core/pipes/doctor-name.pipe';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AppointmentService } from '../../../core/services/appointment.service';
import { DoctorService } from '../../../core/services/doctor.service';

/** A doctor offered in the booking form. */
export interface DoctorOption {
  /** Real database id ({@code doctor_profiles.id}), sent as {@code doctorId}. */
  id: number;
  name: string;
  specialty: string;
  /** Two-letter initials derived from the doctor's name (avatar). */
  initials: string;
}

/** Avatar initials, e.g. "Sarah Mitchell" -> "SM". */
function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** Rejects appointment dates earlier than today. */
const futureDateValidator: ValidatorFn = (control: AbstractControl) => {
  const value = control.value;
  if (typeof value !== 'string' || !value) {
    return null;
  }
  const selected = new Date(`${value}T00:00:00`);
  if (Number.isNaN(selected.getTime())) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selected < today ? { pastDate: true } : null;
};

@Component({
  selector: 'app-appointment-create',
  imports: [ReactiveFormsModule, RouterLink, DoctorNamePipe],
  templateUrl: './appointment-create.component.html',
  styleUrls: ['./appointment-create.component.scss', '../../../layout/dashboard-page.scss'],
})
export class AppointmentCreateComponent {
  private readonly fb = inject(FormBuilder);
  private readonly doctorService = inject(DoctorService);
  private readonly appointmentService = inject(AppointmentService);

  /** Doctors loaded from the backend, preserving their real database ids. */
  readonly doctors = signal<DoctorOption[]>([]);
  readonly doctorsLoading = signal(true);
  readonly doctorsError = signal<string | null>(null);

  /** True while the booking request is in flight. */
  readonly submitting = signal(false);

  /** Backend error surfaced to the user when a booking is rejected. */
  readonly submitError = signal<string | null>(null);

  /** Earliest selectable date — today, so past dates are never bookable. */
  readonly minDate = new Date().toISOString().slice(0, 10);

  /** True only after the backend has successfully created the appointment. */
  readonly submitted = signal(false);

  readonly form = this.fb.nonNullable.group({
    doctorId: [null as number | null, Validators.required],
    date: ['', [Validators.required, futureDateValidator]],
    time: ['', Validators.required],
    reason: ['', [Validators.required, Validators.maxLength(200)]],
    notes: ['', [Validators.maxLength(1000)]],
  });

  /**
   * The selected doctorId as a signal, derived from the reactive form so the
   * summary card stays in sync with the selection. The form control remains the
   * single source of truth; this bridge lets {@link selectedDoctor} recompute.
   */
  private readonly doctorIdValue = toSignal(this.form.controls.doctorId.valueChanges, {
    initialValue: null as number | null,
  });

  constructor() {
    this.loadDoctors();
  }

  /** Selected doctor object, used by the live summary and success panel. */
  readonly selectedDoctor = computed(
    () => this.doctors().find((d) => d.id === this.doctorIdValue()) ?? null,
  );

  /** Fetches the backend doctor list, preserving each doctor's numeric id. */
  loadDoctors(): void {
    this.doctorsLoading.set(true);
    this.doctorsError.set(null);
    this.doctorService.getDoctors().subscribe({
      next: (list) => {
        this.doctors.set(
          list.map((d) => ({
            id: d.id,
            name: d.name,
            specialty: d.specialty,
            initials: initialsFromName(d.name),
          })),
        );
        this.doctorsLoading.set(false);
      },
      error: () => {
        this.doctorsError.set('Could not load the list of doctors. Please try again.');
        this.doctorsLoading.set(false);
      },
    });
  }

  selectDoctor(id: number): void {
    this.form.controls.doctorId.setValue(id);
  }

  /** First client-side error message for a field, or null. */
  fieldError(controlName: string): string | null {
    const control = this.form.get(controlName);
    if (!control || (!control.touched && !control.dirty)) {
      return null;
    }
    const errors = control.errors;
    if (!errors) {
      return null;
    }
    if (errors['required']) {
      return 'This field is required.';
    }
    if (errors['pastDate']) {
      return 'Please choose a date in the future.';
    }
    if (errors['maxlength']?.requiredLength) {
      return `Must be at most ${errors['maxlength'].requiredLength} characters.`;
    }
    return null;
  }

  /** Human-friendly date for the summary, e.g. "Wed, Aug 27". */
  formattedDate(): string {
    const value = this.form.controls.date.value;
    if (!value) {
      return '';
    }
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  /** Placeholder for summary entries that have not been filled in yet. */
  summaryOrDash(value: string): string {
    return value || '—';
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    this.submitError.set(null);
    if (this.form.invalid) {
      return;
    }

    const { doctorId, date, time, reason, notes } = this.form.controls;
    if (doctorId.value === null) {
      doctorId.setErrors({ required: true });
      return;
    }

    this.submitting.set(true);
    this.appointmentService
      .create({
        doctorId: doctorId.value,
        appointmentDate: date.value,
        appointmentTime: time.value,
        reason: reason.value,
        notes: notes.value || undefined,
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        // Success panel only appears once the backend has persisted the row.
        next: () => this.submitted.set(true),
        error: (error: unknown) => this.submitError.set(this.errorMessage(error)),
      });
  }

  resetForm(): void {
    this.form.reset();
    this.submitted.set(false);
    this.submitError.set(null);
    this.loadDoctors();
  }

  /** Maps an API failure to a human-readable message. */
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
    return 'Could not book the appointment. Please try again.';
  }
}
