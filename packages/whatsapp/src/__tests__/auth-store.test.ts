import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const deleteRefs: string[] = [];
  const batch = {
    delete: vi.fn((ref: any) => {
      deleteRefs.push(ref.id);
    }),
    commit: vi.fn(async () => {}),
  };
  const firestoreMock = {
    collection: vi.fn(() => ({
      doc: vi.fn((id: string) => ({ id, ref: { id } })),
    })),
    batch: vi.fn(() => batch),
  };
  const ownerDocs: { id: string; owner: string }[] = [];
  const dbMock = {
    listSessionsForOwner: vi.fn(async (sessionKey: string) => {
      // simulate exact Firestore `where('ownerSession', '==', sessionKey)`:
      // the stored ownerSession FIELD must equal the key exactly. A session
      // whose id merely *starts with* `${sessionKey}_` but belongs to a longer
      // key (e.g. `user_alice_1_2`) is NOT returned.
      return ownerDocs.filter((d) => d.owner === sessionKey).map((d) => d.id);
    }),
  };
  return { deleteRefs, batch, firestoreMock, ownerDocs, dbMock };
});

const { deleteRefs, batch, firestoreMock, ownerDocs, dbMock } = h;

vi.mock('@private-md-bot/database', () => ({
  db: h.dbMock,
  getDb: vi.fn(() => h.firestoreMock),
}));

import { clearFirebaseAuthState } from '../auth-store';

describe('clearFirebaseAuthState — session isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteRefs.length = 0;
    ownerDocs.length = 0;
  });

  it('deletes only docs owned by the exact session key', async () => {
    ownerDocs.splice(
      0,
      ownerDocs.length,
      { id: 'user_917000000000_creds', owner: 'user_917000000000' },
      { id: 'user_917000000000_signal-1', owner: 'user_917000000000' },
      { id: 'user_917000000000_sender-key-42', owner: 'user_917000000000' },
      { id: 'user_1917000000000_creds', owner: 'user_1917000000000' },
      { id: 'user_9170000000000_creds', owner: 'user_9170000000000' },
      { id: 'other_session_creds', owner: 'other_session' }
    );

    await clearFirebaseAuthState('user_917000000000');

    expect(deleteRefs).toEqual([
      'user_917000000000_creds',
      'user_917000000000_signal-1',
      'user_917000000000_sender-key-42',
    ]);
  });

  it('does NOT delete another user whose session key has this one as a prefix', async () => {
    // `user_alice_1` must not wipe `user_alice_1_2` (underscore in username).
    // Real Firestore equality on the ownerSession field guarantees this; a
    // full-scan `doc.id.startsWith('user_alice_1_')` would have wiped them.
    ownerDocs.splice(
      0,
      ownerDocs.length,
      { id: 'user_alice_1_creds', owner: 'user_alice_1' },
      { id: 'user_alice_1_2_creds', owner: 'user_alice_1_2' },
      { id: 'user_alice_1_2_signal-1', owner: 'user_alice_1_2' }
    );

    await clearFirebaseAuthState('user_alice_1');

    expect(deleteRefs).toEqual(['user_alice_1_creds']);
  });

  it('does not delete when the owner has no sessions', async () => {
    ownerDocs.splice(0, ownerDocs.length, {
      id: 'user_other_creds',
      owner: 'user_other',
    });
    await clearFirebaseAuthState('user_917000000000');
    expect(batch.commit).not.toHaveBeenCalled();
    expect(deleteRefs).toEqual([]);
  });

  it('fails closed when the query errors — nothing is deleted', async () => {
    dbMock.listSessionsForOwner.mockRejectedValueOnce(new Error('firestore down'));
    ownerDocs.splice(0, ownerDocs.length, {
      id: 'user_917000000000_creds',
      owner: 'user_917000000000',
    });

    await clearFirebaseAuthState('user_917000000000');

    expect(batch.commit).not.toHaveBeenCalled();
    expect(deleteRefs).toEqual([]);
  });
});
