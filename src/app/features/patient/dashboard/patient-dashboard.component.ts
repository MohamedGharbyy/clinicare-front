import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-patient-dashboard',
  imports: [RouterLink],
  templateUrl: './patient-dashboard.component.html',
  styleUrls: ['./patient-dashboard.component.scss', '../../../layout/dashboard-page.scss'],
})
export class PatientDashboardComponent {
  /**
   * Placeholder/mock values for the summary cards.
   * TODO: Replace with real data once the appointments API is available.
   */
  upcomingAppointment = 'Thu, Aug 21 · 10:00 AM';
  totalAppointments = 12;
  pendingRequests = 2;
}
