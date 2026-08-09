export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(windowMs = 60000, maxRequests = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // 🔒 MEMORY: Evict expired entries every 5 minutes to prevent unbounded growth.
    // Without this, every unique sender JID would accumulate indefinitely.
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const windowStart = now - this.windowMs;
      for (const [key, timestamps] of this.requests) {
        const valid = timestamps.filter((t) => t > windowStart);
        if (valid.length === 0) {
          this.requests.delete(key);
        } else {
          this.requests.set(key, valid);
        }
      }
    }, 5 * 60 * 1000);

    // Allow the interval to be GC'd if the process exits
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
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

  public destroy(): void {
    clearInterval(this.cleanupInterval);
    this.requests.clear();
  }
}
