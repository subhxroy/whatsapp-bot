import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import dotenv from 'dotenv';

// Multi-path dotenv resolution for Turborepo monorepo packages
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../../../.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

export const envSchema = z.object({
  PORT: z.string().transform(Number).default('4000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_URL: z.string().url().default('http://localhost:4000'),
  WEB_URL: z.string().url().default('http://localhost:3000'),

  SESSION_ENCRYPTION_KEY: z
    .string()
    .refine((val) => val.length === 64, {
      message: 'SESSION_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
    })
    .default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),

  JWT_SECRET: z.string().min(16).default('super_secret_jwt_key_change_in_production_32bytes_minimum'),

  // Firebase (Firestore)
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional().default(''),
  FIREBASE_PROJECT_ID: z.string().optional().default(''),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  MESSAGE_LOGGING: z.string().transform((v) => v === 'true').default('false'),
  AI_ENABLED: z.string().transform((v) => v === 'true').default('false'),
  MEDIA_RETENTION: z.enum(['temporary', 'persistent']).default('temporary'),

  // Message history / deleted-message features (privacy-gated).
  // MESSAGE_HISTORY_ENABLED: persist bounded message history (metadata + body per
  //   MESSAGE_CONTENT_RETENTION) for the dashboard. Default FALSE — no message
  //   content is persisted merely for the dashboard unless explicitly enabled.
  // MESSAGE_CONTENT_RETENTION: 'metadata' persists only message metadata (never
  //   bodies); otherwise bodies are retained for the chosen window.
  // DELETED_MESSAGE_RETENTION: how long "for everyone" deletion events are kept
  //   in the deleted-message center.
  MESSAGE_HISTORY_ENABLED: z.string().transform((v) => v === 'true').default('false'),
  MESSAGE_CONTENT_RETENTION: z.enum(['metadata', '7d', '30d', '90d']).default('metadata'),
  DELETED_MESSAGE_RETENTION: z.enum(['24h', '7d', '30d', '90d', 'forever']).default('7d'),
  ANALYTICS: z.string().transform((v) => v === 'true').default('false'),
  THIRD_PARTY_TRACKING: z.string().transform((v) => v === 'true').default('false'),

  // SECURITY: empty by default so missing owner config FAILS CLOSED (nobody authorized).
  // The dashboard persists the authoritative value to Firestore settings/BOT_OWNER_NUMBER;
  // this env var is only a bootstrap fallback.
  BOT_OWNER_NUMBER: z.string().default(''),

  // Comma-separated allowlist of admin emails (verified Google sign-in emails).
  // SECURITY: empty by default — admin access is granted ONLY via the database
  // role (ADMIN/OWNER) unless this allowlist is explicitly configured. No
  // hardcoded emails are ever granted admin access.
  ADMIN_EMAILS: z.string().default(''),

  GEMINI_API_KEY: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_BASE_URL: z.string().optional().default('https://api.openai.com/v1'),
  OLLAMA_BASE_URL: z.string().optional().default('http://localhost:11434'),
});

export type Env = z.infer<typeof envSchema>;

const DEFAULT_JWT_SECRET = 'super_secret_jwt_key_change_in_production_32bytes_minimum';
const DEFAULT_SESSION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

let parsedEnv: Env;

export function getEnv(): Env {
  if (!parsedEnv) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('❌ Invalid environment variables:', result.error.format());
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Environment configuration validation failed');
      }
    }
    parsedEnv = result.success ? result.data : envSchema.parse({});
  }

  // SECURITY: refuse to run in production with well-known default secrets. Anyone
  // who knows the defaults can forge dashboard tokens or decrypt stored WhatsApp
  // session credentials.
  if (process.env.NODE_ENV === 'production') {
    // On Render, generateValue:true only takes effect when the service is first
    // created via render.yaml. Existing services may not have the env var set
    // yet — in that case we warn loudly but allow startup so the dashboard
    // remains accessible for the owner to set the env vars manually.
    const onRender = !!process.env.RENDER;

    if (parsedEnv.JWT_SECRET === DEFAULT_JWT_SECRET) {
      const msg =
        'WARNING: Running in production with the default JWT_SECRET. ' +
        'Set a strong random JWT_SECRET environment variable (e.g. `openssl rand -hex 32`).';
      if (onRender) {
        console.error('🔴 SECURITY ' + msg);
      } else {
        throw new Error(
          'Refusing to start in production with the default JWT_SECRET. Set a strong random value (e.g. `openssl rand -hex 32`).'
        );
      }
    }
    if (parsedEnv.SESSION_ENCRYPTION_KEY === DEFAULT_SESSION_ENCRYPTION_KEY) {
      const msg =
        'WARNING: Running in production with the default SESSION_ENCRYPTION_KEY. ' +
        'Set a strong random 64-char hex value (e.g. `openssl rand -hex 32`).';
      if (onRender) {
        console.error('🔴 SECURITY ' + msg);
      } else {
        throw new Error(
          'Refusing to start in production with the default SESSION_ENCRYPTION_KEY. Set a strong random 64-char hex value (e.g. `openssl rand -hex 32`).'
        );
      }
    }
  }

  return parsedEnv;
}

export const env = getEnv();
