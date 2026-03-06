'use strict';

/**
 * Custom application error with HTTP status code.
 * Throw these from route handlers for consistent error responses.
 *
 * Usage: throw new AppError('Task not found', 404)
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true; // Distinguishes expected errors from bugs
  }
}

/**
 * Validation error with field-level details.
 * Used by the validate middleware to report exactly which fields failed.
 *
 * Usage: throw new ValidationError([{ field: 'email', message: 'Invalid format' }])
 */
class ValidationError extends AppError {
  constructor(errors) {
    super('Validation failed', 400);
    this.name = 'ValidationError';
    this.errors = errors; // Array of { field, message }
  }
}

/**
 * 404 handler — catches requests that don't match any route.
 * Must be registered after all route handlers.
 */
function notFoundHandler(req, res, _next) {
  res.status(404).json({
    error: 'Not Found',
    message: `No route matches ${req.method} ${req.originalUrl}`,
    suggestion: 'Check the API documentation for available endpoints.',
  });
}

/**
 * Global error handler — catches all errors thrown in route handlers.
 *
 * Behavior varies by error type:
 * - AppError: Returns the error's status code and message (expected errors)
 * - ValidationError: Returns 400 with field-level error details
 * - MongoDB duplicate key: Returns 409 Conflict
 * - Unknown errors: Returns 500 with generic message (hides internals)
 *
 * In development mode (NODE_ENV !== 'production'), includes the stack trace.
 */
function errorHandler(err, req, res, _next) {
  // Log all errors (structured for log aggregation)
  console.error(JSON.stringify({
    level: 'error',
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.userId || 'anonymous',
    timestamp: new Date().toISOString(),
  }));

  // Validation errors — return field details
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.errors,
    });
  }

  // Known operational errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
    });
  }

  // MongoDB duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({
      error: 'Conflict',
      message: `A record with this ${field} already exists.`,
    });
  }

  // Unknown / programmer errors — don't leak internals
  const response = {
    error: 'Internal Server Error',
    message: 'An unexpected error occurred. Please try again later.',
  };

  // Include stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    response.debug = { message: err.message, stack: err.stack };
  }

  res.status(500).json(response);
}

module.exports = { AppError, ValidationError, notFoundHandler, errorHandler };
