import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';

// The web app can be started from the repo root or from packages/web (npm
// workspace scripts set cwd to the package dir), so locate the repo root by
// walking up to the package.json that declares workspaces.
function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    const pkgFile = path.join(dir, 'package.json');
    if (fs.existsSync(pkgFile)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8')) as {
          workspaces?: unknown;
        };
        if (pkg.workspaces) return dir;
      } catch {
        // Unreadable package.json — keep walking up.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        'SocialScope repo root not found (no package.json with "workspaces" above cwd)',
      );
    }
    dir = parent;
  }
}

export const REPO_ROOT = findRepoRoot(process.cwd());
export const COLLECTOR_DIR = path.join(REPO_ROOT, 'packages', 'collector');
export const SESSIONS_DIR = path.join(REPO_ROOT, '.sessions');
export const DEBUG_DIR = path.join(REPO_ROOT, 'debug');

// Mirrors collector/src/paths.ts: load the repo-root .env once, BOM-tolerant,
// shell environment wins. (Next.js only auto-loads packages/web/.env.)
const ENV_FILE = path.join(REPO_ROOT, '.env');
if (fs.existsSync(ENV_FILE)) {
  let content = fs.readFileSync(ENV_FILE, 'utf8');
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  for (const [key, value] of Object.entries(util.parseEnv(content))) {
    process.env[key] ??= value;
  }
}

export function resolveDbPath(): string {
  const fromEnv = process.env.DB_PATH?.trim();
  return fromEnv
    ? path.resolve(REPO_ROOT, fromEnv)
    : path.join(REPO_ROOT, 'data', 'socialscope.db');
}
