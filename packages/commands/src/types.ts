import { NormalizedMessage, WhatsAppClient } from '@private-md-bot/whatsapp';
import { Role } from '@private-md-bot/security';

export interface GroupParticipant {
  id: string;
  admin: 'admin' | 'superadmin' | null;
}

export interface GroupMetadata {
  id: string;
  subject: string;
  creation?: number;
  participants: GroupParticipant[];
}

export interface CommandContext {
  client: WhatsAppClient;
  message: NormalizedMessage;
  msg?: NormalizedMessage;
  args: string[];
  prefix: string;
  callerRole: Role;
  // Basic reply
  reply: (content: string | { text: string }) => Promise<any>;
  // Media reply (image/video/audio/sticker buffer)
  replyMedia: (
    media: Buffer,
    type: 'image' | 'video' | 'audio' | 'sticker',
    options?: { caption?: string; mimetype?: string }
  ) => Promise<any>;
  // Send video with optional gifPlayback flag
  replyWithVideo: (
    media: Buffer,
    mimetype: string,
    gifPlayback?: boolean,
    caption?: string
  ) => Promise<any>;
  // Send audio/voice note
  replyWithAudio: (media: Buffer, mimetype: string) => Promise<any>;
  // Download media from quoted message
  downloadQuotedMedia: () => Promise<Buffer>;
  // Fetch group metadata via Baileys socket
  getGroupMetadata: () => Promise<GroupMetadata | null>;
}

export interface CommandPlugin {
  name: string;
  aliases: string[];
  description: string;
  category: 'general' | 'utility' | 'media' | 'ai' | 'admin' | 'group' | 'fun';
  ownerOnly: boolean;
  enabled: boolean;
  cooldown: number; // in seconds
  execute: (ctx: CommandContext) => Promise<void>;
  handler?: (ctx: CommandContext) => Promise<void>;
}
