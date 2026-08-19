import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL } from '../api-base-url';
import type { Appointment } from './appointment.service';

/** Live summary counters for the admin dashboard, mirroring the backend DTO. */
export interface AdminDashboard {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
}

/** Admin-facing patient account, as exposed by {@code GET /api/admin/patients}. */
export interface AdminPatient {
  /** Real {@code patient_profiles.id}. */
  id: number;
  name: string;
  email: string;
  /** ISO date {@code yyyy-MM-dd}, or null when the patient set no birth date. */
  dateOfBirth: string | null;
  phoneNumber: string | null;
  /** ISO date-time of the linked user's registration. */
  registeredAt: string;
}

/** Admin-facing doctor account, as exposed by {@code GET /api/admin/doctors}. */
export interface AdminDoctor {
  /** Real {@code doctor_profiles.id}. */
  id: number;
  name: string;
  email: string;
  specialty: string | null;
  licenseNumber: string | null;
  phoneNumber: string | null;
  /** ISO date-time of the linked user's registration. */
  registeredAt: string;
}

/**
 * Client for the admin dashboard API. Every endpoint is read-only and the
 * backend enforces the ADMIN role, so only a signed-in admin can load data.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  /** Returns the total patients / doctors / appointments counters. */
  getDashboard(): Observable<AdminDashboard> {
    return this.http.get<AdminDashboard>(`${API_BASE_URL}/api/admin/dashboard`);
  }

  /** Returns every registered patient, ordered by name. */
  getPatients(): Observable<AdminPatient[]> {
    return this.http.get<AdminPatient[]>(`${API_BASE_URL}/api/admin/patients`);
  }

  /** Returns every registered doctor, ordered by name. */
  getDoctors(): Observable<AdminDoctor[]> {
    return this.http.get<AdminDoctor[]>(`${API_BASE_URL}/api/admin/doctors`);
  }

  /**
   * Returns every appointment across the platform, ordered by date/time.
   * Reuses the shared appointment representation so the admin table shows the
   * same fields (patient/doctor names, reason, status) as the rest of the app.
   */
  getAppointments(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${API_BASE_URL}/api/admin/appointments`);
  }

  /**
   * Cancels an appointment on behalf of the clinic.
   * Backed by {@code DELETE /api/admin/appointments/{id}} on the backend.
   */
  cancelAppointment(appointmentId: number): Observable<Appointment> {
    return this.http.delete<Appointment>(`${API_BASE_URL}/api/admin/appointments/${appointmentId}`);
  }
}