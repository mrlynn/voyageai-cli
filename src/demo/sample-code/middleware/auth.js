'use strict';

const jwt = require('jsonwebtoken');
const { findUserById } = require('../models/user');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const TOKEN_EXPIRY = '24h';

/**
 * Generate a JWT token for an authenticated user.
 * Includes userId and role in the payload for authorization checks.
 *
 * @param {object} user - User document from database
 * @returns {string} Signed JWT token
 */
function generateToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY },
  );
}

/**
 * Authentication middleware — verifies JWT from the Authorization header.
 *
 * Expected header format: "Bearer <token>"
 *
 * On success, attaches req.user with { userId, role }.
 * On failure, returns 401 with a descriptive error message.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Provide a Bearer token in the Authorization header',
    });
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please log in again.',
      });
    }

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is malformed or tampered with.',
      });
    }

    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Unable to verify your identity.',
    });
  }
}

/**
 * Authorization middleware factory — restricts access by user role.
 * Must be used after authenticate() so req.user is populated.
 *
 * Usage: router.delete('/admin/users/:id', authenticate, authorize('admin'), handler)
 *
 * @param {...string} roles - Allowed roles (e.g., 'admin', 'moderator')
 * @returns {function} Express middleware
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
        message: 'Authentication is required before authorization.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of these roles: ${roles.join(', ')}`,
      });
    }

    next();
  };
}

/**
 * Optional auth middleware — attaches req.user if a valid token is present,
 * but doesn't block the request if no token is provided.
 * Useful for endpoints that behave differently for authenticated vs anonymous users.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // No token — proceed as anonymous
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId, role: decoded.role };
  } catch {
    // Invalid token — treat as anonymous rather than erroring
  }

  next();
}

module.exports = { generateToken, authenticate, authorize, optionalAuth };
