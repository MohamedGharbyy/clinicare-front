import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL } from '../api-base-url';
import type { UserRole } from '../../auth/auth.models';

/** The authenticated patient's account and profile. */
export interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  /** May be null when the patient has not provided a phone number. */
  phoneNumber: string | null;
  role: UserRole;
  /** ISO timestamp of account creation. */
  createdAt: string;
}

/** Personal-information fields the patient may edit. */
export interface UpdateProfilePayload {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
}

/** Result of a profile update; `token` is present only when the email changed. */
export interface UpdateProfileResult extends UserProfile {
  token: string | null;
}

/** Fields for a secure password change. */
export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Client for the patient account API. The acting patient is derived by the
 * backend from the JWT attached by {@code authInterceptor}; this service sends
 * no patient id.
 */
@Injectable({ providedIn: 'root' })
export class PatientService {
  private readonly http = inject(HttpClient);

  /** Returns the authenticated patient's current profile. */
  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${API_BASE_URL}/api/patient/profile`);
  }

  /** Persists personal-information edits for the authenticated patient. */
  updateProfile(payload: UpdateProfilePayload): Observable<UpdateProfileResult> {
    return this.http.put<UpdateProfileResult>(`${API_BASE_URL}/api/patient/profile`, payload);
  }

  /** Changes the authenticated patient's password. */
  changePassword(payload: ChangePasswordPayload): Observable<void> {
    return this.http.post<void>(`${API_BASE_URL}/api/patient/change-password`, payload);
  }
}
