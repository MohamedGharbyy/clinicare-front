import type { UserInfo, UserRole } from './auth.models';

/**
 * Standard JWT Payload structure matching clinicare-back tokens.
 */
export interface JwtPayload {
  sub?: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

/**
 * Safely decodes a JWT payload from base64url format.
 * Works seamlessly in both browser and SSR / Node.js environments.
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    let jsonPayload: string;
    if (typeof atob === 'function') {
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4 !== 0) {
        base64 += '=';
      }
      jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
    } else if (typeof Buffer !== 'undefined') {
      jsonPayload = Buffer.from(parts[1], 'base64url').toString('utf8');
    } else {
      return null;
    }

    return JSON.parse(jsonPayload) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Checks whether a JWT token is expired or invalid.
 * Returns true if the token is missing, malformed, or if its `exp` claim has passed.
 *
 * @param token JWT string
 * @param clockToleranceSeconds Optional tolerance in seconds to handle clock drift (default 0)
 */
export function isJwtExpired(token: string | null | undefined, clockToleranceSeconds = 0): boolean {
  if (!token || typeof token !== 'string') {
    return true;
  }

  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    return true;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowInSeconds + clockToleranceSeconds;
}

/**
 * Normalizes role from various formats (string, object, mixed-case, ROLE_ prefix)
 * to a known UserRole ('PATIENT' | 'DOCTOR' | 'ADMIN').
 * Returns null if unrecognized — does NOT default or guess a role.
 */
export function normalizeRole(role: unknown): UserRole | null {
  if (typeof role === 'string') {
    const trimmed = role.trim().toUpperCase();
    const clean = trimmed.startsWith('ROLE_') ? trimmed.substring(5) : trimmed;
    if (clean === 'PATIENT' || clean === 'DOCTOR' || clean === 'ADMIN') {
      return clean as UserRole;
    }
    return null;
  }

  if (typeof role === 'object' && role !== null && 'name' in role) {
    return normalizeRole((role as { name: unknown }).name);
  }

  return null;
}

/**
 * Validates that a user object conforms to UserInfo with a recognized role.
 */
export function isValidUserInfo(user: unknown): user is UserInfo {
  if (!user || typeof user !== 'object') {
    return false;
  }

  const u = user as Partial<UserInfo>;
  return (
    typeof u.id === 'number' &&
    typeof u.email === 'string' &&
    u.email.trim().length > 0 &&
    normalizeRole(u.role) !== null
  );
}
