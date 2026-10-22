import { duaGreeting, duaMarketNote } from './dua-greeting';

const ZONE = 'America/Chicago';
// Chicago is five hours behind UTC in October.
const at = (local: string) => new Date(`${local}-05:00`).toISOString();
const TRADING = ['2026-10-21', '2026-10-22', '2026-10-23'];

describe('duaGreeting', () => {
  it('greets by the market time of day and first name, and asks in the same line', () => {
    expect(duaGreeting(at('2026-10-22T07:00:00'), ZONE, 'Sean')).toBe(
      'Morning, Sean! What should we review?',
    );
    expect(duaGreeting(at('2026-10-22T13:00:00'), ZONE, 'Sean')).toBe(
      'Afternoon, Sean! What should we review?',
    );
    expect(duaGreeting(at('2026-10-22T19:00:00'), ZONE, 'Sean')).toBe(
      'Evening, Sean! What should we review?',
    );
    expect(duaGreeting(at('2026-10-22T23:30:00'), ZONE, 'Sean')).toBe(
      'Up late, Sean? What should we review?',
    );
  });

  it('leaves out a missing name and a missing time', () => {
    expect(duaGreeting(at('2026-10-22T09:00:00'), ZONE, '  ')).toBe(
      'Morning! What should we review?',
    );
    expect(duaGreeting('', ZONE, 'Sean')).toBe('Hi, Sean! What should we review?');
  });
});

describe('duaMarketNote', () => {
  it('counts down to the open and the close', () => {
    expect(duaMarketNote(at('2026-10-22T08:10:00'), ZONE, TRADING)).toBe('Market opens in 20m');
    expect(duaMarketNote(at('2026-10-22T08:29:30'), ZONE, TRADING)).toBe('Market opens in 1m');
    expect(duaMarketNote(at('2026-10-22T09:00:00'), ZONE, TRADING)).toBe('Market closes in 6h');
    expect(duaMarketNote(at('2026-10-22T13:35:00'), ZONE, TRADING)).toBe('Market closes in 1h 25m');
  });

  it('says when the market is shut for the day or the whole day', () => {
    expect(duaMarketNote(at('2026-10-22T15:00:00'), ZONE, TRADING)).toBe(
      'Market closed for the day',
    );
    expect(duaMarketNote(at('2026-10-24T10:00:00'), ZONE, TRADING)).toBe('Market closed today');
    expect(duaMarketNote('not a time', ZONE, TRADING)).toBe('');
  });
});
