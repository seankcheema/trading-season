// Regular hours in market-local minutes after midnight, as the market clock defines them
// (08:30 to 15:00).
const OPEN_MINUTE = 8 * 60 + 30;
const CLOSE_MINUTE = 15 * 60;

interface MarketMoment {
  date: string;
  minute: number;
}

// The market-local date and minute of the day for an instant, or null when it is not one.
function marketMoment(at: string, timezone: string): MarketMoment | null {
  const time = Date.parse(at);
  if (!Number.isFinite(time)) {
    return null;
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(time));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    minute: Number(part('hour')) * 60 + Number(part('minute')),
  };
}

// Short, as the note sits beside Dua's name: 45m, 2h, 5h 55m.
function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) {
    return `${Math.max(1, rest)}m`;
  }
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

// Dua's hello and question in one line, by the simulated market's time of day, since that is
// the day the app shows. Without a market time it is a plain hello.
export function duaGreeting(at: string, timezone: string, firstName: string): string {
  const name = firstName.trim() ? `, ${firstName.trim()}` : '';
  const moment = marketMoment(at, timezone);
  const hour = moment ? Math.floor(moment.minute / 60) : null;
  const hello =
    hour === null
      ? `Hi${name}!`
      : hour >= 5 && hour < 12
        ? `Morning${name}!`
        : hour >= 12 && hour < 17
          ? `Afternoon${name}!`
          : hour >= 17 && hour < 22
            ? `Evening${name}!`
            : `Up late${name}?`;
  return `${hello} What should we review?`;
}

// Where the simulated market is in its day, short enough to sit beside Dua's name: opening
// soon, open until the close, or shut. Dates missing from the calendar's trading dates are
// closed all day.
export function duaMarketNote(
  at: string,
  timezone: string,
  tradingDates: readonly string[],
): string {
  const moment = marketMoment(at, timezone);
  if (!moment) {
    return '';
  }
  if (!tradingDates.includes(moment.date)) {
    return 'Market closed today';
  }
  if (moment.minute < OPEN_MINUTE) {
    return `Market opens in ${duration(OPEN_MINUTE - moment.minute)}`;
  }
  if (moment.minute < CLOSE_MINUTE) {
    return `Market closes in ${duration(CLOSE_MINUTE - moment.minute)}`;
  }
  return 'Market closed for the day';
}
