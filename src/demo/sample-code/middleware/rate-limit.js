'use strict';

/**
 * In-memory rate limiter using a sliding window counter.
 *
 * Each client (identified by IP address) gets a maximum number of requests
 * within a time window. Exceeding the limit returns 429 Too Many Requests
 * with a Retry-After header.
 *
 * Note: This is an in-memory implementation suitable for single-instance
 * deployments. For distributed systems, use Redis-backed rate limiting.
 *
 * @param {object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000)
 * @param {number} options.maxRequests - Maximum requests per window (default: 100)
 * @returns {function} Express middleware
 */
function rateLimiter(options = {}) {
  const windowMs = options.windowMs || 60_000;
  const maxRequests = options.maxRequests || 100;

  // Map of clientId → { count, resetTime }
  const clients = new Map();

  // Periodically clean up expired entries to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, data] of clients) {
      if (now > data.resetTime) {
        clients.delete(key);
      }
    }
  }, windowMs * 2);

  // Don't block process exit
  if (cleanupInterval.unref) cleanupInterval.unref();

  return function rateLimit(req, res, next) {
    // Use IP address as client identifier (trust proxy for load-balanced setups)
    const clientId = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    let record = clients.get(clientId);

    // Create new record or reset expired window
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      clients.set(clientId, record);
    }

    record.count++;

    // Set rate limit headers (follows RFC 6585 conventions)
    res.set('X-RateLimit-Limit', maxRequests.toString());
    res.set('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count).toString());
    res.set('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());

    if (record.count > maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.set('Retry-After', retryAfter.toString());

      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter,
      });
    }

    next();
  };
}

module.exports = { rateLimiter };
