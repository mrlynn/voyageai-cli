'use strict';

const { ObjectId } = require('mongodb');
const { getDatabase } = require('./database');

const COLLECTION = 'tasks';

/**
 * Task priorities ordered from lowest to highest.
 * Used for sorting and validation.
 */
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

/**
 * Valid task status transitions. Prevents invalid state changes like
 * moving a completed task back to "in_progress".
 */
const STATUS_TRANSITIONS = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'blocked', 'pending'],
  blocked: ['in_progress', 'cancelled'],
  completed: [],        // Terminal state — no transitions allowed
  cancelled: ['pending'], // Can reopen cancelled tasks
};

/**
 * Create a new task for a user.
 * Applies default values for status, priority, and timestamps.
 *
 * @param {string} userId - Owner of the task
 * @param {object} data - { title, description, priority?, dueDate?, tags? }
 * @returns {object} The created task document
 */
async function createTask(userId, data) {
  const db = getDatabase();

  const task = {
    userId: new ObjectId(userId),
    title: data.title,
    description: data.description || '',
    status: 'pending',
    priority: PRIORITIES.includes(data.priority) ? data.priority : 'medium',
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 10) : [],
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };

  const result = await db.collection(COLLECTION).insertOne(task);
  return { ...task, _id: result.insertedId };
}

/**
 * Find tasks for a user with filtering, sorting, and pagination.
 *
 * @param {string} userId
 * @param {object} [options]
 * @param {string} [options.status] - Filter by status
 * @param {string} [options.priority] - Filter by priority
 * @param {string} [options.search] - Full-text search in title/description
 * @param {number} [options.page=1] - Page number (1-indexed)
 * @param {number} [options.limit=20] - Items per page (max 100)
 * @param {string} [options.sortBy='createdAt'] - Sort field
 * @param {string} [options.sortOrder='desc'] - 'asc' or 'desc'
 * @returns {{ tasks: object[], total: number, page: number, pages: number }}
 */
async function findTasks(userId, options = {}) {
  const db = getDatabase();
  const query = { userId: new ObjectId(userId) };

  // Apply filters
  if (options.status) query.status = options.status;
  if (options.priority) query.priority = options.priority;
  if (options.search) {
    query.$text = { $search: options.search };
  }

  // Pagination
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const skip = (page - 1) * limit;

  // Sorting
  const sortField = options.sortBy || 'createdAt';
  const sortDirection = options.sortOrder === 'asc' ? 1 : -1;

  const [tasks, total] = await Promise.all([
    db.collection(COLLECTION)
      .find(query)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection(COLLECTION).countDocuments(query),
  ]);

  return {
    tasks,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

/**
 * Update a task's status with transition validation.
 * Throws if the transition is not allowed (e.g., completed → in_progress).
 * Automatically sets completedAt when status changes to "completed".
 *
 * @param {string} taskId
 * @param {string} userId - Must own the task
 * @param {string} newStatus
 * @returns {object|null} Updated task or null if not found
 */
async function updateTaskStatus(taskId, userId, newStatus) {
  const db = getDatabase();

  const task = await db.collection(COLLECTION).findOne({
    _id: new ObjectId(taskId),
    userId: new ObjectId(userId),
  });

  if (!task) return null;

  const allowed = STATUS_TRANSITIONS[task.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Cannot transition from "${task.status}" to "${newStatus}". ` +
      `Allowed transitions: ${allowed.join(', ') || 'none (terminal state)'}`
    );
  }

  const update = {
    $set: {
      status: newStatus,
      updatedAt: new Date(),
      ...(newStatus === 'completed' ? { completedAt: new Date() } : {}),
    },
  };

  await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(taskId) },
    update,
  );

  return { ...task, ...update.$set };
}

/**
 * Delete a task. Only the task owner can delete it.
 * Uses soft delete by default — sets a deletedAt timestamp.
 *
 * @param {string} taskId
 * @param {string} userId
 * @param {boolean} [hard=false] - Permanently remove instead of soft delete
 * @returns {boolean} true if task was found and deleted
 */
async function deleteTask(taskId, userId, hard = false) {
  const db = getDatabase();
  const filter = { _id: new ObjectId(taskId), userId: new ObjectId(userId) };

  if (hard) {
    const result = await db.collection(COLLECTION).deleteOne(filter);
    return result.deletedCount > 0;
  }

  const result = await db.collection(COLLECTION).updateOne(filter, {
    $set: { deletedAt: new Date(), updatedAt: new Date() },
  });

  return result.modifiedCount > 0;
}

module.exports = {
  createTask,
  findTasks,
  updateTaskStatus,
  deleteTask,
  PRIORITIES,
  STATUS_TRANSITIONS,
};
