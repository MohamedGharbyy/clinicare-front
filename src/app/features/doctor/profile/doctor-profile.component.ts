import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';

import { AuthService } from '../../../auth/auth.service';
import type { UserRole } from '../../../auth/auth.models';
import { DoctorService } from '../../../core/services/doctor.service';
import type {
  ChangePasswordPayload,
  DoctorProfile,
  UpdateDoctorProfilePayload,
  UpdateDoctorProfileResult,
} from '../../../core/services/doctor.service';

/** Cross-field validator ensuring "confirm password" matches "new password". */
const passwordMatchValidator: ValidatorFn = (group: AbstractControl) =>
  group.get('newPassword')?.value === group.get('confirmPassword')?.value
    ? null
    : { passwordMismatch: true };

/** Formats an ISO timestamp as a friendly "Month D, YYYY" date. */
function formatMemberSince(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

@Component({
  selector: 'app-doctor-profile',
  imports: [ReactiveFormsModule],
  templateUrl: './doctor-profile.component.html',
  styleUrls: ['./doctor-profile.component.scss', '../../../layout/dashboard-page.scss'],
})
export class DoctorProfileComponent {
  private readonly doctorService = inject(DoctorService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  /** Loaded profile; null until the first fetch resolves. */
  readonly profile = signal<DoctorProfile | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  /* ---- Personal Information -------------------------------------------------- */
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly saveSuccess = signal(false);
  private readonly infoServerErrors = signal<Record<string, string>>({});

  readonly infoForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    phoneNumber: ['', [Validators.maxLength(30)]],
  });

  /* ---- Professional Information ---------------------------------------------- */
  readonly editingProfessional = signal(false);
  readonly savingProfessional = signal(false);
  readonly professionalError = signal<string | null>(null);
  readonly professionalSuccess = signal(false);
  private readonly professionalServerErrors = signal<Record<string, string>>({});

  readonly professionalForm = this.fb.nonNullable.group({
    specialty: ['', [Validators.maxLength(120)]],
    licenseNumber: ['', [Validators.maxLength(100)]],
  });

  /* ---- Change Password ------------------------------------------------------- */
  readonly changing = signal(false);
  readonly changeError = signal<string | null>(null);
  readonly changeSuccess = signal(false);
  private readonly passwordServerErrors = signal<Record<string, string>>({});

  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator },
  );

  /** Account identity summary, derived from the loaded profile. */
  readonly account = computed(() => {
    const p = this.profile();
    if (!p) {
      return null;
    }
    return {
      role: p.role,
      roleLabel: this.roleLabel(p.role),
      email: p.email,
      memberSince: formatMemberSince(p.createdAt),
    };
  });

  constructor() {
    this.loadProfile();
  }

  /** Fetches the authenticated doctor's profile. */
  loadProfile(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.doctorService.getProfile().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.resetInfoForm(profile);
        this.resetProfessionalForm(profile);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load your profile. Please try again.');
        this.loading.set(false);
      },
    });
  }

  /* ---- Personal Information handlers ----------------------------------------- */

  /** Enters edit mode, keeping the current values in the form. */
  startEditing(): void {
    this.editing.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);
    this.infoServerErrors.set({});
  }

  /** Discards edits and returns to the read-only summary. */
  cancelEditing(): void {
    if (this.profile()) {
      this.resetInfoForm(this.profile()!);
    }
    this.editing.set(false);
    this.saveError.set(null);
    this.infoServerErrors.set({});
  }

  saveInfo(): void {
    this.infoForm.markAllAsTouched();
    this.saveError.set(null);
    this.saveSuccess.set(false);
    this.infoServerErrors.set({});

    if (this.infoForm.invalid) {
      return;
    }

    const profile = this.profile();
    const payload: UpdateDoctorProfilePayload = {
      firstName: this.infoForm.controls.firstName.value.trim(),
      lastName: this.infoForm.controls.lastName.value.trim(),
      email: this.infoForm.controls.email.value.trim(),
      phoneNumber: this.infoForm.controls.phoneNumber.value.trim(),
      specialty: profile?.specialty ?? '',
      licenseNumber: profile?.licenseNumber ?? '',
    };

    this.saving.set(true);
    this.doctorService
      .updateProfile(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (result) => {
          this.profile.set(result);
          this.resetInfoForm(result);
          this.resetProfessionalForm(result);
          this.editing.set(false);
          this.saveSuccess.set(true);
          // If the email changed, the backend issued a fresh JWT — keep the
          // session in sync so future requests authenticate correctly.
          if (result.token) {
            this.authService.setSession(result.token, {
              id: result.id,
              email: result.email,
              firstName: result.firstName,
              lastName: result.lastName,
              role: result.role,
            });
          }
        },
        error: (error: unknown) => this.handleInfoError(error),
      });
  }

  /** First client-side error for a personal-information field, or null. */
  infoFieldError(controlName: string): string | null {
    const control = this.infoForm.get(controlName);
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
    if (errors['maxlength']?.requiredLength) {
      return `Must be at most ${errors['maxlength'].requiredLength} characters.`;
    }
    return null;
  }

  /** Backend-provided error for a personal-information field, if any. */
  infoServerError(controlName: string): string | null {
    return this.infoServerErrors()[controlName] ?? null;
  }

  /* ---- Professional Information handlers ------------------------------------- */

  startEditingProfessional(): void {
    this.editingProfessional.set(true);
    this.professionalError.set(null);
    this.professionalSuccess.set(false);
    this.professionalServerErrors.set({});
  }

  cancelEditingProfessional(): void {
    if (this.profile()) {
      this.resetProfessionalForm(this.profile()!);
    }
    this.editingProfessional.set(false);
    this.professionalError.set(null);
    this.professionalServerErrors.set({});
  }

  saveProfessional(): void {
    this.professionalForm.markAllAsTouched();
    this.professionalError.set(null);
    this.professionalSuccess.set(false);
    this.professionalServerErrors.set({});

    if (this.professionalForm.invalid) {
      return;
    }

    const profile = this.profile();
    const payload: UpdateDoctorProfilePayload = {
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      email: profile?.email ?? '',
      phoneNumber: profile?.phoneNumber ?? '',
      specialty: this.professionalForm.controls.specialty.value.trim(),
      licenseNumber: this.professionalForm.controls.licenseNumber.value.trim(),
    };

    this.savingProfessional.set(true);
    this.doctorService
      .updateProfile(payload)
      .pipe(finalize(() => this.savingProfessional.set(false)))
      .subscribe({
        next: (result) => {
          this.profile.set(result);
          this.resetInfoForm(result);
          this.resetProfessionalForm(result);
          this.editingProfessional.set(false);
          this.professionalSuccess.set(true);
          if (result.token) {
            this.authService.setSession(result.token, {
              id: result.id,
              email: result.email,
              firstName: result.firstName,
              lastName: result.lastName,
              role: result.role,
            });
          }
        },
        error: (error: unknown) => this.handleProfessionalError(error),
      });
  }

  /** First client-side error for a professional-information field, or null. */
  professionalFieldError(controlName: string): string | null {
    const control = this.professionalForm.get(controlName);
    if (!control || (!control.touched && !control.dirty)) {
      return null;
    }
    const errors = control.errors;
    if (!errors) {
      return null;
    }
    if (errors['maxlength']?.requiredLength) {
      return `Must be at most ${errors['maxlength'].requiredLength} characters.`;
    }
    return null;
  }

  /** Backend-provided error for a professional-information field, if any. */
  professionalServerError(controlName: string): string | null {
    return this.professionalServerErrors()[controlName] ?? null;
  }

  /* ---- Change Password handlers --------------------------------------------- */

  changePassword(): void {
    this.passwordForm.markAllAsTouched();
    this.changeError.set(null);
    this.changeSuccess.set(false);
    this.passwordServerErrors.set({});

    if (this.passwordForm.invalid || this.passwordForm.hasError('passwordMismatch')) {
      return;
    }

    const payload: ChangePasswordPayload = {
      currentPassword: this.passwordForm.controls.currentPassword.value,
      newPassword: this.passwordForm.controls.newPassword.value,
      confirmPassword: this.passwordForm.controls.confirmPassword.value,
    };

    this.changing.set(true);
    this.doctorService
      .changePassword(payload)
      .pipe(finalize(() => this.changing.set(false)))
      .subscribe({
        next: () => {
          this.passwordForm.reset();
          this.changeSuccess.set(true);
        },
        error: (error: unknown) => this.handlePasswordError(error),
      });
  }

  /** First client-side error for a password field, or null. */
  passwordFieldError(controlName: string): string | null {
    const control = this.passwordForm.get(controlName);
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
    if (errors['minlength']?.requiredLength) {
      return `Must be at least ${errors['minlength'].requiredLength} characters.`;
    }
    if (errors['maxlength']?.requiredLength) {
      return `Must be at most ${errors['maxlength'].requiredLength} characters.`;
    }
    return null;
  }

  /** Special handling for the "confirm password" cross-field match. */
  confirmPasswordError(): string | null {
    const base = this.passwordFieldError('confirmPassword');
    if (base) {
      return base;
    }
    const confirm = this.passwordForm.get('confirmPassword');
    if (
      confirm &&
      (confirm.touched || confirm.dirty) &&
      this.passwordForm.hasError('passwordMismatch')
    ) {
      return 'New passwords do not match.';
    }
    return null;
  }

  /** Backend-provided error for a password field, if any. */
  passwordServerError(controlName: string): string | null {
    return this.passwordServerErrors()[controlName] ?? null;
  }

  /* ---- Helpers --------------------------------------------------------------- */

  private resetInfoForm(profile: DoctorProfile): void {
    this.infoForm.setValue({
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phoneNumber: profile.phoneNumber ?? '',
    });
    this.infoForm.markAsPristine();
  }

  private resetProfessionalForm(profile: DoctorProfile): void {
    this.professionalForm.setValue({
      specialty: profile.specialty ?? '',
      licenseNumber: profile.licenseNumber ?? '',
    });
    this.professionalForm.markAsPristine();
  }

  private roleLabel(role: UserRole): string {
    switch (role) {
      case 'PATIENT':
        return 'Patient';
      case 'DOCTOR':
        return 'Doctor';
      case 'ADMIN':
        return 'Administrator';
      default:
        return role;
    }
  }

  private handleInfoError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
      const fields = (error.error as { fields?: unknown }).fields;
      if (fields && typeof fields === 'object') {
        this.infoServerErrors.set(fields as Record<string, string>);
        return;
      }
      const message = (error.error as { message?: unknown }).message;
      if (typeof message === 'string') {
        this.saveError.set(message);
        return;
      }
    }
    this.saveError.set('Could not save your changes. Please try again.');
  }

  private handleProfessionalError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
      const fields = (error.error as { fields?: unknown }).fields;
      if (fields && typeof fields === 'object') {
        this.professionalServerErrors.set(fields as Record<string, string>);
        return;
      }
      const message = (error.error as { message?: unknown }).message;
      if (typeof message === 'string') {
        this.professionalError.set(message);
        return;
      }
    }
    this.professionalError.set('Could not save your changes. Please try again.');
  }

  private handlePasswordError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object') {
      const fields = (error.error as { fields?: unknown }).fields;
      if (fields && typeof fields === 'object') {
        this.passwordServerErrors.set(fields as Record<string, string>);
        return;
      }
      const message = (error.error as { message?: unknown }).message;
      if (typeof message === 'string') {
        this.changeError.set(message);
        return;
      }
    }
    this.changeError.set('Could not update your password. Please try again.');
  }
}
