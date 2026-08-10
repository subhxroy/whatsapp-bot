import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);

export const DEFAULT_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const FFMPEG_TIMEOUT_MS = 60_000; // hard cap on ffmpeg runtime (CPU DoS guard)
export const MAX_OUTPUT_BYTES = 25 * 1024 * 1024; // cap on converted output size (disk DoS guard)

async function runFfmpeg(args: string[], timeoutMs = FFMPEG_TIMEOUT_MS): Promise<void> {
  try {
    await execFileAsync('ffmpeg', args, { timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 10 * 1024 * 1024 });
  } catch (err: any) {
    if (err && (err.killed === true || err.code === 'ETIMEDOUT' || /timed out/i.test(String(err?.message || '')))) {
      throw new Error('Media conversion timed out');
    }
    throw err;
  }
}

async function readOutputSized(filePath: string, maxBytes = MAX_OUTPUT_BYTES): Promise<Buffer> {
  const buf = await fs.readFile(filePath);
  if (buf.length > maxBytes) {
    throw new Error(
      `Converted media exceeds maximum allowed size (${(maxBytes / (1024 * 1024)).toFixed(1)} MB).`
    );
  }
  return buf;
}

export function validateMediaBuffer(buffer: Buffer, maxSize = DEFAULT_MAX_SIZE_BYTES): void {
  if (!buffer || buffer.length === 0) {
    throw new Error('Media payload is empty or invalid.');
  }

  if (buffer.length > maxSize) {
    throw new Error(
      `Media size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit (${(
        maxSize /
        (1024 * 1024)
      ).toFixed(2)} MB).`
    );
  }
}

async function createTempFile(ext: string, buffer: Buffer): Promise<string> {
  const filename = `media_${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const filePath = path.join(os.tmpdir(), filename);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {}
}

export async function imageToSticker(imageBuffer: Buffer, maxSize = DEFAULT_MAX_SIZE_BYTES): Promise<Buffer> {
  validateMediaBuffer(imageBuffer, maxSize);

  const inputPath = await createTempFile('png', imageBuffer);
  const outputPath = path.join(os.tmpdir(), `sticker_${crypto.randomBytes(8).toString('hex')}.webp`);

  try {
    // FFmpeg convert to 512x512 webp sticker
    await runFfmpeg([
      '-y',
      '-i',
      inputPath,
      '-vf',
      'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
      '-preset',
      'default',
      '-an',
      '-vsync',
      '0',
      outputPath,
    ]);

    const resultBuffer = await readOutputSized(outputPath);
    return resultBuffer;
  } finally {
    await safeUnlink(inputPath);
    await safeUnlink(outputPath);
  }
}

export async function videoToSticker(videoBuffer: Buffer, maxSize = DEFAULT_MAX_SIZE_BYTES): Promise<Buffer> {
  validateMediaBuffer(videoBuffer, maxSize);

  const inputPath = await createTempFile('mp4', videoBuffer);
  const outputPath = path.join(os.tmpdir(), `sticker_${crypto.randomBytes(8).toString('hex')}.webp`);

  try {
    await runFfmpeg([
      '-y',
      '-i',
      inputPath,
      '-t',
      '10', // Max 10s video sticker
      '-vf',
      'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=15',
      '-loop',
      '0',
      '-preset',
      'default',
      '-an',
      '-vsync',
      '0',
      outputPath,
    ]);

    const resultBuffer = await readOutputSized(outputPath);
    return resultBuffer;
  } finally {
    await safeUnlink(inputPath);
    await safeUnlink(outputPath);
  }
}

export async function stickerToImage(stickerBuffer: Buffer, maxSize = DEFAULT_MAX_SIZE_BYTES): Promise<Buffer> {
  validateMediaBuffer(stickerBuffer, maxSize);

  const inputPath = await createTempFile('webp', stickerBuffer);
  const outputPath = path.join(os.tmpdir(), `img_${crypto.randomBytes(8).toString('hex')}.png`);

  try {
    await runFfmpeg(['-y', '-i', inputPath, outputPath]);

    const resultBuffer = await readOutputSized(outputPath);
    return resultBuffer;
  } finally {
    await safeUnlink(inputPath);
    await safeUnlink(outputPath);
  }
}

/**
 * Extract audio from a video buffer and return as AAC/MP4 audio buffer.
 * Used by the .toaudio / .mp3 command.
 */
export async function extractAudioFromVideo(videoBuffer: Buffer, maxSize = DEFAULT_MAX_SIZE_BYTES): Promise<Buffer> {
  validateMediaBuffer(videoBuffer, maxSize);

  const inputPath = await createTempFile('mp4', videoBuffer);
  const outputPath = path.join(os.tmpdir(), `audio_${crypto.randomBytes(8).toString('hex')}.mp4`);

  try {
    // Extract audio stream only — no video re-encoding
    await runFfmpeg([
      '-y',
      '-i', inputPath,
      '-vn',             // disable video
      '-acodec', 'aac',  // encode audio as AAC
      '-ab', '128k',     // 128kbps bitrate
      '-ar', '44100',    // 44.1kHz sample rate
      outputPath,
    ]);

    const resultBuffer = await readOutputSized(outputPath);
    return resultBuffer;
  } finally {
    await safeUnlink(inputPath);
    await safeUnlink(outputPath);
  }
}

