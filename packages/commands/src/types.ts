import { NormalizedMessage, WhatsAppClient } from '@private-md-bot/whatsapp';
import { Role } from '@private-md-bot/security';

export interface CommandContext {
  client: WhatsAppClient;
  message: NormalizedMessage;
  args: string[];
  prefix: string;
  callerRole: Role;
  reply: (content: string | { text: string }) => Promise<any>;
  replyMedia: (
    media: Buffer,
    type: 'image' | 'video' | 'audio' | 'sticker',
    options?: { caption?: string; mimetype?: string }
  ) => Promise<any>;
}

export interface CommandPlugin {
  name: string;
  aliases: string[];
  description: string;
  category: 'general' | 'utility' | 'media' | 'ai' | 'admin';
  ownerOnly: boolean;
  enabled: boolean;
  cooldown: number; // in seconds
  execute: (ctx: CommandContext) => Promise<void>;
}
