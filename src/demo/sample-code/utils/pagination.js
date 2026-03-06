'use strict';

/**
 * Build a MongoDB-compatible pagination pipeline from query parameters.
 *
 * Supports cursor-based pagination (for real-time data) and offset-based
 * pagination (for traditional page navigation).
 *
 * Cursor-based pagination uses the _id field as the cursor, which is
 * more efficient for large collections and avoids the skip() performance
 * penalty. However, it doesn't support jumping to arbitrary pages.
 *
 * @param {object} query - req.query parameters
 * @param {object} [options]
 * @param {number} [options.defaultLimit=20] - Default items per page
 * @param {number} [options.maxLimit=100] - Maximum allowed limit
 * @param {string} [options.defaultSort='createdAt'] - Default sort field
 * @returns {{ pipeline: object[], meta: { page, limit, sort, cursor } }}
 */
function buildPagination(query, options = {}) {
  const defaultLimit = options.defaultLimit || 20;
  const maxLimit = options.maxLimit || 100;
  const defaultSort = options.defaultSort || 'createdAt';

  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const sortField = query.sortBy || defaultSort;
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

  const pipeline = [];

  // Cursor-based pagination (preferred for large datasets)
  if (query.cursor) {
    const { ObjectId } = require('mongodb');
    pipeline.push({
      $match: {
        _id: sortOrder === -1
          ? { $lt: new ObjectId(query.cursor) }
          : { $gt: new ObjectId(query.cursor) },
      },
    });
  }

  pipeline.push({ $sort: { [sortField]: sortOrder } });
  pipeline.push({ $limit: limit + 1 }); // Fetch one extra to detect hasMore

  return {
    pipeline,
    meta: {
      limit,
      sort: { field: sortField, order: sortOrder === 1 ? 'asc' : 'desc' },
      cursor: query.cursor || null,
    },
  };
}

/**
 * Process paginated results and build the response envelope.
 * Handles both cursor-based and offset-based pagination metadata.
 *
 * @param {object[]} results - Query results (with one extra item for hasMore detection)
 * @param {object} meta - Pagination metadata from buildPagination
 * @returns {{ items: object[], pagination: object }}
 */
function formatPaginatedResponse(results, meta) {
  const hasMore = results.length > meta.limit;
  const items = hasMore ? results.slice(0, meta.limit) : results;

  const pagination = {
    count: items.length,
    hasMore,
    sort: meta.sort,
  };

  // Include next cursor for cursor-based pagination
  if (items.length > 0 && hasMore) {
    pagination.nextCursor = items[items.length - 1]._id.toString();
  }

  return { items, pagination };
}

module.exports = { buildPagination, formatPaginatedResponse };
