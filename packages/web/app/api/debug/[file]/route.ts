import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { DEBUG_DIR } from '@/lib/server/paths';

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.html': 'text/plain; charset=utf-8', // as text, so it can't execute
  '.txt': 'text/plain; charset=utf-8',
};

// Serves one debug file. The name is validated to a single safe basename so
// it can never escape the debug directory.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
): Promise<NextResponse> {
  const name = (await params).file;
  if (name !== path.basename(name) || name.includes('..')) {
    return NextResponse.json({ error: 'Geçersiz dosya.' }, { status: 400 });
  }
  const ext = path.extname(name);
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return NextResponse.json({ error: 'Bu dosya türü sunulmuyor.' }, { status: 400 });
  }

  let data: Buffer;
  try {
    data = await readFile(path.join(DEBUG_DIR, name));
  } catch {
    return NextResponse.json({ error: 'Dosya bulunamadı.' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: { 'Content-Type': contentType },
  });
}
