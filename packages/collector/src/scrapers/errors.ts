/**
 * An expected, user-facing scrape failure. The CLI prints the message and the
 * hint instead of a stack trace.
 */
export class ScrapeError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'ScrapeError';
  }
}
