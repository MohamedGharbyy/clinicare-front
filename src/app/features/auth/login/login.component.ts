import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

import { AuthService } from '../../../auth/auth.service';
import type { UserRole } from '../../../auth/auth.models';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: [
    './login.component.scss',
    '../auth-shared.scss'
  ]
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** True when the user just registered and was redirected here. */
  readonly signupSuccess = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    this.route.queryParamMap.subscribe((params) =>
      this.signupSuccess.set(params.get('registered') === '1'),
    );
  }

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
    return null;
  }

  /** Role-based landing page after a successful login. */
  private redirectPath(role: unknown): string {
    // Normalize the role value in case it comes through in an unexpected format
    console.debug('redirectPath() called with role:', role, 'typeof:', typeof role, 'full role object:', JSON.stringify(role));
    const normalizedRole = this.normalizeRole(role);
    console.debug('Normalized role result:', normalizedRole);
    
    switch (normalizedRole) {
      case 'PATIENT':
        return '/patient/dashboard';
      case 'DOCTOR':
        return '/doctor/dashboard';
      case 'ADMIN':
        return '/admin/dashboard';
      default:
        console.warn('Unknown role received:', role, 'normalized to:', normalizedRole, 'switch will default to /login');
        return '/login';
    }
  }

  /** Ensure role is a valid UserRole type, handling various formats. */
  private normalizeRole(role: unknown): UserRole | null {
    console.debug('normalizeRole() checking:', role, 'typeof:', typeof role);
    
    if (typeof role === 'string') {
      console.debug('normalizeRole() input is string:', role);
      // Role is already a string, check if it's valid
      if (role === 'PATIENT' || role === 'DOCTOR' || role === 'ADMIN') {
        console.debug('normalizeRole() found exact match:', role);
        return role;
      }
      // Try uppercase in case it comes in lowercase or mixed case
      const upper = role.toUpperCase();
      console.debug('normalizeRole() trying uppercase:', upper);
      if (upper === 'PATIENT' || upper === 'DOCTOR' || upper === 'ADMIN') {
        console.debug('normalizeRole() uppercase matched:', upper);
        return upper as UserRole;
      }
      console.warn('normalizeRole() string did not match any known role:', role);
    }
    
    // If role is an object (e.g., from JSON deserialization), try to extract it
    if (typeof role === 'object' && role !== null && 'name' in role) {
      console.debug('normalizeRole() found object with name property:', (role as any).name);
      return this.normalizeRole((role as any).name);
    }
    
    console.warn('normalizeRole() could not normalize:', role, 'typeof:', typeof role);
    return null;
  }

  onSubmit(): void {
    this.formError.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.authService
      .login({ email, password })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          // Do not retain the password in the form after it has been sent.
          this.form.controls.password.reset('');
          const redirectUrl = this.redirectPath(response.role);
          console.debug('Login successful, redirecting to:', redirectUrl, 'for role:', response.role);
          this.router.navigate([redirectUrl]);
        },
        error: (err) => {
          // Do not retain a failed credential attempt in the page state either.
          this.form.controls.password.reset('');
          // On 401 show a single, generic message — never reveal which field
          // was wrong.
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.formError.set('Invalid email or password.');
          } else if (
            err instanceof HttpErrorResponse &&
            typeof err.error?.message === 'string'
          ) {
            this.formError.set(err.error.message);
          } else {
            this.formError.set('Unable to sign in. Please try again.');
          }
        },
      });
  }
}
