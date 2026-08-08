import { describe, it, expect } from 'vitest';
import { isOwner, hasPermission } from '../permissions';

describe('Permissions Module (RBAC & Owner checks)', () => {
  const configuredOwnerNumber = '1234567890';

  it('should identify owner based on configured phone digits', () => {
    expect(isOwner('1234567890@s.whatsapp.net', configuredOwnerNumber)).toBe(true);
    expect(isOwner('9999999999@s.whatsapp.net', configuredOwnerNumber)).toBe(false);
  });

  it('should enforce role hierarchy correctly', () => {
    expect(hasPermission('OWNER', 'ADMIN')).toBe(true);
    expect(hasPermission('ADMIN', 'OWNER')).toBe(false);
    expect(hasPermission('PUBLIC', 'OWNER')).toBe(false);
    expect(hasPermission('PUBLIC', 'PUBLIC')).toBe(true);
  });
});
