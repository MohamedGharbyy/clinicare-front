import { InjectionToken } from '@angular/core';
import type { AuthState } from './auth.models';

/**
 * Persistence contract for the auth state. Components and services only depend
 * on this abstraction, so the underlying storage strategy (localStorage,
 * sessionStorage, in-memory, a Cookie, ...) can be swapped by replacing the
 * provider for {@link TOKEN_STORAGE} — no call sites need to change.
 */
export interface TokenStorage {
  read(): AuthState | null;
  write(state: AuthState): void;
  clear(): void;
}

/** Injection token used to locate the active {@link TokenStorage}. */
export const TOKEN_STORAGE = new InjectionToken<TokenStorage>(
  'clinicare.auth.TOKEN_STORAGE',
);

const STORAGE_KEY = 'clinicare.auth';

/**
 * Default {@link TokenStorage} backed by the browser's localStorage. All
 * accesses are guarded so it can also run safely during server-side rendering,
 * where localStorage is not available.
 */
export class LocalStorageTokenStorage implements TokenStorage {
  read(): AuthState | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as AuthState;
      if (!parsed || typeof parsed.token !== 'string' || !parsed.user) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  write(state: AuthState): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  clear(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
  }
}