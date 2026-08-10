import { describe, it, expect } from 'vitest';
import { isSafeRegex } from '../regex';

describe('isSafeRegex — ReDoS guard', () => {
  it('accepts simple, safe patterns', () => {
    expect(isSafeRegex('hello')).toBe(true);
    expect(isSafeRegex('\\d{4}')).toBe(true);
    expect(isSafeRegex('^[a-z0-9_.-]+@[a-z0-9.-]+\\.[a-z]{2,}$')).toBe(true);
    expect(isSafeRegex('okay (test) fine')).toBe(true);
  });

  it('rejects nested quantifiers (classic catastrophic backtracking)', () => {
    expect(isSafeRegex('(a+)+')).toBe(false);
    expect(isSafeRegex('(a+)+$')).toBe(false);
    expect(isSafeRegex('^(a*)*$')).toBe(false);
    expect(isSafeRegex('(a?)?')).toBe(false);
    expect(isSafeRegex('(a+)*')).toBe(false);
    expect(isSafeRegex('((a|aa)+)+')).toBe(false);
  });

  it('rejects alternation inside quantified group', () => {
    expect(isSafeRegex('(a|b)+')).toBe(false);
    expect(isSafeRegex('(a|aa)*')).toBe(false);
  });

  it('rejects backreferences', () => {
    expect(isSafeRegex('(a)\\1+')).toBe(false);
    expect(isSafeRegex('(?<x>a)\\k<x>+')).toBe(false);
  });

  it('rejects lookarounds', () => {
    expect(isSafeRegex('(?=.*a)a+')).toBe(false);
    expect(isSafeRegex('(?<!x)a+')).toBe(false);
    expect(isSafeRegex('(?!x)a+')).toBe(false);
  });

  it('rejects bounded repeats followed by quantifiers and huge bounds', () => {
    expect(isSafeRegex('a{1,10}+')).toBe(false);
    expect(isSafeRegex('a{1000,}')).toBe(false);
    expect(isSafeRegex('a{2,}*')).toBe(false);
  });

  it('rejects empty/oversized patterns', () => {
    expect(isSafeRegex('')).toBe(false);
    expect(isSafeRegex('a'.repeat(101))).toBe(false);
  });
});
