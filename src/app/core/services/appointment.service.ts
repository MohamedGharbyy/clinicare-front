import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL } from '../api-base-url';

/**
 * Payload for {@code POST /api/patient/appointments}, matching the backend
 * {@code AppointmentRequestDTO} exactly: `doctorId` is the real
 * {@code doctor_profiles.id} of the selected doctor, `appointmentDate` is
 * {@code yyyy-MM-dd}, `appointmentTime` is 24-hour {@code HH:mm}.
 */
export interface AppointmentRequest {
  doctorId: number;
  appointmentDate: string;
  appointmentTime: string;
  reason: string;
  notes?: string;
}

/** Read-only appointment returned by the backend after creation. */
export interface Appointment {
  id: number;
  patientId: number;
  patientName: string;
  doctorId: number;
  doctorName: string;
  doctorSpecialty: string;
  appointmentDate: string;
  appointmentTime: string;
  reason: string;
  notes: string | null;
  status: string;
  createdAt: string;
}

/**
 * Client for the appointment API. The acting patient is derived by the backend
 * from the JWT attached by {@code authInterceptor}; this service sends no
 * patient id.
 */
@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private readonly http = inject(HttpClient);

  /** Creates a PENDING appointment for the authenticated patient. */
  create(request: AppointmentRequest): Observable<Appointment> {
    return this.http.post<Appointment>(`${API_BASE_URL}/api/patient/appointments`, request);
  }

  /** Returns all appointments belonging to the authenticated patient. */
  getMyAppointments(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${API_BASE_URL}/api/patient/appointments`);
  }

  /** Returns the authenticated patient's upcoming (future) appointments. */
  getUpcomingAppointments(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${API_BASE_URL}/api/patient/appointments/upcoming`);
  }

  /**
   * Returns all appointments assigned to the authenticated doctor, derived by
   * the backend from the JWT principal. The doctor's own name and specialty are
   * embedded on every returned record, so the UI can read them without an extra
   * request. Ordered chronologically by the backend.
   */
  getDoctorAppointments(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${API_BASE_URL}/api/doctor/appointments`);
  }

  /**
   * Accepts a PENDING appointment assigned to the authenticated doctor. The
   * backend marks it {@code CONFIRMED} (the system's accepted state) and returns
   * the updated record.
   */
  acceptAppointment(id: number): Observable<Appointment> {
    return this.http.post<Appointment>(
      `${API_BASE_URL}/api/doctor/appointments/${id}/accept`,
      null,
    );
  }

  /**
   * Rejects a PENDING appointment assigned to the authenticated doctor. The
   * backend marks it {@code REJECTED} and returns the updated record.
   */
  rejectAppointment(id: number): Observable<Appointment> {
    return this.http.post<Appointment>(
      `${API_BASE_URL}/api/doctor/appointments/${id}/reject`,
      null,
    );
  }
}
