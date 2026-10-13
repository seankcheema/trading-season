import {
  clock,
  count,
  dateTime,
  day,
  dayClock,
  daySeconds,
  dollars,
  fullStamp,
  hour,
  longDay,
  percent,
  plural,
  recent,
  signedDollars,
  signedPercent,
  signedWholeDollars,
  time,
  utcDay,
  wholeDollars,
} from './format';

describe('formatting', () => {
  it('formats money with cents and headline totals in whole dollars', () => {
    expect(dollars(1424.66)).toBe('$1,424.66');
    expect(wholeDollars(6043.91)).toBe('$6,044');
  });

  it('formats counts and percentages', () => {
    expect(count(1284)).toBe('1,284');
    expect(count(4.5)).toBe('4.5');
    expect(percent(90.24)).toBe('90.2%');
    expect(percent(null)).toBe('—');
    expect(plural(1, 'trader')).toBe('1 trader');
    expect(plural(1284, 'order')).toBe('1,284 orders');
    expect(plural(0, 'fill')).toBe('0 fills');
  });

  it('shows an instant with its time zone named, and a dash when there is none', () => {
    expect(dateTime('2026-10-08T19:45:00.123456+00:00')).toMatch(/^Oct \d{1,2}, \d{1,2}:45 [AP]M \S+/);
    expect(dateTime(null)).toBe('—');
    expect(dateTime('not a date')).toBe('—');
    expect(time(new Date('2026-10-08T20:00:00Z'))).toMatch(/^\d{1,2}:00 [AP]M \S+/);
  });

  it('signs a change so its direction reads without color', () => {
    expect([signedPercent(8.4), signedPercent(-1.1), signedPercent(0)]).toEqual(['+8.40%', '-1.10%', '+0.00%']);
    expect([signedWholeDollars(84210.4), signedWholeDollars(-800)]).toEqual(['+$84,210', '-$800']);
    expect([signedDollars(2500), signedDollars(-800)]).toEqual(['+$2,500.00', '-$800.00']);
  });

  it("shows a moment in the viewer's own time, as short as its place needs", () => {
    const at = '2026-10-08T20:44:12+00:00';
    expect(clock(at)).toMatch(/^\d{1,2}:44 [AP]M$/);
    expect(hour(at)).toMatch(/^\d{1,2} [AP]M$/);
    expect(day(at)).toMatch(/^Oct \d{1,2}$/);
    expect(longDay(at)).toMatch(/^Oct \d{1,2}, 2026$/);
    expect(dayClock(at)).toMatch(/^Oct \d{1,2}, \d{1,2}:44 [AP]M$/);
    expect(daySeconds(at)).toMatch(/^Oct \d{1,2}, \d{1,2}:44:12 [AP]M$/);
    expect(fullStamp(at)).toMatch(/^Oct \d{1,2}, 2026, \d{1,2}:44:12 [AP]M \S+$/);
    expect([clock(null), day(undefined), daySeconds('nonsense')]).toEqual(['—', '—', '—']);
  });

  it('gives only the time for something that happened today', () => {
    const now = new Date('2026-10-08T12:00:00');
    expect(recent('2026-10-08T09:30:00', now)).toMatch(/^9:30 AM$/);
    expect(recent('2026-10-07T09:30:00', now)).toMatch(/^Oct 7, 9:30 AM$/);
    expect(recent(null, now)).toBe('—');
    expect(recent(new Date().toISOString())).toMatch(/^\d{1,2}:\d{2} [AP]M$/);
  });

  it('shows a report day as its UTC day wherever it is read', () => {
    expect(utcDay('2026-10-07')).toBe('Oct 7');
    expect(utcDay('someday')).toBe('someday');
  });
});
