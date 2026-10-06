import { Injectable, inject, signal } from '@angular/core';
import { TokenStorageService } from '../../core/auth/token-storage.service';

const STORAGE_KEY = 'ts.recent-instruments';
const LIMIT = 5;

// Symbols the user opened in the order ticket, newest first, for the search bar's "Recently
// viewed" suggestions. Kept in sessionStorage so a reload keeps them but a closed tab does not,
// and dropped whenever the signed-in user changes so one user's browsing never shows to another.
@Injectable({ providedIn: 'root' })
export class RecentInstrumentsService {
  readonly symbols = signal<string[]>(this.read());

  constructor() {
    inject(TokenStorageService).onIdentityChange(() => {
      this.symbols.set([]);
      this.write([]);
    });
  }

  record(symbol: string): void {
    const next = [symbol, ...this.symbols().filter((existing) => existing !== symbol)].slice(
      0,
      LIMIT,
    );
    this.symbols.set(next);
    this.write(next);
  }

  private read(): string[] {
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string').slice(0, LIMIT)
        : [];
    } catch {
      // Storage is unavailable on the server, in private windows and when the value is corrupt.
      return [];
    }
  }

  private write(symbols: string[]): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
    } catch {
      // Suggestions are a convenience; losing them is harmless.
    }
  }
}
