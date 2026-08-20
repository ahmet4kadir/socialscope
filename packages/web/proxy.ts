import { NextResponse, type NextRequest } from 'next/server';

// Optional password gate for deployments: set DASHBOARD_PASSWORD in the
// environment and every page/API call requires login at /giris. Unset (the
// localhost default) the dashboard stays open.

const COOKIE = 'socialscope_auth';

async function expectedToken(password: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`socialscope:${password}`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === '/giris' || pathname === '/api/auth') {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE)?.value;
  if (token && token === (await expectedToken(password))) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Giriş gerekli.' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/giris', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
