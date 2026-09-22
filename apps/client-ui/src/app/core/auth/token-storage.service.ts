import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  // Lifetime of the access token in seconds, as returned by the auth service.
  expiresIn: number;
}

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  // Epoch milliseconds at which the access token expires.
  expiresAt: number;
}

const STORAGE_KEY = 'ts.auth.session';

// Persists the auth service's tokens across reloads. Storage is only touched in the browser,
// and every access is guarded because it can throw in private windows or with blocked site data.
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly _session = signal<StoredSession | null>(this.read());

  readonly hasSession = computed(() => this._session() !== null);

  get accessToken(): string | null {
    return this._session()?.accessToken ?? null;
  }

  get refreshToken(): string | null {
    return this._session()?.refreshToken ?? null;
  }

  isAccessTokenValid(now = Date.now()): boolean {
    const session = this._session();
    return session !== null && session.expiresAt > now;
  }

  save(tokens: AuthTokens): void {
    const session: StoredSession = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    };
    this._session.set(session);
    if (!this._isBrowser) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Keep the in-memory session; it just won't survive a reload.
    }
  }

  clear(): void {
    this._session.set(null);
    if (!this._isBrowser) {
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }

  private read(): StoredSession | null {
    if (!this._isBrowser) {
      return null;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<StoredSession>;
      return typeof parsed.accessToken === 'string' &&
        typeof parsed.refreshToken === 'string' &&
        typeof parsed.expiresAt === 'number'
        ? (parsed as StoredSession)
        : null;
    } catch {
      return null;
    }
  }
}
