import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { TokenStorageService } from '../core/auth/token-storage.service';
import { DuaSpeech } from './dua-speech.service';

export type DuaMilestone = 'deposit' | 'trade' | 'account' | 'star';

// Firsts only. Profits, losses and streaks are deliberately not celebrated, so trading never
// becomes a game to keep score in.
export const MILESTONE_LINES: Record<DuaMilestone, string> = {
  deposit: 'Your first deposit is in. Now for the fun part: find a stock you like.',
  trade: 'Your first order is in. Welcome to the market!',
  account: 'Your second account is ready. Holdings and charts follow whichever account you pick.',
  star: "Your first stock on the watch list. I'll keep an eye on it for you.",
};

const STORAGE_PREFIX = 'ts.dua.milestones.';

// Lets Dua celebrate a user's firsts once each. The caller decides from its data that this was
// a first (for example, the watch list going from empty to one stock); this remembers, per user
// in this browser, which firsts were celebrated, so undoing and redoing one stays quiet.
@Injectable({ providedIn: 'root' })
export class DuaMilestones {
  private readonly speech = inject(DuaSpeech);
  private readonly tokens = inject(TokenStorageService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  reached(milestone: DuaMilestone): void {
    const userId = this.tokens.userId();
    if (!this.isBrowser || !userId) {
      return;
    }
    const key = STORAGE_PREFIX + userId;
    let done: string[];
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      done = Array.isArray(stored) ? stored.filter((item) => typeof item === 'string') : [];
      if (done.includes(milestone)) {
        return;
      }
      localStorage.setItem(key, JSON.stringify([...done, milestone]));
    } catch {
      // Without storage there is no way to celebrate only once, so stay quiet.
      return;
    }
    // The action's own line (such as an order's fill) is said in the same turn, after the
    // service that reports the milestone, so the celebration waits a turn to follow it.
    setTimeout(() => this.speech.say(MILESTONE_LINES[milestone], 'celebrate', { after: true }));
  }
}
