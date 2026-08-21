import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL } from '../api-base-url';
import type { UserRole } from '../../auth/auth.models';

/**
 * A doctor as exposed by the booking list endpoint ({@code GET /api/doctors}).
 * The `id` is the doctor's database id and must be sent back as `doctorId` when
 * booking.
 */
export interface Doctor {
  id: number;
  name: string;
  specialty: string;
}

/** The authenticated doctor's account and profile. */
export interface DoctorProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  /** May be null when the doctor has not provided a phone number. */
  phoneNumber: string | null;
  /** May be null when the doctor has not provided a specialty. */
  specialty: string | null;
  /** May be null when the doctor has not provided a license number. */
  licenseNumber: string | null;
  role: UserRole;
  /** ISO timestamp of account creation. */
  createdAt: string;
}

/** Personal and professional fields the doctor may edit. */
export interface UpdateDoctorProfilePayload {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  specialty: string;
  licenseNumber: string;
}

/** Result of a profile update; `token` is present only when the email changed. */
export interface UpdateDoctorProfileResult extends DoctorProfile {
  token: string | null;
}

/** Fields for a secure password change. */
export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Loads the list of doctors shown in the patient booking form and provides
 * account management for the authenticated doctor. The acting doctor is derived
 * by the backend from the JWT attached by {@code authInterceptor}; these methods
 * send no doctor id.
 */
@Injectable({ providedIn: 'root' })
export class DoctorService {
  private readonly http = inject(HttpClient);

  getDoctors(): Observable<Doctor[]> {
    return this.http.get<Doctor[]>(`${API_BASE_URL}/api/doctors`);
  }

  /** Returns the authenticated doctor's current profile. */
  getProfile(): Observable<DoctorProfile> {
    return this.http.get<DoctorProfile>(`${API_BASE_URL}/api/doctor/profile`);
  }

  /** Persists personal and professional edits for the authenticated doctor. */
  updateProfile(payload: UpdateDoctorProfilePayload): Observable<UpdateDoctorProfileResult> {
    return this.http.put<UpdateDoctorProfileResult>(`${API_BASE_URL}/api/doctor/profile`, payload);
  }

  /** Changes the authenticated doctor's password. */
  changePassword(payload: ChangePasswordPayload): Observable<void> {
    return this.http.post<void>(`${API_BASE_URL}/api/doctor/change-password`, payload);
  }
}
