import { AppData } from './model';
import { points } from './engine';
/** Excel formula injection protection is applied to every user-controlled cell. */
function cell(value: unknown): string {
  let s = String(value ?? '');
  if (typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
export function exportCSV(s: AppData): string {
  const rows: unknown[][] = [
    ['type', 'time', 'name', 'delta', 'balance', 'completion', 'note', 'reference'],
  ];
  for (const e of s.ledger) {
    const c = s.checkIns.find((c) => c.id === e.referenceId);
    rows.push([
      e.kind,
      e.at,
      e.name,
      points(e.delta),
      points(e.balance),
      c?.fraction ?? '',
      c?.note ?? '',
      e.referenceId,
    ]);
  }
  for (const e of s.exemptions)
    rows.push(['exemption', e.at, 'exemption', 0, '', '', e.week, e.id]);
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n');
}
