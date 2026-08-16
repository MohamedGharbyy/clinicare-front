import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import type { Observable } from 'rxjs';

import type {
  AuthResponse,
  AuthState,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
} from './auth.models';
import { TOKEN_STORAGE } from './token.storage';

/**
 * Base URL of the backend API. The clinicare-back service answers on the
 * default Spring port and is configured to allow CORS from localhost:4200.
 */
const API_BASE_URL = 'http://localhost:8080';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(TOKEN_STORAGE);

  /**
   * Source of truth for the current auth state. Initialized from the active
   * {@link TokenStorage} so a refresh restores the session.
   */
  private readonly authState = signal<AuthState>(this.readState());

  readonly state = this.authState.asReadonly();
  readonly user = computed(() => this.authState().user);
  readonly token = computed(() => this.authState().token);
  readonly isAuthenticated = computed(
    () => this.authState().token !== null && this.authState().user !== null,
  );

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

  private readState(): AuthState {
    return this.storage.read() ?? { token: null, user: null };
  }

  private persistState(state: AuthState): void {
    this.authState.set(state);
    this.storage.write(state);
  }
}