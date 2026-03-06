'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { validate, createTaskSchema } = require('../middleware/validate');
const { AppError } = require('../middleware/errors');
const {
  createTask,
  findTasks,
  updateTaskStatus,
  deleteTask,
} = require('../models/task');

const router = Router();

// All task routes require authentication
router.use(authenticate);

/**
 * GET /api/tasks
 *
 * List the authenticated user's tasks with filtering and pagination.
 * Query params: status, priority, search, page, limit, sortBy, sortOrder
 */
router.get('/', async (req, res, next) => {
  try {
    const result = await findTasks(req.user.userId, {
      status: req.query.status,
      priority: req.query.priority,
      search: req.query.search,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    });

    res.json({
      tasks: result.tasks,
      pagination: {
        total: result.total,
        page: result.page,
        pages: result.pages,
        limit: parseInt(req.query.limit, 10) || 20,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/tasks
 *
 * Create a new task for the authenticated user.
 * Validates input against the createTaskSchema.
 */
router.post('/', validate(createTaskSchema), async (req, res, next) => {
  try {
    const task = await createTask(req.user.userId, req.body);

    res.status(201).json({
      message: 'Task created',
      task,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/tasks/:id/status
 *
 * Update a task's status. Validates that the transition is allowed
 * (e.g., "completed" tasks cannot move back to "in_progress").
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status) {
      throw new AppError('status field is required', 400);
    }

    const task = await updateTaskStatus(req.params.id, req.user.userId, status);

    if (!task) {
      throw new AppError('Task not found or access denied', 404);
    }

    res.json({
      message: `Task status updated to "${status}"`,
      task,
    });
  } catch (err) {
    // Status transition errors are client errors (400)
    if (err.message.includes('Cannot transition')) {
      return res.status(400).json({
        error: 'Invalid Status Transition',
        message: err.message,
      });
    }
    next(err);
  }
});

/**
 * DELETE /api/tasks/:id
 *
 * Soft-delete a task (sets deletedAt timestamp).
 * Pass ?hard=true for permanent deletion (admin use).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const hard = req.query.hard === 'true';
    const deleted = await deleteTask(req.params.id, req.user.userId, hard);

    if (!deleted) {
      throw new AppError('Task not found or access denied', 404);
    }

    res.json({
      message: hard ? 'Task permanently deleted' : 'Task moved to trash',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
