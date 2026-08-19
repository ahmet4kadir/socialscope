import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import util from 'node:util';

/** Absolute path to the monorepo root (this file lives at packages/collector/src/). */
export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

export const DATA_DIR = path.join(REPO_ROOT, 'data');
export const SESSIONS_DIR = path.join(REPO_ROOT, '.sessions');
export const DEBUG_DIR = path.join(REPO_ROOT, 'debug');

// Load the repo-root .env once, on first import. Unlike process.loadEnvFile
// this tolerates a UTF-8 BOM (Windows editors and PowerShell often write one).
// Values already present in the shell environment take precedence.
const ENV_FILE = path.join(REPO_ROOT, '.env');
if (fs.existsSync(ENV_FILE)) {
  let content = fs.readFileSync(ENV_FILE, 'utf8');
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  for (const [key, value] of Object.entries(util.parseEnv(content))) {
    process.env[key] ??= value;
  }
}
