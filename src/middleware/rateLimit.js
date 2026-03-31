/**
 * Token-bucket rate limiter middleware.
 * Per-user isolation keyed by session ID.
 */

/**
 * Create a rate limiter middleware.
 * @param {object} opts
 * @param {number} opts.burst - Maximum tokens (burst capacity)
 * @param {number} opts.refillRate - Tokens added per refill interval
 * @param {number} opts.refillInterval - Milliseconds between refills
 * @returns {Function} Express middleware
 */
export function createRateLimiter({ burst = 10, refillRate = 5, refillInterval = 1000 } = {}) {
  const buckets = new Map();

  function getBucket(key) {
    if (!buckets.has(key)) {
      buckets.set(key, { tokens: burst, lastRefill: Date.now() });
    }
    const bucket = buckets.get(key);

    // Refill tokens based on elapsed time
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const intervals = Math.floor(elapsed / refillInterval);
    if (intervals > 0) {
      bucket.tokens = Math.min(burst, bucket.tokens + intervals * refillRate);
      bucket.lastRefill += intervals * refillInterval;
    }

    return bucket;
  }

  return function rateLimiter(req, res, next) {
    const key = req.session?.id || req.ip || 'anonymous';
    const bucket = getBucket(key);

    if (bucket.tokens > 0) {
      bucket.tokens--;
      next();
    } else {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait and try again.' });
    }
  };
}
