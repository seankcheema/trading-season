import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from './token-storage.service';

const STORAGE_KEY = 'ts.auth.session';

// A fresh service, constructed from whatever localStorage holds at that moment.
function freshStorage(): TokenStorageService {
  TestBed.resetTestingModule();
  return TestBed.inject(TokenStorageService);
}

describe('TokenStorageService', () => {
  afterEach(() => localStorage.clear());

  it('restores a stored session on construction', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ accessToken: 'stored', refreshToken: 'refresh', expiresAt: Date.now() + 60_000 }),
    );

    const storage = freshStorage();

    expect(storage.hasSession()).toBe(true);
    expect(storage.accessToken).toBe('stored');
    expect(storage.refreshToken).toBe('refresh');
    expect(storage.isAccessTokenValid()).toBe(true);
  });

  it('starts signed out when the stored value is incomplete or not JSON', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken: 'stored' }));
    expect(freshStorage().hasSession()).toBe(false);

    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(freshStorage().hasSession()).toBe(false);

    localStorage.removeItem(STORAGE_KEY);
    expect(freshStorage().hasSession()).toBe(false);
  });

  it('forgets the stored session on clear', () => {
    const storage = freshStorage();
    storage.save({ accessToken: 'a', refreshToken: 'r', expiresIn: 60 });
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"accessToken":"a"');

    storage.clear();

    expect(storage.hasSession()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
