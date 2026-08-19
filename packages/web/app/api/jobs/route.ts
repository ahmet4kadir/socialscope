import { NextResponse } from 'next/server';

import { activeJob, listJobs } from '@/lib/server/jobs';

export function GET(): NextResponse {
  return NextResponse.json({ jobs: listJobs(), active: activeJob() });
}
