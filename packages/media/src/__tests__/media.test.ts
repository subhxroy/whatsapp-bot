import { describe, it, expect } from 'vitest';
import { validateMediaBuffer } from '../converter';

describe('Media Module Validation', () => {
  it('should throw when media payload is empty', () => {
    expect(() => validateMediaBuffer(Buffer.alloc(0))).toThrow(/Media payload is empty/);
  });

  it('should throw when media exceeds maximum size limit', () => {
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
    const limit = 5 * 1024 * 1024; // 5MB limit
    expect(() => validateMediaBuffer(largeBuffer, limit)).toThrow(/exceeds maximum allowed limit/);
  });

  it('should pass when buffer is within size limit', () => {
    const validBuffer = Buffer.alloc(1 * 1024 * 1024); // 1MB
    expect(() => validateMediaBuffer(validBuffer)).not.toThrow();
  });
});
