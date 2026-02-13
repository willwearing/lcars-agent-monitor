/**
 * Token-bucket rate limiter.
 *
 * Each client gets `burst` tokens. Tokens refill at `sustainedPerSec` per second,
 * capped at the burst limit.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export interface RateLimiterOptions {
  burst: number;
  sustainedPerSec: number;
}

export class RateLimiter {
  private burst: number;
  private sustainedPerSec: number;
  private buckets = new Map<string, Bucket>();

  constructor(opts: RateLimiterOptions) {
    this.burst = opts.burst;
    this.sustainedPerSec = opts.sustainedPerSec;
  }

  allow(clientId: string, now = Date.now()): boolean {
    let bucket = this.buckets.get(clientId);
    if (!bucket) {
      bucket = { tokens: this.burst, lastRefill: now };
      this.buckets.set(clientId, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000;
    if (elapsed > 0) {
      bucket.tokens = Math.min(this.burst, bucket.tokens + elapsed * this.sustainedPerSec);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }
}
