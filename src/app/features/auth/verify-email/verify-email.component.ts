import { Component, OnDestroy, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize, Subscription, timer } from 'rxjs';

import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-verify-email',
  imports: [ReactiveFormsModule],
  templateUrl: './verify-email.component.html',
  styleUrls: [
    './verify-email.component.scss',
    '../auth-shared.scss'
  ]
})
export class VerifyEmailComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Email being verified (passed from the registration screen). */
  readonly email = signal<string>('');

  readonly submitting = signal(false);
  readonly resending = signal(false);
  readonly verified = signal(false);
  readonly formError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  /** Remaining resend cooldown in seconds (0 means resend is allowed). */
  readonly resendCooldown = signal(0);
  private cooldownTimer?: Subscription;

  readonly form = this.fb.nonNullable.group({
    code: [
      '',
      [Validators.required, Validators.pattern(/^\d{6}$/)],
    ],
  });

  constructor() {
    const emailParam = this.route.snapshot.queryParamMap.get('email');
    if (emailParam) {
      this.email.set(emailParam);
    }
  }

  ngOnDestroy(): void {
    this.cooldownTimer?.unsubscribe();
  }

  fieldError(): string | null {
    const control = this.form.controls.code;
    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.errors?.['required']) {
      return 'Enter the 6-digit code.';
    }
    if (control.errors?.['pattern']) {
      return 'The code must be exactly 6 digits.';
    }
    return null;
  }

  onSubmit(): void {
    this.formError.set(null);
    this.successMessage.set(null);
    this.form.markAllAsTouched();

    const email = this.email();
    if (!email || this.form.invalid) {
      return;
    }

    const code = this.form.getRawValue().code;
    this.submitting.set(true);
    this.authService
      .verifyEmail({ email, code })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (res) => {
          this.verified.set(true);
          this.successMessage.set(res.message || 'Your email has been verified.');
        },
        error: (err) => this.handleError(err),
      });
  }

  onResend(): void {
    const email = this.email();
    if (!email || this.resendCooldown() > 0 || this.resending()) {
      return;
    }

    this.formError.set(null);
    this.successMessage.set(null);
    this.resending.set(true);
    this.authService
      .resendVerification({ email })
      .pipe(finalize(() => this.resending.set(false)))
      .subscribe({
        next: (res) => {
          // Start the cooldown locally so the UI reflects the server limit.
          const cooldown = res.retryAfterSeconds ?? 60;
          this.startCooldown(cooldown);
          if (res.sent) {
            this.successMessage.set('A new verification code has been sent to your email.');
          } else {
            // Generic message — do not reveal account state.
            this.successMessage.set('If an account exists for this address, a verification code has been sent.');
          }
        },
        error: (err) => this.handleResendError(err),
      });
  }

  private handleError(err: unknown): void {
    if (err instanceof HttpErrorResponse && typeof err.error?.message === 'string') {
      this.formError.set(err.error.message);
      return;
    }
    this.formError.set('Unable to verify. Please try again.');
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

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
