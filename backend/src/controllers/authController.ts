import { Request, Response } from 'express';
import { registerSchema, loginSchema } from '../utils/validators';
import { registerUser, loginUser } from '../services/authService';
import { asyncHandler } from '../middleware/errorHandler';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const data = registerSchema.parse(req.body);
  const result = await registerUser(data.name, data.email, data.password);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const data = loginSchema.parse(req.body);
  const result = await loginUser(data.email, data.password);
  res.status(200).json(result);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({ user: req.user });
});
