import { Routes } from '@angular/router';

import { LoginComponent } from './features/auth/login/login.component';
import { SignupComponent } from './features/auth/signup/signup.component';
import { VerifyEmailComponent } from './features/auth/verify-email/verify-email.component';
import { PatientDashboardComponent } from './features/patient/dashboard/patient-dashboard.component';
import { PatientAppointmentsComponent } from './features/patient/appointments/patient-appointments.component';
import { PatientPrescriptionsComponent } from './features/patient/prescriptions/patient-prescriptions.component';
import { PatientMedicalReportsComponent } from './features/patient/medical-reports/patient-medical-reports.component';
import { PatientProfileComponent } from './features/patient/profile/patient-profile.component';
import { AppointmentCreateComponent } from './features/patient/appointment/appointment-create.component';
import { DoctorDashboardComponent } from './features/doctor/dashboard/doctor-dashboard.component';
import { DoctorAppointmentsComponent } from './features/doctor/appointments/doctor-appointments.component';
import { DoctorPatientsComponent } from './features/doctor/patients/doctor-patients.component';
import { DoctorPrescriptionsComponent } from './features/doctor/prescriptions/doctor-prescriptions.component';
import { DoctorMedicalReportsComponent } from './features/doctor/medical-reports/doctor-medical-reports.component';
import { DoctorProfileComponent } from './features/doctor/profile/doctor-profile.component';
import { AdminDashboardComponent } from './features/admin/dashboard/admin-dashboard.component';
import { AdminPatientsComponent } from './features/admin/patients/admin-patients.component';
import { AdminDoctorsComponent } from './features/admin/doctors/admin-doctors.component';
import { AdminAppointmentsComponent } from './features/admin/appointments/admin-appointments.component';
import { AdminUserManagementComponent } from './features/admin/user-management/user-management.component';
import { DashboardLayoutComponent } from './layout/dashboard-layout/dashboard-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { loginGuard } from './core/guards/login.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'signup', canActivate: [loginGuard], component: SignupComponent },
  { path: 'verify-email', canActivate: [loginGuard], component: VerifyEmailComponent },
  { path: 'login', canActivate: [loginGuard], component: LoginComponent },
  {
    path: 'patient',
    canActivate: [authGuard, roleGuard],
    component: DashboardLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: PatientDashboardComponent },
      { path: 'appointments', component: PatientAppointmentsComponent },
      { path: 'appointment', component: AppointmentCreateComponent },
      { path: 'prescriptions', component: PatientPrescriptionsComponent },
      { path: 'medical-reports', component: PatientMedicalReportsComponent },
      { path: 'profile', component: PatientProfileComponent },
    ],
  },
  {
    path: 'doctor',
    canActivate: [authGuard, roleGuard],
    component: DashboardLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DoctorDashboardComponent },
      { path: 'appointments', component: DoctorAppointmentsComponent },
      { path: 'patients', component: DoctorPatientsComponent },
      { path: 'prescriptions', component: DoctorPrescriptionsComponent },
      { path: 'medical-reports', component: DoctorMedicalReportsComponent },
      { path: 'profile', component: DoctorProfileComponent },
    ],
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    component: DashboardLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'patients', component: AdminPatientsComponent },
      { path: 'doctors', component: AdminDoctorsComponent },
      { path: 'appointments', component: AdminAppointmentsComponent },
      { path: 'users', component: AdminUserManagementComponent },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
