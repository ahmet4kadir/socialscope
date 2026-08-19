import fs from 'node:fs';
import path from 'node:path';

import { NextResponse } from 'next/server';

import type { Platform } from '@socialscope/shared';

import type { SessionInfo } from '@/lib/api-types';
import { SESSIONS_DIR } from '@/lib/server/paths';

const PLATFORMS: Platform[] = ['instagram', 'x'];

export function GET(): NextResponse {
  const sessions: SessionInfo[] = PLATFORMS.map((platform) => {
    const file = path.join(SESSIONS_DIR, `${platform}.json`);
    try {
      const stat = fs.statSync(file);
      return { platform, saved: true, savedAt: stat.mtime.toISOString() };
    } catch {
      return { platform, saved: false, savedAt: null };
    }
  });
  return NextResponse.json({ sessions });
}
