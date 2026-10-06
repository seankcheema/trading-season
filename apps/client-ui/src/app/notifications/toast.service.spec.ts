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

  it('replaces old notifications, expires after four seconds, and cleans up after fading', () => {
    vi.useFakeTimers();
    const service = TestBed.inject(ToastService);
    service.show('Filled 1 AAPL at $260.06.', 'success');
    service.show('Rejected: insufficient funds', 'error');
    vi.advanceTimersByTime(3999);
    expect(service.messages()).toHaveLength(1);
    expect(service.messages()[0].message).toBe('Rejected: insufficient funds');
    expect(service.messages().every((message) => !message.closing)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(service.messages().every((message) => message.closing)).toBe(true);
    vi.advanceTimersByTime(400);
    expect(service.messages()).toEqual([]);
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

  it('renders accessible notifications at the root and has no dismiss button', async () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const service = TestBed.inject(ToastService);
    service.show('Filled 1 AAPL', 'success');
    fixture.detectChanges();
    await fixture.whenStable();
    const oldToast = fixture.nativeElement.querySelector('hlm-toaster .toast');
    service.show('Filled 1 AAPL', 'success');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('hlm-toaster .toast')).not.toBe(oldToast);
    service.show('Service unavailable', 'error');
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="status"]')).toBeNull();
    expect(el.querySelectorAll('hlm-toaster .toast')).toHaveLength(1);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Service unavailable');
    expect(el.querySelector('hlm-toaster button')).toBeNull();
    service.dismiss(service.messages()[0].id);
    expect(service.messages()[0].closing).toBe(true);
    service.dismiss(service.messages()[0].id);
    service.dismiss(999);
    service.ngOnDestroy();
  });
});
