import { Injectable, computed, signal } from '@angular/core';
import { REPORTING_ROLE } from './reporting-access';

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

// The access token claims this app shows; see the auth service README for the full set.
export interface TokenIdentity {
  email: string | null;
  roles: string[];
}

const STORAGE_KEY = 'ts.reporting.session';

// Persists the auth service's tokens across reloads. Every storage access is guarded
// because it can throw in private windows or with blocked site data.
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly _session = signal<StoredSession | null>(this.read());
  // Changes on every token replacement or clear, even for the same user.
  revision = 0;

  readonly hasSession = computed(() => this._session() !== null);

  // Read from the token for display only. The services verify the token; this never does.
  readonly identity = computed<TokenIdentity>(() => {
    const token = this._session()?.accessToken;
    try {
      const claims = token
        ? JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        : {};
      return {
        email: typeof claims.email === 'string' ? claims.email : null,
        roles: Array.isArray(claims.roles)
          ? claims.roles.filter((role: unknown): role is string => typeof role === 'string')
          : [],
      };
    } catch {
      return { email: null, roles: [] };
    }
  });

  // Whether the signed-in account may use this app at all.
  readonly isAnalyst = computed(() => this.identity().roles.includes(REPORTING_ROLE));

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
    this.revision++;
    const session: StoredSession = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    };
    this._session.set(session);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Keep the in-memory session; it just won't survive a reload.
    }
  }

  clear(): void {
    this.revision++;
    this._session.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }

  private read(): StoredSession | null {
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
