import { Routes } from '@angular/router';

import { LoginComponent } from './features/auth/login/login.component';
import { SignupComponent } from './features/auth/signup/signup.component';
import { PatientDashboardComponent } from './features/patient/dashboard/patient-dashboard.component';
import { DoctorDashboardComponent } from './features/doctor/dashboard/doctor-dashboard.component';
import { authGuard } from './core/guards/auth.guard';
import { authRedirectGuard } from './core/guards/auth-redirect.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'signup',
    component: SignupComponent,
    canActivate: [authRedirectGuard],
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [authRedirectGuard],
  },
  {
    path: 'patient',
    canActivate: [authGuard, roleGuard],
    children: [{ path: 'dashboard', component: PatientDashboardComponent }],
  },
  {
    path: 'doctor',
    canActivate: [authGuard, roleGuard],
    children: [{ path: 'dashboard', component: DoctorDashboardComponent }],
  },
  { path: '**', redirectTo: 'login' },
];
