import { TestBed } from '@angular/core/testing';
import { accessToken } from '../../../testing/fixtures';
import { TokenStorageService } from './token-storage.service';

const STORAGE_KEY = 'ts.reporting.session';

describe('TokenStorageService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  const create = () => TestBed.inject(TokenStorageService);

  it('starts without a session when nothing is stored', () => {
    const storage = create();
    expect(storage.hasSession()).toBe(false);
    expect(storage.accessToken).toBeNull();
    expect(storage.refreshToken).toBeNull();
    expect(storage.isAccessTokenValid()).toBe(false);
    expect(storage.identity()).toEqual({ email: null, roles: [] });
  });

  it('saves tokens, persists them and exposes the display claims', () => {
    const storage = create();
    const token = accessToken({ email: 'ada@example.com', roles: ['ADMIN', 7] });

    storage.save({ accessToken: token, refreshToken: 'refresh-1', expiresIn: 900 });

    expect(storage.hasSession()).toBe(true);
    expect(storage.accessToken).toBe(token);
    expect(storage.refreshToken).toBe('refresh-1');
    expect(storage.isAccessTokenValid()).toBe(true);
    expect(storage.isAccessTokenValid(Date.now() + 901_000)).toBe(false);
    expect(storage.identity()).toEqual({ email: 'ada@example.com', roles: ['ADMIN'] });
    expect(storage.revision).toBe(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).refreshToken).toBe('refresh-1');
  });

  it('restores a stored session on start', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 1000 }),
    );
    const storage = create();
    expect(storage.hasSession()).toBe(true);
    expect(storage.refreshToken).toBe('r');
  });

  it.each([
    ['unparseable text', 'not json'],
    ['a session missing fields', JSON.stringify({ accessToken: 'a' })],
  ])('ignores %s in storage', (_label, raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    expect(create().hasSession()).toBe(false);
  });

  it('clears the session from memory and storage', () => {
    const storage = create();
    storage.save({ accessToken: accessToken(), refreshToken: 'r', expiresIn: 900 });

    storage.clear();

    expect(storage.hasSession()).toBe(false);
    expect(storage.revision).toBe(2);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('shows no identity for a token that is not a JWT or carries no claims', () => {
    const storage = create();
    storage.save({ accessToken: 'opaque', refreshToken: 'r', expiresIn: 900 });
    expect(storage.identity()).toEqual({ email: null, roles: [] });

    storage.save({ accessToken: accessToken(), refreshToken: 'r', expiresIn: 900 });
    expect(storage.identity()).toEqual({ email: null, roles: [] });
  });

  it('keeps working in memory when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const storage = create();

    storage.save({ accessToken: accessToken(), refreshToken: 'r', expiresIn: 900 });
    expect(storage.hasSession()).toBe(true);

    storage.clear();
    expect(storage.hasSession()).toBe(false);
  });
});
