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
  ANALYTICS: z.string().transform((v) => v === 'true').default('false'),
  THIRD_PARTY_TRACKING: z.string().transform((v) => v === 'true').default('false'),

  BOT_OWNER_NUMBER: z.string().default('1234567890'),

  GEMINI_API_KEY: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_BASE_URL: z.string().optional().default('https://api.openai.com/v1'),
  OLLAMA_BASE_URL: z.string().optional().default('http://localhost:11434'),
});

export type Env = z.infer<typeof envSchema>;

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
  return parsedEnv;
}

export const env = getEnv();
