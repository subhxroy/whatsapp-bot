import path from 'path';

export function sanitizeShellArg(arg: string): string {
  // Reject args containing suspicious shell metacharacters
  if (/['"`$;|&><\\]/.test(arg)) {
    throw new Error(`Potential command injection attempt detected: ${arg}`);
  }
  return arg;
}

export function sanitizeFilePath(filePath: string, allowedDir?: string): string {
  const normalized = path.normalize(filePath);
  if (normalized.includes('..') || normalized.includes('\0')) {
    throw new Error(`Path traversal attempt detected in path: ${filePath}`);
  }

  if (allowedDir) {
    const normalizedAllowed = path.normalize(allowedDir);
    if (!normalized.startsWith(normalizedAllowed)) {
      throw new Error(`Path is outside allowed directory (${allowedDir}): ${filePath}`);
    }
  }

  return normalized;
}
