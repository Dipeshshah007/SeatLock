import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/db';
import { ConflictError, UnauthorizedError } from '../utils/errors';
import { User, JwtPayload, UserRole } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = 10;

export async function registerUser(
  name: string,
  email: string,
  password: string,
  role: UserRole = 'USER'
): Promise<{ user: Omit<User, 'password_hash'>; token: string }> {
  const { rows: existing } = await query<User>('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length > 0) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const id = uuidv4();

  const { rows } = await query<User>(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, role, created_at, updated_at`,
    [id, name, email, passwordHash, role]
  );

  const user = rows[0];
  const token = signToken({ userId: user.id, role: user.role, email: user.email });
  return { user, token };
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ user: Omit<User, 'password_hash'>; token: string }> {
  const { rows } = await query<User>('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user) throw new UnauthorizedError('Invalid email or password');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new UnauthorizedError('Invalid email or password');

  const token = signToken({ userId: user.id, role: user.role, email: user.email });
  const { password_hash: _omit, ...safeUser } = user;
  return { user: safeUser, token };
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
