import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/db';
import { asyncHandler } from '../middleware/errorHandler';
import { createVenueSchema } from '../utils/validators';

export const listVenues = asyncHandler(async (_req: Request, res: Response) => {
  const { rows } = await query(`SELECT * FROM venues ORDER BY name ASC`);
  res.json({ venues: rows });
});

export const createVenue = asyncHandler(async (req: Request, res: Response) => {
  const data = createVenueSchema.parse(req.body);
  const id = uuidv4();
  const { rows } = await query(
    `INSERT INTO venues (id, name, address, city, country) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [id, data.name, data.address || null, data.city || null, data.country || null]
  );
  res.status(201).json({ venue: rows[0] });
});
