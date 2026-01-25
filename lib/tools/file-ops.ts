import type { ToolResult } from '@/lib/schemas';
import { promises as fs } from 'fs';
import path from 'path';

// Session files are stored in a sandboxed directory
const SESSION_BASE_DIR = process.env.SESSION_FILES_DIR || '/tmp/debatelm-sessions';

function getSessionDir(sessionId: string): string {
  // Sanitize session ID to prevent directory traversal
  const sanitizedId = sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
  return path.join(SESSION_BASE_DIR, sanitizedId);
}

function sanitizePath(filePath: string, sessionDir: string): string | null {
  // Resolve the full path
  const resolved = path.resolve(sessionDir, filePath);

  // Ensure the path is within the session directory (prevent directory traversal)
  if (!resolved.startsWith(sessionDir)) {
    return null;
  }

  return resolved;
}

export async function fileRead(filePath: string, sessionId: string): Promise<ToolResult> {
  try {
    const sessionDir = getSessionDir(sessionId);
    const fullPath = sanitizePath(filePath, sessionDir);

    if (!fullPath) {
      return {
        type: 'error',
        error: 'Invalid file path: path must be within session directory',
      };
    }

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return {
        type: 'error',
        error: `File not found: ${filePath}`,
      };
    }

    const content = await fs.readFile(fullPath, 'utf-8');

    // Limit content size
    const maxSize = 100000; // 100KB
    const truncated = content.length > maxSize
      ? content.slice(0, maxSize) + '\n\n[Content truncated...]'
      : content;

    return {
      type: 'file_read',
      result: {
        path: filePath,
        content: truncated,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown file read error';
    return { type: 'error', error: message };
  }
}

export async function fileWrite(
  filePath: string,
  content: string,
  sessionId: string
): Promise<ToolResult> {
  try {
    const sessionDir = getSessionDir(sessionId);
    const fullPath = sanitizePath(filePath, sessionDir);

    if (!fullPath) {
      return {
        type: 'error',
        error: 'Invalid file path: path must be within session directory',
      };
    }

    // Limit content size
    const maxSize = 500000; // 500KB
    if (content.length > maxSize) {
      return {
        type: 'error',
        error: `Content too large: ${content.length} bytes (max ${maxSize})`,
      };
    }

    // Ensure session directory exists
    await fs.mkdir(sessionDir, { recursive: true });

    // Ensure parent directory exists
    const parentDir = path.dirname(fullPath);
    await fs.mkdir(parentDir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');

    return {
      type: 'file_write',
      result: {
        path: filePath,
        success: true,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown file write error';
    return { type: 'error', error: message };
  }
}

// Helper to initialize session with context files
export async function initSessionFiles(
  sessionId: string,
  contextFiles: Array<{ name: string; content: string }>
): Promise<void> {
  const sessionDir = getSessionDir(sessionId);
  await fs.mkdir(sessionDir, { recursive: true });

  for (const file of contextFiles) {
    const fullPath = path.join(sessionDir, file.name);
    const parentDir = path.dirname(fullPath);
    await fs.mkdir(parentDir, { recursive: true });
    await fs.writeFile(fullPath, file.content, 'utf-8');
  }
}

// Helper to clean up session files
export async function cleanupSession(sessionId: string): Promise<void> {
  try {
    const sessionDir = getSessionDir(sessionId);
    await fs.rm(sessionDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}
