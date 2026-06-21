export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request data') {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

// Thrown specifically when a seat can't be held/booked because someone
// else got there first — the frontend uses this to show a precise
// "this seat was just taken" message instead of a generic error.
export class SeatUnavailableError extends ConflictError {
  public seatIds: string[];
  constructor(seatIds: string[]) {
    super(`Seat(s) no longer available: ${seatIds.join(', ')}`);
    this.seatIds = seatIds;
  }
}
