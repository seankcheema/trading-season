// Number and date formatting shared by the reporting screens.

const WHOLE_DOLLARS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const DOLLARS = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const COUNT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });
const DATE_TIME = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});
const TIME = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});
const UTC_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

// Headline totals round to whole dollars.
export function wholeDollars(value: number): string {
  return WHOLE_DOLLARS.format(value);
}

export function dollars(value: number): string {
  return DOLLARS.format(value);
}

export function count(value: number): string {
  return COUNT.format(value);
}

export function percent(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

// An instant in the viewer's own time zone, with the zone named: "Oct 8, 3:45 PM CDT".
export function dateTime(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? DATE_TIME.format(date) : '—';
}

export function time(date: Date): string {
  return TIME.format(date);
}

// A report day. The service buckets by UTC day, so it is shown as that day everywhere.
export function utcDay(day: string): string {
  const date = parse(`${day}T00:00:00Z`);
  return date ? UTC_DAY.format(date) : day;
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
