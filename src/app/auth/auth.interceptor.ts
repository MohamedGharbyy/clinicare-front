import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { TOKEN_STORAGE } from './token.storage';

/**
 * Functional HTTP interceptor that attaches the current bearer token to every
 * outgoing request. Reads the token from the {@link TOKEN_STORAGE} abstraction
 * (not localStorage directly) so the storage strategy stays swappable.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(TOKEN_STORAGE);
  const token = storage.read()?.token;

  if (token) {
    const authorized = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(authorized);
  }

  return next(req);
};