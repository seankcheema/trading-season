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

const CLOCK = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const HOUR = new Intl.DateTimeFormat('en-US', { hour: 'numeric' });
const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const LONG_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const DAY_CLOCK = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const DAY_SECONDS = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});
const FULL = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short',
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

// "+8.40%", "-1.10%".
export function signedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

// "+$84,210", "-$800".
export function signedWholeDollars(value: number): string {
  return `${value >= 0 ? '+' : '-'}${WHOLE_DOLLARS.format(Math.abs(value))}`;
}

// "+$2,500.00", "-$800.00".
export function signedDollars(value: number): string {
  return `${value >= 0 ? '+' : '-'}${DOLLARS.format(Math.abs(value))}`;
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

type Stamp = string | null | undefined;

function stamp(formatter: Intl.DateTimeFormat, iso: Stamp): string {
  const date = parse(iso);
  return date ? formatter.format(date) : '—';
}

// The formats below are in the viewer's own time zone.

// "3:44 PM".
export const clock = (iso: Stamp) => stamp(CLOCK, iso);
// "3 PM".
export const hour = (iso: Stamp) => stamp(HOUR, iso);
// "Oct 8".
export const day = (iso: Stamp) => stamp(DAY, iso);
// "Jan 2, 2026".
export const longDay = (iso: Stamp) => stamp(LONG_DAY, iso);
// "Oct 8, 3:44 PM".
export const dayClock = (iso: Stamp) => stamp(DAY_CLOCK, iso);
// "Oct 8, 3:44:12 PM".
export const daySeconds = (iso: Stamp) => stamp(DAY_SECONDS, iso);
// "Oct 8, 2026, 3:44:12 PM CDT".
export const fullStamp = (iso: Stamp) => stamp(FULL, iso);

// The time for something that happened today, otherwise the day and time.
export function recent(iso: Stamp, now: Date = new Date()): string {
  const date = parse(iso);
  if (!date) {
    return '—';
  }
  return date.toDateString() === now.toDateString() ? CLOCK.format(date) : DAY_CLOCK.format(date);
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
