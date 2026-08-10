import { describe, it, expect, beforeEach } from 'vitest';
import { WhatsAppClient } from '../client';

function cachedMsg(id: string, chatId: string, tsSec = Math.floor(Date.now() / 1000)): any {
  return {
    key: { id, remoteJid: chatId, fromMe: false },
    message: { extendedTextMessage: { text: `msg-${id}` } },
    messageTimestamp: tsSec,
  };
}

const MAX_TOTAL = (WhatsAppClient as any).MAX_CACHED_MESSAGES as number;
const MAX_PER_CHAT = (WhatsAppClient as any).MAX_CACHED_MESSAGES_PER_CHAT as number;
const TTL_MS = (WhatsAppClient as any).MESSAGE_CACHE_TTL_MS as number;

describe('bounded message cache', () => {
  let client: any;

  beforeEach(() => {
    client = new WhatsAppClient('test_session');
  });

  it('caps messages per chat and drops the oldest of that chat', () => {
    const chatId = '919000000000@s.whatsapp.net';
    const t0 = Math.floor(Date.now() / 1000);
    for (let i = 0; i < MAX_PER_CHAT + 10; i++) {
      client.cacheMessage(`id-${i}`, cachedMsg(`id-${i}`, chatId, t0 + i));
    }
    const chatMessages = client.getChatMessages(chatId, MAX_TOTAL);
    expect(chatMessages.length).toBe(MAX_PER_CHAT);
    // Oldest messages evicted; newest retained.
    expect(chatMessages[0].key.id).toBe(`id-${MAX_PER_CHAT + 9}`);
    expect(client.getCachedMessage('id-0')).toBeUndefined();
  });

  it('evicts expired entries on read (TTL bound)', () => {
    const chatId = '919000000000@s.whatsapp.net';
    const old = Math.floor(Date.now() / 1000) - Math.ceil(TTL_MS / 1000) - 60;
    client.cacheMessage('stale', cachedMsg('stale', chatId, old));
    expect(client.getCachedMessage('stale')).toBeUndefined();
  });

  it('keeps fresh entries within TTL', () => {
    const chatId = '919000000000@s.whatsapp.net';
    client.cacheMessage('fresh', cachedMsg('fresh', chatId));
    expect(client.getCachedMessage('fresh')).toBeDefined();
  });

  it('enforces a hard overall bound across many chats', () => {
    const t0 = Math.floor(Date.now() / 1000);
    const perChat = Math.floor(MAX_PER_CHAT * 0.75); // 3 chats × 75 = 225 < 300
    for (let c = 0; c < 5; c++) {
      const chatId = `91900000000${c}@s.whatsapp.net`;
      for (let i = 0; i < perChat; i++) {
        const id = `c${c}-${i}`;
        client.cacheMessage(id, cachedMsg(id, chatId, t0 + i));
      }
    }
    const all = client.getRecentMessages(MAX_TOTAL);
    expect(all.length).toBeLessThanOrEqual(MAX_TOTAL);
    expect(client.recentMessages.size).toBeLessThanOrEqual(MAX_TOTAL);
  });

  it('returns recent messages newest-first and bounds the snapshot', () => {
    const chatId = '919000000000@s.whatsapp.net';
    const t0 = Math.floor(Date.now() / 1000);
    client.cacheMessage('a', cachedMsg('a', chatId, t0));
    client.cacheMessage('b', cachedMsg('b', chatId, t0 + 5));
    client.cacheMessage('c', cachedMsg('c', chatId, t0 + 10));
    const recent = client.getRecentMessages(10);
    expect(recent.map((m: any) => m.key.id)).toEqual(['c', 'b', 'a']);
  });

  it('filters chat snapshots without leaking other chats', () => {
    client.cacheMessage('a', cachedMsg('a', '911@s.whatsapp.net'));
    client.cacheMessage('b', cachedMsg('b', '922@s.whatsapp.net'));
    const chat1 = client.getChatMessages('911@s.whatsapp.net');
    expect(chat1.map((m: any) => m.key.id)).toEqual(['a']);
  });
});
