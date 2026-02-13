import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter } from "../services/RateLimiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    // 5 burst, 2/sec sustained for easy testing
    limiter = new RateLimiter({ burst: 5, sustainedPerSec: 2 });
  });

  it("allows requests under burst limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(limiter.allow("client-a")).toBe(true);
    }
  });

  it("rejects requests over burst limit", () => {
    for (let i = 0; i < 5; i++) {
      limiter.allow("client-a");
    }
    expect(limiter.allow("client-a")).toBe(false);
  });

  it("tracks clients independently", () => {
    for (let i = 0; i < 5; i++) {
      limiter.allow("client-a");
    }
    // client-b still has full burst
    expect(limiter.allow("client-b")).toBe(true);
  });

  it("refills tokens over time", () => {
    for (let i = 0; i < 5; i++) {
      limiter.allow("client-a");
    }
    expect(limiter.allow("client-a")).toBe(false);

    // Advance time by 1 second -- should refill 2 tokens
    limiter.allow("client-a", Date.now() + 1000);
    // Actually need to call allow at the future time
    const future = Date.now() + 1000;
    // Reset and test with manual time
    const limiter2 = new RateLimiter({ burst: 5, sustainedPerSec: 2 });
    const start = 1000000;
    for (let i = 0; i < 5; i++) {
      limiter2.allow("x", start);
    }
    expect(limiter2.allow("x", start)).toBe(false);
    // 1 second later, 2 tokens refilled
    expect(limiter2.allow("x", start + 1000)).toBe(true);
    expect(limiter2.allow("x", start + 1000)).toBe(true);
    expect(limiter2.allow("x", start + 1000)).toBe(false);
  });

  it("never exceeds burst cap on refill", () => {
    const limiter3 = new RateLimiter({ burst: 3, sustainedPerSec: 10 });
    const start = 1000000;
    // Wait a long time -- tokens should cap at burst
    expect(limiter3.allow("x", start + 100000)).toBe(true);
    expect(limiter3.allow("x", start + 100000)).toBe(true);
    expect(limiter3.allow("x", start + 100000)).toBe(true);
    expect(limiter3.allow("x", start + 100000)).toBe(false);
  });
});
