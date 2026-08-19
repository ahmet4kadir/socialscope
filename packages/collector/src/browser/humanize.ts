import type { Page } from 'playwright';

export interface DelayRange {
  min: number;
  max: number;
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

export function humanDelay(range: DelayRange): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, randomBetween(range.min, range.max)),
  );
}

/** A few uneven wheel scrolls with short pauses, like a person skimming. */
export async function humanScroll(page: Page): Promise<void> {
  const steps = randomBetween(2, 5);
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, randomBetween(400, 900));
    await humanDelay({ min: 250, max: 700 });
  }
}
