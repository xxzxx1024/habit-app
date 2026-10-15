/** Calendar arithmetic at noon survives daylight-saving transitions. */
export function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fromKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}
export function addDays(key: string, days: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}
export function daysBetween(a: string, b: string): number {
  const utc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y!, m! - 1, d!);
  };
  return Math.round((utc(b) - utc(a)) / 86400000);
}
/** A card belongs to the ISO-style calendar week beginning Monday. */
export function weekKey(d = new Date()): string {
  return addDays(dateKey(d), -((d.getDay() + 6) % 7));
}
