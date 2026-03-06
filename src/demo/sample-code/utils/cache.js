'use strict';

/**
 * Simple in-memory cache with TTL (Time-To-Live) expiration.
 *
 * Features:
 * - O(1) get/set operations via Map
 * - Automatic eviction of expired entries
 * - Configurable max entries to prevent memory exhaustion
 * - LRU-like eviction: when full, removes the oldest entry
 *
 * Use cases:
 * - Caching database lookups to reduce query load
 * - Storing expensive computation results (e.g., embedding API calls)
 * - Rate limit counter storage
 *
 * Limitations:
 * - Not shared across processes/instances (use Redis for distributed caching)
 * - Entries are lost on process restart
 *
 * @example
 *   const userCache = new TTLCache({ ttlMs: 300_000, maxEntries: 1000 });
 *   userCache.set('user:123', userData);
 *   const cached = userCache.get('user:123'); // Returns userData or null
 */
class TTLCache {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs || 300_000;       // Default: 5 minutes
    this.maxEntries = options.maxEntries || 1000;
    this.store = new Map();

    // Run eviction sweep every ttlMs
    this._sweepTimer = setInterval(() => this._evictExpired(), this.ttlMs);
    if (this._sweepTimer.unref) this._sweepTimer.unref();
  }

  /**
   * Store a value with optional custom TTL.
   * If the cache is at capacity, evicts the oldest entry first.
   *
   * @param {string} key
   * @param {any} value
   * @param {number} [ttlMs] - Override default TTL for this entry
   */
  set(key, value, ttlMs) {
    // Evict oldest if at capacity
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs || this.ttlMs),
    });
  }

  /**
   * Retrieve a value. Returns null if not found or expired.
   * Expired entries are lazily deleted on access.
   *
   * @param {string} key
   * @returns {any|null}
   */
  get(key) {
    const entry = this.store.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Delete a specific key.
   */
  delete(key) {
    return this.store.delete(key);
  }

  /**
   * Remove all entries from the cache.
   */
  clear() {
    this.store.clear();
  }

  /**
   * Get the number of entries currently in the cache.
   * Note: may include expired entries not yet swept.
   */
  get size() {
    return this.store.size;
  }

  /**
   * Sweep through all entries and delete expired ones.
   * Called automatically on the configured interval.
   */
  _evictExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Stop the background sweep timer.
   * Call this when shutting down to avoid dangling timers.
   */
  destroy() {
    clearInterval(this._sweepTimer);
    this.store.clear();
  }
}

module.exports = { TTLCache };
