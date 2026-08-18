import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL } from '../api-base-url';

/**
 * A doctor as exposed by the backend ({@code GET /api/doctors}). The `id` is
 * the doctor's database id and must be sent back as `doctorId` when booking.
 */
export interface Doctor {
  id: number;
  name: string;
  specialty: string;
}

/**
 * Loads the list of doctors shown in the patient booking form. The selected
 * doctor's numeric {@link Doctor#id} is preserved all the way to the
 * appointment creation request.
 */
@Injectable({ providedIn: 'root' })
export class DoctorService {
  private readonly http = inject(HttpClient);

  getDoctors(): Observable<Doctor[]> {
    return this.http.get<Doctor[]>(`${API_BASE_URL}/api/doctors`);
  }
}