const HASHTAG_PATTERN = /#([\p{L}\p{N}_]+)/gu;

/**
 * Extracts hashtags from post text: lowercased, deduplicated, without the
 * leading '#'. Unicode-aware, so non-Latin tags survive.
 */
export function extractHashtags(text: string): string[] {
  const tags = new Set<string>();
  for (const match of text.matchAll(HASHTAG_PATTERN)) {
    if (match[1]) tags.add(match[1].toLowerCase());
  }
  return [...tags];
}
