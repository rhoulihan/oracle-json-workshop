import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRateLimiter } from '../../src/middleware/rateLimit.js';

function mockReqRes(sessionId = 'user1') {
  return {
    req: { session: { id: sessionId } },
    res: {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    },
  };
}

describe('createRateLimiter', () => {
  let limiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = createRateLimiter({ burst: 10, refillRate: 5, refillInterval: 1000 });
  });

  it('allows requests within burst limit', async () => {
    for (let i = 0; i < 10; i++) {
      const { req, res } = mockReqRes();
      const next = vi.fn();
      limiter(req, res, next);
      expect(next).toHaveBeenCalled();
    }
  });

  it('returns 429 when burst is exhausted', () => {
    // Exhaust the burst
    for (let i = 0; i < 10; i++) {
      const { req, res } = mockReqRes();
      limiter(req, res, vi.fn());
    }
    // 11th request should be throttled
    const { req, res } = mockReqRes();
    const next = vi.fn();
    limiter(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toMatch(/rate limit/i);
  });

  it('refills tokens over time', () => {
    // Exhaust burst
    for (let i = 0; i < 10; i++) {
      const { req, res } = mockReqRes();
      limiter(req, res, vi.fn());
    }
    // Advance time by 1 second — should refill 5 tokens
    vi.advanceTimersByTime(1000);
    for (let i = 0; i < 5; i++) {
      const { req, res } = mockReqRes();
      const next = vi.fn();
      limiter(req, res, next);
      expect(next).toHaveBeenCalled();
    }
    // 6th should fail
    const { req, res } = mockReqRes();
    const next = vi.fn();
    limiter(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('isolates users by session ID', () => {
    // Exhaust user1
    for (let i = 0; i < 10; i++) {
      const { req, res } = mockReqRes('user1');
      limiter(req, res, vi.fn());
    }
    // user2 should still have tokens
    const { req, res } = mockReqRes('user2');
    const next = vi.fn();
    limiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('does not exceed burst cap on refill', () => {
    // Use 2 tokens
    for (let i = 0; i < 2; i++) {
      const { req, res } = mockReqRes();
      limiter(req, res, vi.fn());
    }
    // Wait a long time — tokens should cap at burst
    vi.advanceTimersByTime(10000);
    let allowed = 0;
    for (let i = 0; i < 15; i++) {
      const { req, res } = mockReqRes();
      const next = vi.fn();
      limiter(req, res, next);
      if (next.mock.calls.length > 0) allowed++;
    }
    expect(allowed).toBe(10);
  });

  it('handles missing session gracefully', () => {
    const req = {};
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    const next = vi.fn();
    limiter(req, res, next);
    // Should use a fallback key and still work
    expect(next).toHaveBeenCalled();
  });
});
