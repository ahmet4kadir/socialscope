import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { DEBUG_DIR } from '@/lib/server/paths';

export interface DebugDump {
  base: string;
  label: string;
  createdAt: string;
  hasScreenshot: boolean;
  hasHtml: boolean;
}

// Lists the scraper's debug dumps (screenshot + HTML saved on selector
// failure). Essential on a headless server, where /app/debug is otherwise
// invisible.
export async function GET(): Promise<NextResponse> {
  let files: string[];
  try {
    files = await readdir(DEBUG_DIR);
  } catch {
    return NextResponse.json({ dumps: [] });
  }

  // Files are named <stamp>-<platform>-<label>.{png,html,txt}. Group by base.
  const bases = new Map<string, { png: boolean; html: boolean }>();
  for (const file of files) {
    const match = /^(.*)\.(png|html|txt)$/.exec(file);
    if (!match) continue;
    const entry = bases.get(match[1]!) ?? { png: false, html: false };
    if (match[2] === 'png') entry.png = true;
    if (match[2] === 'html') entry.html = true;
    bases.set(match[1]!, entry);
  }

  const dumps: DebugDump[] = [];
  for (const [base, kinds] of bases) {
    let createdAt = '';
    try {
      createdAt = (await stat(path.join(DEBUG_DIR, `${base}.png`))).mtime.toISOString();
    } catch {
      createdAt = '';
    }
    // "<stamp>-<platform>-<label>" → the human-meaningful tail.
    const parts = base.split('-');
    const label = parts.slice(6).join('-') || base;
    dumps.push({
      base,
      label,
      createdAt,
      hasScreenshot: kinds.png,
      hasHtml: kinds.html,
    });
  }

  dumps.sort((a, b) => b.base.localeCompare(a.base));
  return NextResponse.json({ dumps: dumps.slice(0, 30) });
}
