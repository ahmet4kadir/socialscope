import { NextResponse } from 'next/server';

import { openDbReadonly } from '@/lib/server/db';
import { generateReport } from '@/lib/server/report';

export function GET(): NextResponse {
  const markdown = generateReport(openDbReadonly());
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="socialscope-rapor-${stamp}.md"`,
    },
  });
}
