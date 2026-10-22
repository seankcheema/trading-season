import { Injectable, OnDestroy, signal } from '@angular/core';
import { DuaMood } from './dua-figure.component';

// What a line is about, which sets its color, how long it stays and how Dua looks saying it.
export type DuaTone = 'success' | 'error' | 'celebrate' | 'info';

export interface DuaLine {
  id: number;
  text: string;
  tone: DuaTone;
  mood: DuaMood;
  // Milliseconds before the line goes; null stays until dismissed.
  duration: number | null;
}

export interface DuaSayOptions {
  // Waits for the line showing now to finish rather than replacing it.
  after?: boolean;
  duration?: number | null;
  mood?: DuaMood;
}

const DURATIONS: Record<DuaTone, number> = {
  success: 6000,
  info: 6000,
  celebrate: 7000,
  error: 8000,
};

const MOODS: Record<DuaTone, DuaMood> = {
  success: 'happy',
  info: 'happy',
  celebrate: 'excited',
  error: 'worried',
};

// What Dua says in the speech bubble beside its launcher, such as an order's outcome. One line
// shows at a time: a new line replaces the current one, except a line that stays until
// dismissed, which comes back once the newer lines have gone. The launcher renders the line
// and announces it to screen readers.
@Injectable({ providedIn: 'root' })
export class DuaSpeech implements OnDestroy {
  private readonly _line = signal<DuaLine | null>(null);
  readonly line = this._line.asReadonly();
  private queue: DuaLine[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 0;

  // Returns the line's id, for dismissing a line that stays.
  say(text: string, tone: DuaTone = 'success', options: DuaSayOptions = {}): number {
    const line: DuaLine = {
      id: ++this.nextId,
      text,
      tone,
      mood: options.mood ?? MOODS[tone],
      duration: options.duration === undefined ? DURATIONS[tone] : options.duration,
    };
    const current = this._line();
    if (current && options.after) {
      this.queue.push(line);
    } else {
      if (current?.duration === null) {
        this.queue.unshift(current);
      }
      this.show(line);
    }
    return line.id;
  }

  dismiss(id: number): void {
    this.queue = this.queue.filter((line) => line.id !== id);
    if (this._line()?.id === id) {
      this.next();
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private show(line: DuaLine): void {
    this.clearTimer();
    this._line.set(line);
    if (line.duration !== null) {
      this.timer = setTimeout(() => this.next(), line.duration);
    }
  }

  private next(): void {
    const following = this.queue.shift();
    if (following) {
      this.show(following);
    } else {
      this.clearTimer();
      this._line.set(null);
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
