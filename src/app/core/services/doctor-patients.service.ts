import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL } from '../api-base-url';

export interface DoctorPatient {
  id: number;
  name: string;
  email: string;
  dateOfBirth: string | null;
  phoneNumber: string | null;
  registeredAt: string;
  initials: string;
}

@Injectable({ providedIn: 'root' })
export class DoctorPatientsService {
  private readonly http = inject(HttpClient);

  getMyPatients(): Observable<DoctorPatient[]> {
    return this.http.get<DoctorPatient[]>(`${API_BASE_URL}/api/doctor/patients`);
  }
}
