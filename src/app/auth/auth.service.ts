import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';

import { API_BASE_URL } from '../core/api-base-url';
import type { Observable } from 'rxjs';

import type {
  AuthResponse,
  AuthState,
  EmailVerificationResponse,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  ResendVerificationRequest,
  ResendVerificationResponse,
  UserInfo,
  VerifyEmailRequest,
} from './auth.models';
import { TOKEN_STORAGE } from './token.storage';
import { isJwtExpired, isValidUserInfo } from './jwt.utils';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(TOKEN_STORAGE);

  /**
   * Source of truth for the current auth state. Initialized from the active
   * {@link TokenStorage} so a refresh restores a valid session.
   */
  private readonly authState = signal<AuthState>(this.readState());

  readonly state = this.authState.asReadonly();
  readonly user = computed(() => {
    const s = this.authState();
    if (!s.token || isJwtExpired(s.token) || !isValidUserInfo(s.user)) {
      return null;
    }
    return s.user;
  });
  readonly token = computed(() => {
    const s = this.authState();
    if (!s.token || isJwtExpired(s.token)) {
      return null;
    }
    return s.token;
  });
  readonly isAuthenticated = computed(() => {
    const s = this.authState();
    return (
      s.token !== null &&
      s.user !== null &&
      !isJwtExpired(s.token) &&
      isValidUserInfo(s.user)
    );
  });

  /**
   * Creates a new account. The backend responds with the created user only
   * (no JWT), so this does not authenticate the caller — follow up with
   * {@link login}.
   */
  register(payload: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(
      `${API_BASE_URL}/api/auth/register`,
      payload,
    );
  }

  /** Submits the 6-digit verification code for the given email. */
  verifyEmail(payload: VerifyEmailRequest): Observable<EmailVerificationResponse> {
    return this.http.post<EmailVerificationResponse>(
      `${API_BASE_URL}/api/auth/verify-email`,
      payload,
    );
  }

  /** Requests a fresh verification code for the given email. */
  resendVerification(
    payload: ResendVerificationRequest,
  ): Observable<ResendVerificationResponse> {
    return this.http.post<ResendVerificationResponse>(
      `${API_BASE_URL}/api/auth/resend-verification`,
      payload,
    );
  }

  /** Authenticates and persists the returned JWT plus user info in auth state. */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/api/auth/login`, credentials)
      .pipe(
        tap((response) =>
          this.persistState({ token: response.token, user: response }),
        ),
      );
  }

  /** Clears the in-memory auth state and the persisted storage. */
  logout(): void {
    this.storage.clear();
    this.authState.set({ token: null, user: null });
  }

  /**
   * Replaces the active session (token + user info) without requiring a fresh
   * login. Used after a profile update that re-issues the JWT, e.g. when the
   * patient changes their login email.
   */
  setSession(token: string, user: UserInfo): void {
    this.persistState({ token, user });
  }

  /** Helper to check token expiration. */
  isTokenExpired(token: string | null | undefined): boolean {
    return isJwtExpired(token);
  }

  private readState(): AuthState {
    return this.storage.read() ?? { token: null, user: null };
  }

  private persistState(state: AuthState): void {
    this.authState.set(state);
    this.storage.write(state);
  }
}