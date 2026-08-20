import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { PrescriptionService } from '../../../core/services/prescription.service';

@Component({
  selector: 'app-patient-prescriptions',
  imports: [],
  templateUrl: './patient-prescriptions.component.html',
  styleUrls: ['./patient-prescriptions.component.scss'],
})
export class PatientPrescriptionsComponent {
  private readonly prescriptionService = inject(PrescriptionService);

  readonly prescriptions = signal<import('../../../core/services/prescription.service').Prescription[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly expandedId = signal<number | null>(null);

  constructor() {
    this.loadPrescriptions();
  }

  loadPrescriptions(): void {
    this.loading.set(true);
    this.error.set(null);
    this.expandedId.set(null);
    this.prescriptionService
      .getMyPrescriptions()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => this.prescriptions.set(list),
        error: () => this.error.set('Could not load your prescriptions. Please try again.'),
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
