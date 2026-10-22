import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DuaSpeech } from './dua-speech.service';

describe('DuaSpeech', () => {
  let speech: DuaSpeech;

  beforeEach(() => {
    vi.useFakeTimers();
    speech = TestBed.inject(DuaSpeech);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  const text = () => speech.line()?.text ?? null;

  it('says a line for as long as its tone keeps it, with the matching mood', () => {
    speech.say('Filled 1 AAPL at $110.00.');
    expect(speech.line()).toMatchObject({ tone: 'success', mood: 'happy', duration: 6000 });

    vi.advanceTimersByTime(5999);
    expect(text()).toBe('Filled 1 AAPL at $110.00.');
    vi.advanceTimersByTime(1);
    expect(speech.line()).toBeNull();

    speech.say('Rejected.', 'error');
    expect(speech.line()).toMatchObject({ mood: 'worried', duration: 8000 });
    speech.say('A first!', 'celebrate');
    expect(speech.line()).toMatchObject({ mood: 'excited', duration: 7000 });
  });

  it('replaces the current line, or queues one said after it', () => {
    speech.say('First');
    speech.say('Second');
    expect(text()).toBe('Second');

    speech.say('Third', 'celebrate', { after: true });
    expect(text()).toBe('Second');
    vi.advanceTimersByTime(6000);
    expect(text()).toBe('Third');
    vi.advanceTimersByTime(7000);
    expect(speech.line()).toBeNull();

    speech.say('Alone', 'celebrate', { after: true });
    expect(text()).toBe('Alone');
  });

  it('brings back a line that stays once newer lines have gone, until it is dismissed', () => {
    const stays = speech.say('Still there?', 'info', { duration: null, mood: 'sleepy' });
    vi.advanceTimersByTime(60_000);
    expect(text()).toBe('Still there?');

    speech.say('Filled 1 AAPL at $110.00.');
    expect(text()).toBe('Filled 1 AAPL at $110.00.');
    vi.advanceTimersByTime(6000);
    expect(speech.line()).toMatchObject({ text: 'Still there?', mood: 'sleepy' });

    speech.dismiss(stays);
    expect(speech.line()).toBeNull();
  });

  it('drops a dismissed line still waiting in the queue', () => {
    const stays = speech.say('Still there?', 'info', { duration: null });
    speech.say('Filled');
    speech.dismiss(stays);
    vi.advanceTimersByTime(6000);

    expect(speech.line()).toBeNull();
  });
});
