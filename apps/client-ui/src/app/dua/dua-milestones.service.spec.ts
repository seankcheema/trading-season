import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TokenStorageService } from '../core/auth/token-storage.service';
import { DuaMilestones, MILESTONE_LINES } from './dua-milestones.service';
import { DuaSpeech } from './dua-speech.service';

describe('DuaMilestones', () => {
  const userId = signal<string | null>('user-1');

  function setup(platform = 'browser') {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platform },
        { provide: TokenStorageService, useValue: { userId } },
      ],
    });
    return { milestones: TestBed.inject(DuaMilestones), speech: TestBed.inject(DuaSpeech) };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    userId.set('user-1');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("celebrates a first after the action's own line, and only once per user", () => {
    const { milestones, speech } = setup();
    milestones.reached('trade');
    speech.say('Filled 1 AAPL at $110.00.');
    vi.advanceTimersByTime(0);

    expect(speech.line()?.text).toBe('Filled 1 AAPL at $110.00.');
    vi.advanceTimersByTime(6000);
    expect(speech.line()).toMatchObject({ text: MILESTONE_LINES.trade, tone: 'celebrate' });
    vi.advanceTimersByTime(7000);

    milestones.reached('trade');
    vi.advanceTimersByTime(0);
    expect(speech.line()).toBeNull();
    expect(JSON.parse(localStorage.getItem('ts.dua.milestones.user-1')!)).toEqual(['trade']);

    userId.set('user-2');
    milestones.reached('trade');
    vi.advanceTimersByTime(0);
    expect(speech.line()?.text).toBe(MILESTONE_LINES.trade);
  });

  it('stays quiet without a signed-in user, storage or a browser', () => {
    const { milestones, speech } = setup();
    userId.set(null);
    milestones.reached('star');
    vi.advanceTimersByTime(0);
    expect(speech.line()).toBeNull();

    userId.set('user-1');
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    milestones.reached('star');
    vi.advanceTimersByTime(0);
    expect(speech.line()).toBeNull();
    read.mockRestore();

    TestBed.resetTestingModule();
    const server = setup('server');
    server.milestones.reached('star');
    vi.advanceTimersByTime(0);
    expect(server.speech.line()).toBeNull();
  });
});
