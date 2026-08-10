export type Role = 'PUBLIC' | 'ADMIN' | 'OWNER';

/**
 * Canonical phone normalization.
 *
 * Accepts JIDs (…@s.whatsapp.net / @lid), device suffixes (:0, :11),
 * whitespace, +, hyphens and parentheses. Returns digits only, from the
 * user/phone part of the identity.
 *
 * Examples:
 *   "+91 98641 49429"                 -> "919864149429"
 *   "916000619381@s.whatsapp.net"     -> "916000619381"
 *   "916000619381:11@s.whatsapp.net"  -> "916000619381"
 *   "176230491829124@lid"             -> "176230491829124"
 *
 * NOTE: A LID is *not* a phone number. Callers MUST only normalize a value that
 * has already been verified to be a phone identity (see isAuthorizedOwner).
 */
export function normalizePhoneNumber(input: string | null | undefined): string {
  if (!input) return '';
  // Device suffix (:11) and domain (@…) are identity metadata, not phone digits.
  const userPart = String(input).split('@')[0].split(':')[0];
  return userPart.replace(/\D/g, '');
}

/**
 * Strict, fail-closed owner check.
 *
 * SECURITY CONTRACT (do not violate):
 *  - Empty/missing owner configuration  => false (NEVER allow everyone)
 *  - Empty/missing/unknown sender        => false (NEVER allow)
 *  - LID / un-resolvable sender identity => false (authorization MUST use the
 *    resolved phone number, not a LID)
 *  - Exact normalized digits match only; no startsWith/contains/endsWith/fuzzy.
 *
 * @param senderIdentity A phone-number JID (e.g. "916000619381@s.whatsapp.net"),
 *                       a bare phone ("919864149429"), or the value resolved from
 *                       an incoming LID. Pass undefined/null to fail closed.
 * @param configuredOwnerNumber The configured owner phone (any format).
 * @param isFromMe True only when the message originates from the bot's own
 *                 linked WhatsApp account. Cannot be spoofed by external users.
 */
export function isAuthorizedOwner(
  senderIdentity: string | null | undefined,
  configuredOwnerNumber: string | null | undefined,
  isFromMe?: boolean
): boolean {
  // The bot's own linked account cannot be impersonated by an external sender.
  if (isFromMe) {
    return true;
  }

  const ownerDigits = normalizePhoneNumber(configuredOwnerNumber);
  // FAIL CLOSED: missing owner configuration must never authorize anyone.
  if (!ownerDigits) return false;

  const senderDigits = normalizePhoneNumber(senderIdentity);
  // FAIL CLOSED: unknown / unresolved sender identity.
  if (!senderDigits) return false;

  // FAIL CLOSED: LID identity is NOT a phone number and must never be used for
  // authorization. Only a resolved phone identity may be compared.
  if (senderIdentity?.includes('@lid')) return false;

  return senderDigits === ownerDigits;
}

/**
 * Backwards-compatible owner check (kept for existing callers/tests).
 *
 * Same fail-closed semantics as isAuthorizedOwner.
 */
export function isOwner(
  senderJid: string,
  configuredOwnerNumber: string,
  isFromMe?: boolean
): boolean {
  return isAuthorizedOwner(senderJid, configuredOwnerNumber, isFromMe);
}

export function hasPermission(callerRole: Role, requiredRole: Role): boolean {
  const roleHierarchy: Record<Role, number> = {
    PUBLIC: 1,
    ADMIN: 2,
    OWNER: 3,
  };

  return roleHierarchy[callerRole] >= roleHierarchy[requiredRole];
}
