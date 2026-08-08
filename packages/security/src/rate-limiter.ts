export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs = 60000, maxRequests = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  public isRateLimited(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const timestamps = this.requests.get(key) || [];
    const validTimestamps = timestamps.filter((t) => t > windowStart);

    if (validTimestamps.length >= this.maxRequests) {
      return true;
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return false;
  }

  public reset(key: string): void {
    this.requests.delete(key);
  }
}
