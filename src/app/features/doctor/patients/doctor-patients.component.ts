import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { DoctorPatientsService } from '../../../core/services/doctor-patients.service';
import type { DoctorPatient } from '../../../core/services/doctor-patients.service';
import { MedicalReportService } from '../../../core/services/medical-report.service';
import type { MedicalReport } from '../../../core/services/medical-report.service';
import { PrescriptionService } from '../../../core/services/prescription.service';
import type { Prescription } from '../../../core/services/prescription.service';

@Component({
  selector: 'app-doctor-patients',
  imports: [],
  templateUrl: './doctor-patients.component.html',
  styleUrls: ['./doctor-patients.component.scss'],
})
export class DoctorPatientsComponent {
  private readonly doctorPatientsService = inject(DoctorPatientsService);
  private readonly medicalReportService = inject(MedicalReportService);
  private readonly prescriptionService = inject(PrescriptionService);

  readonly patients = signal<DoctorPatient[]>([]);
  readonly patientsLoading = signal(true);
  readonly patientsError = signal<string | null>(null);

  readonly selectedPatientId = signal<number | null>(null);
  readonly patientSearchQuery = signal('');

  readonly reports = signal<MedicalReport[]>([]);
  readonly reportsLoading = signal(false);
  readonly reportsError = signal<string | null>(null);

  readonly prescriptions = signal<Prescription[]>([]);
  readonly prescriptionsLoading = signal(false);
  readonly prescriptionsError = signal<string | null>(null);

  readonly activeTab = signal<'reports' | 'prescriptions'>('reports');

  readonly filteredPatients = computed(() => {
    const query = this.patientSearchQuery().trim().toLowerCase();
    const list = this.patients();
    if (!query) return list;
    return list.filter((p) => p.name.toLowerCase().includes(query));
  });

  readonly selectedPatient = computed(() => {
    const id = this.selectedPatientId();
    return id !== null ? this.patients().find((p) => p.id === id) ?? null : null;
  });

  constructor() {
    this.loadPatients();
  }

  loadPatients(): void {
    this.patientsLoading.set(true);
    this.patientsError.set(null);
    this.doctorPatientsService.getMyPatients().subscribe({
      next: (patients) => {
        this.patients.set(
          patients.map((p) => ({
            ...p,
            initials: this.initialsFromName(p.name),
          })),
        );
        this.patientsLoading.set(false);
      },
      error: () => {
        this.patientsError.set('Could not load your patients. Please try again.');
        this.patientsLoading.set(false);
      },
    });
  }

  onPatientSearchChange(event: Event): void {
    this.patientSearchQuery.set((event.target as HTMLInputElement).value);
  }

  selectPatient(patientId: number): void {
    this.selectedPatientId.set(patientId);
    this.activeTab.set('reports');
    this.reports.set([]);
    this.reportsError.set(null);
    this.prescriptions.set([]);
    this.prescriptionsError.set(null);
    this.loadPatientReports(patientId);
    this.loadPatientPrescriptions(patientId);
  }

  loadPatientReports(patientId: number): void {
    this.reportsLoading.set(true);
    this.reportsError.set(null);
    this.medicalReportService
      .getPatientReports(patientId)
      .pipe(finalize(() => this.reportsLoading.set(false)))
      .subscribe({
        next: (list) => this.reports.set(list),
        error: () =>
          this.reportsError.set('Could not load medical reports for this patient. Please try again.'),
      });
  }

  loadPatientPrescriptions(patientId: number): void {
    this.prescriptionsLoading.set(true);
    this.prescriptionsError.set(null);
    this.prescriptionService
      .getPatientPrescriptions(patientId)
      .pipe(finalize(() => this.prescriptionsLoading.set(false)))
      .subscribe({
        next: (list) => this.prescriptions.set(list),
        error: () =>
          this.prescriptionsError.set('Could not load prescriptions for this patient. Please try again.'),
      });
  }

  setActiveTab(tab: 'reports' | 'prescriptions'): void {
    this.activeTab.set(tab);
  }

  formatDate(dateString: string): string {
    const parsed = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateString;
    return parsed.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  orDash(value: string | null | undefined): string {
    return (value ?? '').trim() || '—';
  }

  private initialsFromName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
}
