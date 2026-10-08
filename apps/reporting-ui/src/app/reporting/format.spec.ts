import { count, dateTime, dollars, percent, time, utcDay, wholeDollars } from './format';

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
  });

  it('shows an instant with its time zone named, and a dash when there is none', () => {
    expect(dateTime('2026-10-08T19:45:00.123456+00:00')).toMatch(/^Oct \d{1,2}, \d{1,2}:45 [AP]M \S+/);
    expect(dateTime(null)).toBe('—');
    expect(dateTime('not a date')).toBe('—');
    expect(time(new Date('2026-10-08T20:00:00Z'))).toMatch(/^\d{1,2}:00 [AP]M \S+/);
  });

  it('shows a report day as its UTC day wherever it is read', () => {
    expect(utcDay('2026-10-07')).toBe('Oct 7');
    expect(utcDay('someday')).toBe('someday');
  });
});
