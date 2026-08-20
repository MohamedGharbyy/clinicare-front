import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL } from '../api-base-url';

export interface PrescriptionMedication {
  id: number;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface Prescription {
  id: number;
  doctorId: number;
  doctorName: string;
  patientId: number;
  patientName: string;
  creationDate: string;
  medications: PrescriptionMedication[];
}

export interface PrescriptionMedicationRequest {
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface CreatePrescriptionRequest {
  patientId: number;
  medications: PrescriptionMedicationRequest[];
}

@Injectable({ providedIn: 'root' })
export class PrescriptionService {
  private readonly http = inject(HttpClient);

  getMyPrescriptions(): Observable<Prescription[]> {
    return this.http.get<Prescription[]>(`${API_BASE_URL}/api/patient/prescriptions`);
  }

  getMyCreatedPrescriptions(): Observable<Prescription[]> {
    return this.http.get<Prescription[]>(`${API_BASE_URL}/api/doctor/prescriptions`);
  }

  getPatientPrescriptions(patientId: number): Observable<Prescription[]> {
    return this.http.get<Prescription[]>(`${API_BASE_URL}/api/doctor/prescriptions/patient/${patientId}`);
  }

  createPrescription(request: CreatePrescriptionRequest): Observable<Prescription> {
    return this.http.post<Prescription>(`${API_BASE_URL}/api/doctor/prescriptions`, request);
  }
}
