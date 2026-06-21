import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { UserRole } from '../types';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid Authorization header'));
  }

  const token = header.slice('Bearer '.length);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`Requires one of roles: ${roles.join(', ')}`));
    }
    next();
  };
}

/**
 * Optional auth: attaches req.user if a valid token is present, but does
 * NOT reject the request if missing — used for endpoints like "browse
 * events" that work for guests but show extra data for logged-in users.
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  try {
    req.user = verifyToken(header.slice('Bearer '.length));
  } catch {
    /* ignore invalid token for optional auth */
  }
  next();
}
