'use strict';

const { ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('./database');

const COLLECTION = 'users';
const SALT_ROUNDS = 12;

/**
 * Register a new user. Hashes the password with bcrypt before storage.
 * Rejects duplicate emails with a friendly error message.
 *
 * @param {object} data - { email, password, name }
 * @returns {object} The created user (without password hash)
 */
async function createUser(data) {
  const db = getDatabase();

  // Check for existing user
  const existing = await db.collection(COLLECTION).findOne({
    email: data.email.toLowerCase().trim(),
  });

  if (existing) {
    const error = new Error('A user with this email already exists');
    error.code = 'DUPLICATE_EMAIL';
    throw error;
  }

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  const user = {
    email: data.email.toLowerCase().trim(),
    passwordHash,
    name: data.name.trim(),
    role: 'user',              // Default role; 'admin' assigned manually
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection(COLLECTION).insertOne(user);

  // Return user without sensitive fields
  const { passwordHash: _, ...safeUser } = user;
  return { ...safeUser, _id: result.insertedId };
}

/**
 * Verify a user's credentials for login.
 * Uses constant-time comparison via bcrypt to prevent timing attacks.
 * Updates lastLoginAt on successful authentication.
 *
 * @param {string} email
 * @param {string} password
 * @returns {object|null} User object if valid, null if credentials don't match
 */
async function verifyCredentials(email, password) {
  const db = getDatabase();

  const user = await db.collection(COLLECTION).findOne({
    email: email.toLowerCase().trim(),
    isActive: true,
  });

  if (!user) return null;

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return null;

  // Update last login timestamp
  await db.collection(COLLECTION).updateOne(
    { _id: user._id },
    { $set: { lastLoginAt: new Date() } },
  );

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * Find a user by ID, excluding sensitive fields.
 *
 * @param {string} userId
 * @returns {object|null}
 */
async function findUserById(userId) {
  const db = getDatabase();

  const user = await db.collection(COLLECTION).findOne(
    { _id: new ObjectId(userId) },
    { projection: { passwordHash: 0 } },
  );

  return user;
}

/**
 * Deactivate a user account (soft disable).
 * Deactivated users cannot log in but their data is preserved.
 *
 * @param {string} userId
 * @returns {boolean} true if account was deactivated
 */
async function deactivateUser(userId) {
  const db = getDatabase();

  const result = await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(userId) },
    { $set: { isActive: false, updatedAt: new Date() } },
  );

  return result.modifiedCount > 0;
}

module.exports = { createUser, verifyCredentials, findUserById, deactivateUser };
