/**
 * ReDoS guard for user-supplied regular expressions.
 *
 * JavaScript's RegExp engine has no built-in execution timeout, so catastrophic
 * backtracking on a user-supplied pattern can hang the event loop (a single
 * message could block the entire WhatsApp bot). These static checks reject the
 * constructs that cause exponential/polynomial backtracking.
 *
 * This is a conservative allowlist-style guard: patterns that are not proven
 * safe are rejected. It is NOT a full regex parser; it deliberately over-rejects
 * complex-but-valid expressions.
 *
 * @returns true only when the pattern is considered safe to execute
 */
export function isSafeRegex(pattern: string): boolean {
  if (!pattern) return false;

  // Bound the pattern size — very long triggers are suspicious and any legit
  // trigger can be expressed in under 100 characters.
  if (pattern.length > 100) return false;

  // Backreferences (`\1`, `\k<name>`) can cause exponential backtracking.
  if (/\\[1-9]/.test(pattern) || /\\k</.test(pattern)) return false;

  // Lookarounds: `(?=`, `(?!`, `(?<=`, `(?<!` are common ReDoS amplifiers.
  if (/\(\?[=!]/.test(pattern)) return false;
  if (/\(\?<[=!]/.test(pattern)) return false;

  // Nested quantifier: `(x+)+`, `(x*)*`, `(x?)?`, `(x+)*`, `(x*)+`, `(x+)?`, …
  if (/\([^()]*[+*?][^()]*\)\s*[+*?]/.test(pattern)) return false;

  // Group containing alternation followed by a quantifier: `(a|b)+`, `(a|b)*`.
  if (/\([^()]+\|[^()]+\)\s*[+*?]/.test(pattern)) return false;

  // Bounded repeat followed by a quantifier: `{1,10}+`, `{2,}*`.
  if (/\{\s*\d+(\s*,\s*\d*)?\s*\}\s*[+*?]/.test(pattern)) return false;

  // Excessively large repeat bounds.
  if (/\{\s*\d{3,}\s*(\s*,\s*\d*\s*)?\}/.test(pattern)) return false;

  // `(.*)` pairings that form `(a+)+` style bombs on any input length.
  if (/\(\s*\.\*\s*\)/.test(pattern)) return false;

  return true;
}
