import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

import { AuthService } from '../../../auth/auth.service';
import type { RegisterRequest, RegisterRole } from '../../../auth/auth.models';

/** Cross-field validator ensuring "confirm password" matches "password". */
const passwordMatchValidator: ValidatorFn = (group: AbstractControl) =>
  group.get('password')?.value === group.get('confirmPassword')?.value
    ? null
    : { passwordMismatch: true };

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrls: [
    './signup.component.scss',
    '../auth-shared.scss'
  ]
})
export class SignupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  /** Currently selected role — drives the conditional profile fields. */
  readonly role = signal<RegisterRole>('PATIENT');
  /** Whether a registration request is in flight. */
  readonly submitting = signal(false);
  /** Non-field error banner message (e.g. unexpected network failure). */
  readonly formError = signal<string | null>(null);

  /** Field-level errors returned by the backend, keyed by field name. */
  private readonly serverErrors = signal<Record<string, string>>({});

  readonly form = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      firstName: ['', [Validators.required, Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.maxLength(100)]],
      phoneNumber: ['', [Validators.maxLength(30)]],
      dateOfBirth: [''],
      specialty: ['', [Validators.maxLength(100)]],
      licenseNumber: ['', [Validators.maxLength(100)]],
    },
    { validators: passwordMatchValidator },
  );

  setRole(next: RegisterRole): void {
    this.role.set(next);
    this.serverErrors.set({});
  }

  onSubmit(): void {
    this.formError.set(null);
    this.serverErrors.set({});
    this.form.markAllAsTouched();

    if (this.form.invalid || this.form.hasError('passwordMismatch')) {
      return;
    }

    const v = this.form.getRawValue();
    const base = {
      email: v.email,
      password: v.password,
      firstName: v.firstName,
      lastName: v.lastName,
    };

    let payload: RegisterRequest;
    if (this.role() === 'DOCTOR') {
      payload = {
        ...base,
        role: 'DOCTOR',
        specialty: v.specialty || undefined,
        licenseNumber: v.licenseNumber || undefined,
        phoneNumber: v.phoneNumber || undefined,
      };
    } else {
      payload = {
        ...base,
        role: 'PATIENT',
        dateOfBirth: v.dateOfBirth || undefined,
        phoneNumber: v.phoneNumber || undefined,
      };
    }

    this.submitting.set(true);
    this.authService
      .register(payload)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (res) =>
          this.router.navigate(['/verify-email'], { queryParams: { email: res.email } }),
        error: (err) => this.handleError(err),
      });
  }

  /** Returns the first client-side error for a field, or null. */
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
    if (errors['email']) {
      return 'Enter a valid email address.';
    }
    if (errors['minlength']?.requiredLength) {
      return `Must be at least ${errors['minlength'].requiredLength} characters.`;
    }
    if (errors['maxlength']?.requiredLength) {
      return `Must be at most ${errors['maxlength'].requiredLength} characters.`;
    }
    return null;
  }

  /** Special handling for the "confirmPassword" cross-field match. */
  confirmPasswordError(): string | null {
    const base = this.fieldError('confirmPassword');
    if (base) {
      return base;
    }
    const confirm = this.form.get('confirmPassword');
    if (
      confirm &&
      (confirm.touched || confirm.dirty) &&
      this.form.hasError('passwordMismatch')
    ) {
      return 'Passwords do not match.';
    }
    return null;
  }

  /** Backend-provided error message for a field, if any. */
  serverError(controlName: string): string | null {
    return this.serverErrors()[controlName] ?? null;
  }

  private handleError(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object') {
      const fields = (err.error as { fields?: unknown }).fields;
      if (fields && typeof fields === 'object') {
        this.serverErrors.set(fields as Record<string, string>);
        return;
      }
      const message = (err.error as { message?: unknown }).message;
      if (typeof message === 'string') {
        this.formError.set(message);
        return;
      }
    }
    this.formError.set('Registration failed. Please try again.');
  }
}