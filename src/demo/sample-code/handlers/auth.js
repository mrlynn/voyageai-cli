'use strict';

const { Router } = require('express');
const { createUser, verifyCredentials } = require('../models/user');
const { generateToken, authenticate } = require('../middleware/auth');
const { validate, registerUserSchema } = require('../middleware/validate');

const router = Router();

/**
 * POST /api/auth/register
 *
 * Create a new user account. Validates input, hashes password,
 * and returns a JWT token for immediate use.
 */
router.post('/register', validate(registerUserSchema), async (req, res, next) => {
  try {
    const user = await createUser(req.body);
    const token = generateToken(user);

    res.status(201).json({
      message: 'Account created successfully',
      user: { id: user._id, email: user.email, name: user.name },
      token,
    });
  } catch (err) {
    if (err.code === 'DUPLICATE_EMAIL') {
      return res.status(409).json({
        error: 'Conflict',
        message: err.message,
      });
    }
    next(err);
  }
});

/**
 * POST /api/auth/login
 *
 * Authenticate with email and password. Returns a JWT token
 * valid for 24 hours. Failed attempts are logged for security monitoring.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required',
      });
    }

    const user = await verifyCredentials(email, password);

    if (!user) {
      // Use generic message to prevent user enumeration
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      user: { id: user._id, email: user.email, name: user.name },
      token,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 *
 * Return the currently authenticated user's profile.
 * Requires a valid JWT token.
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { findUserById } = require('../models/user');
    const user = await findUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User account not found',
      });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
