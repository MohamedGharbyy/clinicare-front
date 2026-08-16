/**
 * Types mirroring the clinicare-back auth DTOs.
 */

export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';

/** Roles a user may pick at registration. Admins are created separately. */
export type RegisterRole = Extract<UserRole, 'PATIENT' | 'DOCTOR'>;

export interface UserInfo {
  id: number;
  email: string;
  role: UserRole;
}

interface RegisterRequestBase {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** Role-specific fields for a patient sign-up. */
export interface PatientRegisterRequest extends RegisterRequestBase {
  role: 'PATIENT';
  /** ISO date, e.g. '1990-05-14'. */
  dateOfBirth?: string;
  phoneNumber?: string;
}

/** Role-specific fields for a doctor sign-up. */
export interface DoctorRegisterRequest extends RegisterRequestBase {
  role: 'DOCTOR';
  specialty?: string;
  licenseNumber?: string;
  phoneNumber?: string;
}

/**
 * Discriminated union on `role`: the shape depends on the chosen role, so
 * `dateOfBirth`/`phoneNumber` are typed for PATIENT and
 * `specialty`/`licenseNumber`/`phoneNumber` for DOCTOR.
 */
export type RegisterRequest = PatientRegisterRequest | DoctorRegisterRequest;

export interface LoginRequest {
  email: string;
  password: string;
}

/** Body returned by {@code POST /api/auth/register}. */
export interface RegisterResponse extends UserInfo {}

/** Body returned by {@code POST /api/auth/login}: JWT plus user info. */
export interface AuthResponse extends UserInfo {
  token: string;
}

/** Combined persisted auth info: the JWT and the authenticated user. */
export interface AuthState {
  token: string | null;
  user: UserInfo | null;
}