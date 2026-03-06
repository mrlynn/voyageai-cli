'use strict';

/**
 * HTTP request logger middleware.
 * Logs method, URL, status code, and response time for every request.
 * Output is structured JSON for compatibility with log aggregation tools
 * (Datadog, ELK, CloudWatch, etc.).
 */
function requestLogger(req, res, next) {
  const startTime = process.hrtime.bigint();

  // Capture the original end() to log after response is sent
  const originalEnd = res.end;

  res.end = function (...args) {
    const duration = Number(process.hrtime.bigint() - startTime) / 1_000_000; // ms

    const logEntry = {
      level: 'info',
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent') || 'unknown',
      userId: req.user?.userId || null,
      timestamp: new Date().toISOString(),
    };

    // Log errors at a higher level
    if (res.statusCode >= 500) {
      logEntry.level = 'error';
    } else if (res.statusCode >= 400) {
      logEntry.level = 'warn';
    }

    // Redact sensitive paths from logs
    if (logEntry.url.includes('/auth/login')) {
      logEntry.note = 'body-redacted';
    }

    console.log(JSON.stringify(logEntry));

    originalEnd.apply(res, args);
  };

  next();
}

module.exports = { requestLogger };
