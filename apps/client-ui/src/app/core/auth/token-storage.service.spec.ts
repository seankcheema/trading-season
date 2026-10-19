import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TokenStorageService } from './token-storage.service';

const KEY = 'ts.auth.session';

function jwt(sub: string): string {
  const payload = btoa(JSON.stringify({ sub })).replace(/\+/g, '-').replace(/\//g, '_');
  return `header.${payload}.signature`;
}

function create(platform: 'browser' | 'server' = 'browser'): TokenStorageService {
  TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
  return TestBed.inject(TokenStorageService);
}

describe('TokenStorageService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('saves tokens, persists them and clears them again', () => {
    const storage = create();
    expect(storage.hasSession()).toBe(false);
    expect(storage.accessToken).toBeNull();
    expect(storage.refreshToken).toBeNull();
    expect(storage.isAccessTokenValid()).toBe(false);

    storage.save({ accessToken: jwt('1'), refreshToken: 'r', expiresIn: 60 });
    expect(storage.hasSession()).toBe(true);
    expect(storage.refreshToken).toBe('r');
    expect(storage.isAccessTokenValid()).toBe(true);
    expect(storage.isAccessTokenValid(Date.now() + 120_000)).toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY)!).refreshToken).toBe('r');

    storage.clear();
    expect(storage.hasSession()).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('restores a stored session and ignores malformed ones', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 1000 }),
    );
    expect(create().accessToken).toBe('a');
  });

  it.each([
    ['not json', '{'],
    ['wrong field types', JSON.stringify({ accessToken: 1, refreshToken: 'r', expiresAt: 1 })],
    ['missing refresh token', JSON.stringify({ accessToken: 'a', expiresAt: 1 })],
    ['missing expiry', JSON.stringify({ accessToken: 'a', refreshToken: 'r' })],
  ])('treats %s as no session', (_name, raw) => {
    localStorage.setItem(KEY, raw);
    expect(create().hasSession()).toBe(false);
  });

  it('runs identity listeners when the token subject changes or the session clears', () => {
    const storage = create();
    const reset = vi.fn();
    storage.onIdentityChange(reset);

    storage.save({ accessToken: jwt('1'), refreshToken: 'r', expiresIn: 60 });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(storage.identityRevision).toBe(1);

    // Same user: tokens rotate without resetting user data.
    storage.save({ accessToken: jwt('1'), refreshToken: 'r2', expiresIn: 60 });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(storage.revision).toBe(2);

    storage.save({ accessToken: jwt('2'), refreshToken: 'r3', expiresIn: 60 });
    expect(reset).toHaveBeenCalledTimes(2);

    storage.clear();
    expect(reset).toHaveBeenCalledTimes(3);
  });

  it('treats tokens it cannot decode as having no subject', () => {
    const storage = create();
    const reset = vi.fn();
    storage.onIdentityChange(reset);
    storage.save({ accessToken: 'opaque', refreshToken: 'r', expiresIn: 60 });
    storage.save({ accessToken: 'another', refreshToken: 'r', expiresIn: 60 });
    expect(reset).not.toHaveBeenCalled();
    storage.save({ accessToken: jwt('9'), refreshToken: 'r', expiresIn: 60 });
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('keeps the in-memory session when browser storage throws', () => {
    const storage = create();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    storage.save({ accessToken: jwt('1'), refreshToken: 'r', expiresIn: 60 });
    expect(storage.hasSession()).toBe(true);
    storage.clear();
    expect(storage.hasSession()).toBe(false);
  });

  it('returns no session when browser storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(create().hasSession()).toBe(false);
  });

  it('never touches storage on the server', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    const storage = create('server');
    storage.save({ accessToken: jwt('1'), refreshToken: 'r', expiresIn: 60 });
    expect(storage.hasSession()).toBe(true);
    storage.clear();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});
