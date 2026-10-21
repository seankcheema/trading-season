import { TestBed } from '@angular/core/testing';
import { vi, afterEach } from 'vitest';
import { App } from '../app';
import { provideRouter } from '@angular/router';
import { ToastService } from './toast.service';

describe('Toast notifications', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('replaces old notifications, expires a success after four seconds, and cleans up after fading', () => {
    vi.useFakeTimers();
    const service = TestBed.inject(ToastService);
    service.show('Rejected: insufficient funds', 'error');
    service.show('Filled 1 AAPL at $260.06.', 'success');
    vi.advanceTimersByTime(3999);
    expect(service.messages()).toHaveLength(1);
    expect(service.messages()[0].message).toBe('Filled 1 AAPL at $260.06.');
    expect(service.messages().every((message) => !message.closing)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(service.messages().every((message) => message.closing)).toBe(true);
    vi.advanceTimersByTime(400);
    expect(service.messages()).toEqual([]);
  });

  it('keeps an error until it is dismissed or replaced', () => {
    vi.useFakeTimers();
    const service = TestBed.inject(ToastService);
    service.show('Service unavailable', 'error');
    expect(service.messages()[0].duration).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(service.messages()[0].closing).toBe(false);

    service.dismiss(service.messages()[0].id);
    expect(service.messages()[0].closing).toBe(true);
    vi.advanceTimersByTime(400);
    expect(service.messages()).toEqual([]);
  });

  it('holds a success while it is pointed at or focused, then lets it run out', () => {
    vi.useFakeTimers();
    const service = TestBed.inject(ToastService);
    service.show('Filled 1 AAPL', 'success');
    const id = service.messages()[0].id;
    vi.advanceTimersByTime(3000);

    service.pause(id);
    vi.advanceTimersByTime(30_000);
    expect(service.messages()[0].closing).toBe(false);

    service.resume(id);
    // The second it had left, since that is more than the floor of one second.
    vi.advanceTimersByTime(999);
    expect(service.messages()[0].closing).toBe(false);
    vi.advanceTimersByTime(1);
    expect(service.messages()[0].closing).toBe(true);
  });

  it('cancels the old fade timer when a new message arrives', () => {
    vi.useFakeTimers();
    const service = TestBed.inject(ToastService);
    service.show('Old fill', 'success');
    vi.advanceTimersByTime(4000);
    expect(service.messages()[0].closing).toBe(true);
    service.show('New fill', 'success');
    vi.advanceTimersByTime(400);
    expect(service.messages()).toHaveLength(1);
    expect(service.messages()[0].message).toBe('New fill');
    expect(service.messages()[0].closing).toBe(false);
    vi.advanceTimersByTime(3600);
    expect(service.messages()[0].closing).toBe(true);
    vi.advanceTimersByTime(400);
    expect(service.messages()).toEqual([]);
  });

  it('announces through live regions that are always on the page, and can be dismissed', async () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const polite = el.querySelector('hlm-toaster [aria-live="polite"]')!;
    const assertive = el.querySelector('hlm-toaster [aria-live="assertive"]')!;
    // Present before any message, so a screen reader is already listening to them.
    expect(polite).not.toBeNull();
    expect(assertive).not.toBeNull();
    expect(el.querySelector('hlm-toaster section')?.getAttribute('aria-label')).toBe(
      'Notifications',
    );

    const service = TestBed.inject(ToastService);
    service.show('Filled 1 AAPL', 'success');
    fixture.detectChanges();
    await fixture.whenStable();
    const oldToast = el.querySelector('hlm-toaster .toast');
    expect(polite.textContent).toContain('Filled 1 AAPL');
    service.show('Filled 1 AAPL', 'success');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('hlm-toaster .toast')).not.toBe(oldToast);

    service.show('Service unavailable', 'error');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelectorAll('hlm-toaster .toast')).toHaveLength(1);
    expect(assertive.textContent).toContain('Service unavailable');
    expect(polite.textContent).not.toContain('Filled');
    // The visible copy is hidden from screen readers, which hear the live region instead.
    expect(el.querySelector('hlm-toaster .toast p')?.getAttribute('aria-hidden')).toBe('true');

    el.querySelector<HTMLButtonElement>('hlm-toaster button[aria-label="Dismiss notification"]')!
      .click();
    expect(service.messages()[0].closing).toBe(true);
    service.dismiss(service.messages()[0].id);
    service.dismiss(999);
    service.ngOnDestroy();
  });
});
