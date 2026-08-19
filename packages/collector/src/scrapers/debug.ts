import fs from 'node:fs';
import path from 'node:path';

import type { Page } from 'playwright';

import { DEBUG_DIR } from '../paths';

/**
 * Saves a screenshot + HTML dump + context note to debug/ for post-mortem
 * when a scrape fails. Never throws — debugging must not mask the original
 * error. Returns the common path prefix of the written files, or null.
 */
export async function dumpDebug(
  page: Page,
  platform: string,
  label: string,
): Promise<string | null> {
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = path.join(DEBUG_DIR, `${stamp}-${platform}-${label}`);
    await page.screenshot({ path: `${base}.png` }).catch(() => {});
    fs.writeFileSync(`${base}.html`, await page.content());
    fs.writeFileSync(`${base}.txt`, `url: ${page.url()}\nlabel: ${label}\n`);
    return base;
  } catch {
    return null;
  }
}
