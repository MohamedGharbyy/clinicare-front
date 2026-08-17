import { Routes } from '@angular/router';

import { LoginComponent } from './features/auth/login/login.component';
import { SignupComponent } from './features/auth/signup/signup.component';
import { PatientDashboardComponent } from './features/patient/dashboard/patient-dashboard.component';
import { DoctorDashboardComponent } from './features/doctor/dashboard/doctor-dashboard.component';
import { AdminDashboardComponent } from './features/admin/dashboard/admin-dashboard.component';
import { DashboardLayoutComponent } from './layout/dashboard-layout/dashboard-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { loginGuard } from './core/guards/login.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'signup', canActivate: [loginGuard], component: SignupComponent },
  { path: 'login', canActivate: [loginGuard], component: LoginComponent },
  {
    path: 'patient',
    canActivate: [authGuard, roleGuard],
    component: DashboardLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: PatientDashboardComponent },
    ],
  },
  {
    path: 'doctor',
    canActivate: [authGuard, roleGuard],
    component: DashboardLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DoctorDashboardComponent },
    ],
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    component: DashboardLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: AdminDashboardComponent },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
