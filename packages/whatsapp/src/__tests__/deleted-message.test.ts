import { describe, it, expect } from 'vitest';
import {
  unwrapMessageContent,
  extractMessageBody,
  getMessageBodyType,
  extractRecoveredContent,
  extractFallbackIdentity,
  extractQuotedId,
  messageTimestampMs,
} from '../deleted-message';

function webMsg(key: any, message: any): any {
  return { key, message };
}

describe('deleted-message extraction helpers', () => {
  it('unwraps ephemeral and view-once envelopes', () => {
    const content = {
      ephemeralMessage: {
        message: { viewOnceMessage: { message: { conversation: 'hello' } } },
      },
    };
    const unwrapped = unwrapMessageContent(content);
    expect(unwrapped?.conversation).toBe('hello');
  });

  it('extracts text from conversation and extendedTextMessage', () => {
    expect(extractMessageBody({ conversation: 'hi' })).toBe('hi');
    expect(extractMessageBody({ extendedTextMessage: { text: 'long text' } })).toBe('long text');
    expect(extractMessageBody({ imageMessage: { caption: 'with caption' } })).toBe('with caption');
    expect(extractMessageBody(null)).toBe('');
  });

  it('classifies message body types', () => {
    expect(getMessageBodyType({ conversation: 'x' })).toBe('conversation');
    expect(getMessageBodyType({ imageMessage: {} })).toBe('imageMessage');
    expect(getMessageBodyType({ protocolMessage: {} })).toBe('protocolMessage');
    expect(getMessageBodyType({})).toBe('unknown');
  });

  it('recovers text content from a cached deleted message', () => {
    const cached = webMsg(
      { id: 'ABC', remoteJid: '919000000000@s.whatsapp.net', fromMe: false },
      { extendedTextMessage: { text: 'this will be deleted', contextInfo: { stanzaId: 'QUOTED1' } } }
    );
    const recovered = extractRecoveredContent(cached);
    expect(recovered.contentAvailable).toBe(true);
    expect(recovered.body).toBe('this will be deleted');
    expect(recovered.messageType).toBe('extendedTextMessage');
    expect(recovered.hasMedia).toBe(false);
    expect(recovered.quotedId).toBe('QUOTED1');
  });

  it('detects media messages', () => {
    const cached = webMsg(
      { id: 'IMG', remoteJid: '919000000000@s.whatsapp.net' },
      { imageMessage: { caption: '' } }
    );
    const recovered = extractRecoveredContent(cached);
    expect(recovered.hasMedia).toBe(true);
    expect(recovered.mediaType).toBe('image');
    // Empty caption → content not available (nothing meaningful to show).
    expect(recovered.contentAvailable).toBe(false);
  });

  it('never fabricates content for protocol-only revokes', () => {
    const cached = webMsg(
      { id: 'P', remoteJid: '919000000000@s.whatsapp.net' },
      { protocolMessage: { type: 0, key: {} } }
    );
    const recovered = extractRecoveredContent(cached);
    expect(recovered.contentAvailable).toBe(false);
    expect(recovered.body).toBeUndefined();
    expect(recovered.messageType).toBe('protocolMessage');
  });

  it('extracts phone identity from update key fallback', () => {
    const identity = extractFallbackIdentity(
      { id: 'ABC', remoteJid: '919000000000@s.whatsapp.net', participant: '918111111111@s.whatsapp.net', fromMe: false },
      '919000000000@s.whatsapp.net'
    );
    expect(identity.senderNumber).toBe('918111111111');
    expect(identity.senderResolved).toBe(true);
    expect(identity.fromMe).toBe(false);
  });

  it('flags unresolved LID senders (fail-closed identity)', () => {
    const identity = extractFallbackIdentity(
      { id: 'ABC', remoteJid: '919000000000@s.whatsapp.net', participant: '912345678901@lid', fromMe: false },
      '919000000000@s.whatsapp.net'
    );
    expect(identity.senderResolved).toBe(false);
  });

  it('computes message timestamps from number, Long-like, and missing', () => {
    expect(messageTimestampMs({ messageTimestamp: 1700000000 })).toBe(1700000000 * 1000);
    expect(messageTimestampMs({ messageTimestamp: { low: 1700000000, high: 0 } })).toBe(1700000000 * 1000);
    const now = Date.now();
    expect(Math.abs(messageTimestampMs({}) - now)).toBeLessThan(1000);
  });

  it('extracts quoted stanza ids', () => {
    const content = { extendedTextMessage: { text: 'x', contextInfo: { stanzaId: 'Q1' } } };
    expect(extractQuotedId(content)).toBe('Q1');
    expect(extractQuotedId({})).toBeUndefined();
  });
});
