import fs from 'node:fs';
import path from 'node:path';

import type { BrowserContext } from 'playwright';

import type { Platform } from '@socialscope/shared';

import { SESSIONS_DIR } from '../paths';

export function sessionFilePath(platform: Platform): string {
  return path.join(SESSIONS_DIR, `${platform}.json`);
}

export function hasSession(platform: Platform): boolean {
  return fs.existsSync(sessionFilePath(platform));
}

/** Persists cookies + local storage for reuse by later scrapes. */
export async function saveSession(
  context: BrowserContext,
  platform: Platform,
): Promise<string> {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  const file = sessionFilePath(platform);
  await context.storageState({ path: file });
  return file;
}
