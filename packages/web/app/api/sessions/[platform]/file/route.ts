import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import type { Platform } from '@socialscope/shared';

import { SESSIONS_DIR } from '@/lib/server/paths';

// Cookie that proves a real logged-in session, per platform. An uploaded
// storageState must contain it, or it's not a usable session.
const REQUIRED_COOKIE: Record<Platform, string> = {
  instagram: 'sessionid',
  x: 'auth_token',
};

const MAX_UPLOAD_BYTES = 512 * 1024;

function parsePlatform(value: string): Platform | null {
  return value === 'instagram' || value === 'x' ? value : null;
}

function sessionPath(platform: Platform): string {
  return path.join(SESSIONS_DIR, `${platform}.json`);
}

// Download the saved session file (use on the machine where you logged in, to
// then upload it to a headless server).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> },
): Promise<NextResponse> {
  const platform = parsePlatform((await params).platform);
  if (!platform) {
    return NextResponse.json({ error: 'Geçersiz platform.' }, { status: 400 });
  }

  let contents: string;
  try {
    contents = await readFile(sessionPath(platform), 'utf8');
  } catch {
    return NextResponse.json(
      { error: 'Bu platform için kayıtlı oturum yok.' },
      { status: 404 },
    );
  }

  return new NextResponse(contents, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${platform}.json"`,
    },
  });
}

// Upload a session file exported from another machine (zero server-side
// interaction, no browser needed on the server).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
): Promise<NextResponse> {
  const platform = parsePlatform((await params).platform);
  if (!platform) {
    return NextResponse.json({ error: 'Geçersiz platform.' }, { status: 400 });
  }

  const raw = await request.text();
  if (raw.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: 'Dosya çok büyük, geçerli bir oturum dosyası değil.' },
      { status: 413 },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: 'Dosya geçerli JSON değil.' },
      { status: 400 },
    );
  }

  // Must look like a Playwright storageState carrying the platform's login cookie.
  const cookies =
    parsed && typeof parsed === 'object'
      ? (parsed as { cookies?: unknown }).cookies
      : undefined;
  if (!Array.isArray(cookies)) {
    return NextResponse.json(
      { error: 'Bu bir oturum dosyası değil (cookies alanı yok).' },
      { status: 400 },
    );
  }
  const hasLoginCookie = cookies.some(
    (c) =>
      c &&
      typeof c === 'object' &&
      (c as { name?: unknown }).name === REQUIRED_COOKIE[platform] &&
      typeof (c as { value?: unknown }).value === 'string' &&
      (c as { value: string }).value !== '',
  );
  if (!hasLoginCookie) {
    return NextResponse.json(
      {
        error: `Oturum dosyası ${platform} için geçerli bir giriş içermiyor (${REQUIRED_COOKIE[platform]} çerezi yok). Doğru platformun dosyasını yükleyin.`,
      },
      { status: 400 },
    );
  }

  await mkdir(SESSIONS_DIR, { recursive: true });
  // Re-serialize the parsed object (not the raw text) so only well-formed
  // JSON is ever written to disk.
  await writeFile(sessionPath(platform), JSON.stringify(parsed), 'utf8');

  return NextResponse.json({ ok: true });
}
