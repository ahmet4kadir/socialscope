import type { Platform } from '@socialscope/shared';

import type { PlaywrightScraper } from './base';
import { InstagramScraper } from './instagram';
import { XScraper } from './x';

export function scraperFor(platform: Platform): PlaywrightScraper {
  return platform === 'instagram' ? new InstagramScraper() : new XScraper();
}
