export const GENERIC_PAIR_CODE_ERROR = 'Unable to generate pairing code.';

/**
 * Converts any thrown error from the pairing-code path into a client-safe
 * response. SECURITY: the raw error (Baileys/Firebase internals, filesystem
 * paths, environment names, tokens) must NEVER reach the client. The full
 * error is logged server-side by the caller, not returned.
 */
export function safePairCodeError(_err: unknown): { statusCode: number; body: { error: string } } {
  return { statusCode: 500, body: { error: GENERIC_PAIR_CODE_ERROR } };
}
