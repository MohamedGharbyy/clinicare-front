import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';

/** A doctor offered in the booking form. */
export interface MockDoctor {
  id: string;
  name: string;
  specialty: string;
  initials: string;
}

/**
 * Placeholder doctor list until a doctors endpoint exists.
 * TODO: Replace with real data once the doctors API is available.
 */
const MOCK_DOCTORS: MockDoctor[] = [
  { id: 'd1', name: 'Dr. Sarah Mitchell', specialty: 'General Medicine', initials: 'SM' },
  { id: 'd2', name: 'Dr. Omar Haddad', specialty: 'Cardiology', initials: 'OH' },
  { id: 'd3', name: 'Dr. Elena Rossi', specialty: 'Dermatology', initials: 'ER' },
  { id: 'd4', name: 'Dr. James Carter', specialty: 'Pediatrics', initials: 'JC' },
  { id: 'd5', name: 'Dr. Amira Benali', specialty: 'Neurology', initials: 'AB' },
  { id: 'd6', name: 'Dr. Lucas Meyer', specialty: 'Orthopedics', initials: 'LM' },
];

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
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './appointment-create.component.html',
  styleUrls: ['./appointment-create.component.scss', '../../../layout/dashboard-page.scss'],
})
export class AppointmentCreateComponent {
  private readonly fb = inject(FormBuilder);

  /** Mock doctors shown in the booking form. */
  readonly doctors = MOCK_DOCTORS;

  /** Earliest selectable date — today, so past dates are never bookable. */
  readonly minDate = new Date().toISOString().slice(0, 10);

  /** True once the (simulated) request has been submitted successfully. */
  readonly submitted = signal(false);

  readonly form = this.fb.nonNullable.group({
    doctorId: ['', Validators.required],
    date: ['', [Validators.required, futureDateValidator]],
    time: ['', Validators.required],
    reason: ['', [Validators.required, Validators.maxLength(200)]],
    notes: ['', [Validators.maxLength(1000)]],
  });

  /** Selected doctor object, used by the live summary and success panel. */
  readonly selectedDoctor = computed(
    () => this.doctors.find((d) => d.id === this.form.controls.doctorId.value) ?? null,
  );

  selectDoctor(id: string): void {
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
    if (this.form.invalid) {
      return;
    }
    // No backend connected yet — simply confirm the request.
    this.submitted.set(true);
  }

  resetForm(): void {
    this.form.reset();
    this.submitted.set(false);
  }
}
