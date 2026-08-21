import { Component, OnDestroy, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, finalize, timer } from 'rxjs';

import { AuthService } from '../../../auth/auth.service';
import type { UserRole } from '../../../auth/auth.models';
import { normalizeRole } from '../../../auth/jwt.utils';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: [
    './login.component.scss',
    '../auth-shared.scss'
  ]
})
export class LoginComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** True when the user just registered and was redirected here. */
  readonly signupSuccess = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  /** When the backend reports an unverified account, surface the resend UI. */
  readonly unverified = signal(false);
  readonly unverifiedEmail = signal<string | null>(null);

  readonly resending = signal(false);
  readonly resendSuccess = signal<string | null>(null);
  /** Remaining resend cooldown in seconds (0 means resend is allowed). */
  readonly resendCooldown = signal(0);
  private cooldownTimer?: Subscription;

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    this.route.queryParamMap.subscribe((params) =>
      this.signupSuccess.set(params.get('registered') === '1'),
    );
  }

  ngOnDestroy(): void {
    this.cooldownTimer?.unsubscribe();
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
    const normalizedRole = normalizeRole(role);
    switch (normalizedRole) {
      case 'PATIENT':
        return '/patient/dashboard';
      case 'DOCTOR':
        return '/doctor/dashboard';
      case 'ADMIN':
        return '/admin/dashboard';
      default:
        return '/login';
    }
  }

  onSubmit(): void {
    this.formError.set(null);
    this.resendSuccess.set(null);
    this.unverified.set(false);
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
        error: (err) => this.handleError(err, email),
      });
  }

  /** Resends a verification code for the unverified account on the login screen. */
  onResend(): void {
    const email = this.unverifiedEmail();
    if (!email || this.resendCooldown() > 0 || this.resending()) {
      return;
    }

    this.formError.set(null);
    this.resendSuccess.set(null);
    this.resending.set(true);
    this.authService
      .resendVerification({ email })
      .pipe(finalize(() => this.resending.set(false)))
      .subscribe({
        next: (res) => {
          this.startCooldown(res.retryAfterSeconds ?? 60);
          if (res.sent) {
            this.resendSuccess.set('A new verification code has been sent to your email.');
          } else {
            // Generic message — do not reveal account state.
            this.resendSuccess.set('If an account exists for this address, a verification code has been sent.');
          }
        },
        error: (err) => this.handleResendError(err),
      });
  }

  private handleError(err: unknown, email: string): void {
    // Do not retain a failed credential attempt in the page state.
    this.form.controls.password.reset('');

    if (err instanceof HttpErrorResponse && err.status === 401) {
      this.formError.set('Invalid email or password.');
      return;
    }

    if (
      err instanceof HttpErrorResponse &&
      err.status === 403 &&
      err.error?.fields?.['reason'] === 'email_not_verified'
    ) {
      this.unverified.set(true);
      this.unverifiedEmail.set(email);
      this.formError.set(err.error?.message ?? 'Your email address is not verified.');
      return;
    }

    if (err instanceof HttpErrorResponse && typeof err.error?.message === 'string') {
      this.formError.set(err.error.message);
      return;
    }

    this.formError.set('Unable to sign in. Please try again.');
  }

  private handleResendError(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.status === 429) {
      const retryAfter = Number(err.error?.fields?.['retryAfterSeconds']);
      this.startCooldown(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60);
      this.formError.set('Please wait a moment before requesting another code.');
      return;
    }
    if (err instanceof HttpErrorResponse && typeof err.error?.message === 'string') {
      this.formError.set(err.error.message);
      return;
    }
    this.formError.set('Unable to resend the code. Please try again.');
  }

  private startCooldown(seconds: number): void {
    this.cooldownTimer?.unsubscribe();
    let remaining = Math.max(0, Math.floor(seconds));
    this.resendCooldown.set(remaining);
    if (remaining <= 0) {
      return;
    }
    this.cooldownTimer = timer(0, 1000).subscribe(() => {
      remaining -= 1;
      this.resendCooldown.set(Math.max(0, remaining));
      if (remaining <= 0) {
        this.cooldownTimer?.unsubscribe();
      }
    });
  }
}
