export type Role = 'PUBLIC' | 'ADMIN' | 'OWNER';

export function normalizePhoneNumber(input: string): string {
  if (!input) return '';
  // Extract digits only
  const digits = input.replace(/\D/g, '');
  return digits;
}

export function isOwner(senderJid: string, configuredOwnerNumber: string, isFromMe?: boolean): boolean {
  // If the message originates from the linked bot account itself (fromMe), it is ALWAYS the owner!
  if (isFromMe) {
    return true;
  }

  if (!senderJid) return false;

  const senderDigits = normalizePhoneNumber(senderJid);
  const ownerDigits = normalizePhoneNumber(configuredOwnerNumber);

  // If explicitly configured owner digits match sender digits
  if (ownerDigits && senderDigits === ownerDigits) {
    return true;
  }

  return false;
}

export function hasPermission(
  callerRole: Role,
  requiredRole: Role
): boolean {
  const roleHierarchy: Record<Role, number> = {
    PUBLIC: 1,
    ADMIN: 2,
    OWNER: 3,
  };

  return roleHierarchy[callerRole] >= roleHierarchy[requiredRole];
}
