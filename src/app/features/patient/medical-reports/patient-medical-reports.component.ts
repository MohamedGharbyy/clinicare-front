import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { MedicalReportService } from '../../../core/services/medical-report.service';

@Component({
  selector: 'app-patient-medical-reports',
  imports: [],
  templateUrl: './patient-medical-reports.component.html',
  styleUrls: ['./patient-medical-reports.component.scss'],
})
export class PatientMedicalReportsComponent {
  private readonly medicalReportService = inject(MedicalReportService);

  readonly reports = signal<import('../../../core/services/medical-report.service').MedicalReport[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly expandedId = signal<number | null>(null);

  constructor() {
    this.loadReports();
  }

  loadReports(): void {
    this.loading.set(true);
    this.error.set(null);
    this.expandedId.set(null);
    this.medicalReportService
      .getMyReports()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => this.reports.set(list),
        error: () => this.error.set('Could not load your medical reports. Please try again.'),
      });
  }

  toggleExpand(id: number): void {
    this.expandedId.update((current) => (current === id ? null : id));
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
}
