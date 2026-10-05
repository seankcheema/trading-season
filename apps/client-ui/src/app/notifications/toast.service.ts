import { Injectable, OnDestroy, signal } from '@angular/core';
import { HlmToastMessage } from '@shared/ui-components/toast';

const TOAST_DURATION_MS = 4000;

@Injectable({ providedIn: 'root' })
export class ToastService implements OnDestroy {
  private readonly state = signal<readonly HlmToastMessage[]>([]);
  readonly messages = this.state.asReadonly();
  private nextId = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  show(message: string, variant: HlmToastMessage['variant']): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    const id = ++this.nextId;
    this.state.set([{ id, message, variant, closing: false, duration: TOAST_DURATION_MS }]);
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), TOAST_DURATION_MS),
    );
  }

  dismiss(id: number): void {
    const toast = this.state().find((message) => message.id === id);
    if (!toast || toast.closing) return;
    clearTimeout(this.timers.get(id));
    this.state.update((messages) =>
      messages.map((message) => (message.id === id ? { ...message, closing: true } : message)),
    );
    this.timers.set(
      id,
      setTimeout(() => {
        this.state.update((messages) => messages.filter((message) => message.id !== id));
        this.timers.delete(id);
      }, 400),
    );
  }

  ngOnDestroy(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }
}
