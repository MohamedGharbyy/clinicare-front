import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL } from '../api-base-url';

export interface MedicalReport {
  id: number;
  patientId: number;
  patientName: string;
  doctorId: number;
  doctorName: string;
  appointmentId: number | null;
  appointmentDate: string | null;
  diagnosis: string;
  symptoms: string | null;
  notes: string | null;
  reportDate: string;
  createdAt: string;
}

export interface CreateMedicalReportRequest {
  patientId: number;
  appointmentId?: number | null;
  diagnosis: string;
  symptoms?: string | null;
  notes?: string | null;
  reportDate: string;
}

@Injectable({ providedIn: 'root' })
export class MedicalReportService {
  private readonly http = inject(HttpClient);

  getMyReports(): Observable<MedicalReport[]> {
    return this.http.get<MedicalReport[]>(`${API_BASE_URL}/api/patient/medical-reports`);
  }

  getMyCreatedReports(): Observable<MedicalReport[]> {
    return this.http.get<MedicalReport[]>(`${API_BASE_URL}/api/doctor/medical-reports`);
  }

  getPatientReports(patientId: number): Observable<MedicalReport[]> {
    return this.http.get<MedicalReport[]>(`${API_BASE_URL}/api/doctor/medical-reports/patient/${patientId}`);
  }

  createMedicalReport(request: CreateMedicalReportRequest): Observable<MedicalReport> {
    return this.http.post<MedicalReport>(`${API_BASE_URL}/api/doctor/medical-reports`, request);
  }
}
