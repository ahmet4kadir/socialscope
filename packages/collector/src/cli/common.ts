/** Prints a user-facing error (+ optional hint) and exits non-zero. */
export function fail(message: string, hint?: string): never {
  console.error(`\n[error] ${message}`);
  if (hint) console.error(`        ${hint}`);
  process.exit(1);
}
