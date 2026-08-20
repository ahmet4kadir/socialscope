/**
 * Turkish number formatting: thousands separated with '.' and decimals with
 * ',' (e.g. 12.345,67). Every user-visible number goes through here.
 */
export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString('tr-TR');
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
