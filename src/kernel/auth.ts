import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Db } from '../db/index.js';
import { ROLES, type Permission, type Role } from './config.js';
import { AppError, forbidden } from './errors.js';
import { assertCan } from './rbac.js';

export const SESSION_COOKIE = 'session';
const TOKEN_TTL_SECONDS = 60 * 60 * 8;

export interface SessionUser {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
}

interface TokenPayload {
  readonly sub: string;
  readonly role: Role;
  readonly name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: SessionUser;
      requestId: string;
    }
  }
}

export function sessionSecret(): string {
  return process.env.SESSION_SECRET ?? 'dev-only-demo-secret';
}

/**
 * Mocked identity: the demo issues its own signed JWT instead of integrating an IdP.
 * The token is real and verified on every request, so authorization is genuinely
 * server-side; only the login step is faked. See docs/architecture.md.
 */
export function issueToken(user: SessionUser): string {
  const payload: TokenPayload = { sub: user.id, role: user.role, name: user.name };
  return jwt.sign(payload, sessionSecret(), { expiresIn: TOKEN_TTL_SECONDS });
}

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

function parseToken(token: string): SessionUser {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, sessionSecret());
  } catch {
    throw forbidden('INVALID_SESSION', 'Session token is missing or invalid.');
  }
  if (typeof decoded !== 'object' || decoded === null) {
    throw forbidden('INVALID_SESSION', 'Session token payload is malformed.');
  }
  const claims = decoded as Record<string, unknown>;
  const { sub, role, name } = claims;
  if (typeof sub !== 'string' || !isRole(role) || typeof name !== 'string') {
    throw forbidden('INVALID_SESSION', 'Session token payload is malformed.');
  }
  return { id: sub, role, name };
}

function readToken(req: Request): string | undefined {
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  const cookies: unknown = req.cookies;
  if (typeof cookies === 'object' && cookies !== null) {
    const value = (cookies as Record<string, unknown>)[SESSION_COOKIE];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

export function defaultUser(db: Db): SessionUser {
  return loadUser(db, 'u_reviewer');
}

export function loadUser(db: Db, id: string): SessionUser {
  const row = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(id);
  if (!row) throw new AppError(404, 'UNKNOWN_USER', `No demo user '${id}'.`);
  const user = row as { id: string; name: string; role: string };
  if (!isRole(user.role)) throw new AppError(500, 'BAD_USER_ROLE', `User '${id}' has an unknown role.`);
  return { id: user.id, name: user.name, role: user.role };
}

/**
 * Resolves the session on every request. Falls back to the seeded reviewer so the
 * demo is usable without a login step; API clients can pass a Bearer token instead.
 */
export function sessionMiddleware(db: Db) {
  return (req: Request, res: Response, next: NextFunction): void => {
    req.requestId = crypto.randomUUID();
    const token = readToken(req);
    try {
      req.user = token ? parseToken(token) : defaultUser(db);
    } catch (error) {
      next(error);
      return;
    }
    res.locals.user = req.user;
    res.locals.requestId = req.requestId;
    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      assertCan(req.user.role, permission);
      next();
    } catch (error) {
      next(error);
    }
  };
}
