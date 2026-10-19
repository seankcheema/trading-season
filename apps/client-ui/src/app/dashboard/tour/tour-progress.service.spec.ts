import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TourProgressService } from './tour-progress.service';

describe('TourProgressService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  function create(platform = 'browser'): TourProgressService {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
    return TestBed.inject(TourProgressService);
  }

  it('is not done and starts at the first step when nothing was saved', () => {
    const progress = create();

    expect(progress.isDone()).toBe(false);
    expect(progress.savedStep(7)).toBe(0);
  });

  it('resumes the saved step, kept within the steps that exist', () => {
    const progress = create();

    progress.saveStep(3);
    expect(progress.savedStep(7)).toBe(3);

    localStorage.setItem('ts.tour.step', '42');
    expect(progress.savedStep(7)).toBe(6);
    localStorage.setItem('ts.tour.step', '-2');
    expect(progress.savedStep(7)).toBe(0);
    localStorage.setItem('ts.tour.step', 'not a number');
    expect(progress.savedStep(7)).toBe(0);
  });

  it('remembers a finished tour and forgets its step', () => {
    const progress = create();
    progress.saveStep(4);

    progress.finish();

    expect(progress.isDone()).toBe(true);
    expect(localStorage.getItem('ts.tour.step')).toBeNull();
    expect(progress.savedStep(7)).toBe(0);
  });

  it('treats storage that cannot be used as empty', () => {
    const progress = create();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => progress.saveStep(2)).not.toThrow();
    expect(() => progress.finish()).not.toThrow();
    expect(progress.isDone()).toBe(false);
    expect(progress.savedStep(7)).toBe(0);
  });

  it('neither reads nor writes storage on the server', () => {
    localStorage.setItem('ts.tour.done', '1');
    const progress = create('server');

    progress.saveStep(5);
    progress.finish();

    expect(progress.isDone()).toBe(false);
    expect(localStorage.getItem('ts.tour.step')).toBeNull();
  });
});
