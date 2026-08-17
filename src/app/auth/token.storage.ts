import { InjectionToken } from '@angular/core';
import type { AuthState } from './auth.models';
import { isJwtExpired, isValidUserInfo } from './jwt.utils';

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
      if (
        !parsed ||
        typeof parsed.token !== 'string' ||
        !isValidUserInfo(parsed.user) ||
        isJwtExpired(parsed.token)
      ) {
        // Purge expired or malformed session data immediately
        this.clear();
        return null;
      }
      return parsed;
    } catch {
      this.clear();
      return null;
    }
  }

  write(state: AuthState): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    if (state.token && state.user && !isJwtExpired(state.token)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      this.clear();
    }
  }

  clear(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
  }
}