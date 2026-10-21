import { Injectable, OnDestroy, signal } from '@angular/core';
import { HlmToastMessage } from '@shared/ui-components/toast';

const TOAST_DURATION_MS = 4000;
const FADE_MS = 400;
// A countdown let go after being held always leaves at least this long to read the rest.
const MIN_RESUME_MS = 1000;

interface Countdown {
  remaining: number;
  startedAt: number;
  held: boolean;
}

// One toast at a time: a new message replaces the old one. A success message closes after four
// seconds, but its countdown is held while the toast is pointed at or focused. An error stays
// until it is dismissed or replaced, so there is no time limit on reading it (WCAG 2.2.1).
@Injectable({ providedIn: 'root' })
export class ToastService implements OnDestroy {
  private readonly state = signal<readonly HlmToastMessage[]>([]);
  readonly messages = this.state.asReadonly();
  private nextId = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly countdowns = new Map<number, Countdown>();

  show(message: string, variant: HlmToastMessage['variant']): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.countdowns.clear();
    const id = ++this.nextId;
    const duration = variant === 'error' ? null : TOAST_DURATION_MS;
    this.state.set([{ id, message, variant, closing: false, duration }]);
    if (duration !== null) {
      this.startCountdown(id, duration);
    }
  }

  // Holds a toast's countdown, while it is pointed at or focused.
  pause(id: number): void {
    const countdown = this.countdowns.get(id);
    if (!countdown || countdown.held) {
      return;
    }
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    countdown.remaining -= Date.now() - countdown.startedAt;
    countdown.held = true;
  }

  // Lets a held countdown run again.
  resume(id: number): void {
    const countdown = this.countdowns.get(id);
    if (!countdown?.held) {
      return;
    }
    this.startCountdown(id, Math.max(countdown.remaining, MIN_RESUME_MS));
  }

  dismiss(id: number): void {
    const toast = this.state().find((message) => message.id === id);
    if (!toast || toast.closing) {
      return;
    }
    clearTimeout(this.timers.get(id));
    this.countdowns.delete(id);
    this.state.update((messages) =>
      messages.map((message) => (message.id === id ? { ...message, closing: true } : message)),
    );
    this.timers.set(
      id,
      setTimeout(() => {
        this.state.update((messages) => messages.filter((message) => message.id !== id));
        this.timers.delete(id);
      }, FADE_MS),
    );
  }

  ngOnDestroy(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.countdowns.clear();
  }

  private startCountdown(id: number, ms: number): void {
    this.countdowns.set(id, { remaining: ms, startedAt: Date.now(), held: false });
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), ms),
    );
  }
}
