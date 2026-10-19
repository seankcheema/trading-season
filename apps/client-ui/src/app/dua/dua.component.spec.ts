import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AccountStore } from '../dashboard/accounts/account-store.service';
import { MarketDataService } from '../dashboard/market-data.service';
import { MarketClockService } from '../dashboard/shared/market-clock.service';
import { DuaComponent } from './dua.component';
import { DuaSession } from './dua-session.service';
import { TokenStorageService } from '../core/auth/token-storage.service';

describe('Dua panel', () => {
  let session: DuaSession;
  const account = {
    selectedAccountId: signal<number | null>(1),
    needsTermsAcceptance: signal(false),
    status: signal('ready'),
  };
  const clock = {
    marketSessionId: signal(1),
    clockUpdating: signal(false),
    currentMarketTimestamp: signal('2026-01-05T15:05:00Z'),
    marketCalendar: signal({ timezone: 'America/Chicago' }),
  };
  const market = { candles: vi.fn() };
  beforeEach(() => {
    account.needsTermsAcceptance.set(false);
    account.selectedAccountId.set(1);
    account.status.set('ready');
    clock.clockUpdating.set(false);
    clock.currentMarketTimestamp.set('2026-01-05T15:05:00Z');
    market.candles.mockReturnValue(
      of({ marketTimestamp: clock.currentMarketTimestamp(), points: [] }),
    );
    TestBed.configureTestingModule({
      imports: [DuaComponent],
      providers: [
        provideRouter([]),
        { provide: AccountStore, useValue: account },
        { provide: TokenStorageService, useValue: { onIdentityChange: () => {} } },
        { provide: MarketClockService, useValue: clock },
        { provide: MarketDataService, useValue: market },
      ],
    });
    session = TestBed.inject(DuaSession);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  function setup() {
    const fixture = TestBed.createComponent(DuaComponent);
    fixture.componentRef.setInput('holdings', [{ symbol: 'AAPL', quantity: 2, averageCost: 100 }]);
    fixture.componentRef.setInput('quotes', [
      { symbol: 'AAPL', name: 'Apple', price: 110, change: 10, changePercent: 10 },
    ]);
    fixture.detectChanges();
    const click = (name: string) => {
      if (name !== 'Dua insights' && session.minimized()) {
        fixture.nativeElement.querySelector('.dua-launcher').click();
        fixture.detectChanges();
      }
      const button = [...fixture.nativeElement.querySelectorAll('button')].find((b: unknown) => {
        const el = b as HTMLButtonElement;
        return el.textContent?.trim().startsWith(name) || el.getAttribute('aria-label') === name;
      }) as HTMLButtonElement;
      button.click();
      fixture.detectChanges();
    };
    return { fixture, click, text: () => fixture.nativeElement.textContent as string };
  }
  it('starts underwater with the chat closed, peeks while open, and minimizes again', () => {
    const { fixture, click } = setup();
    expect(session.minimized()).toBe(true);
    expect(fixture.nativeElement.querySelector('img.visible').src).toContain('shark_under.png');
    expect(fixture.nativeElement.querySelector('input,textarea')).toBeNull();
    click('Dua insights');
    expect(session.minimized()).toBe(false);
    expect(fixture.nativeElement.querySelector('img.visible').src).toContain('shark_peak.png');
    click('Minimize Dua');
    expect(session.minimized()).toBe(true);
    fixture.destroy();
  });
  it('calculates selected insights and clears results on account changes', () => {
    const { fixture, click, text } = setup();
    click('Daily review');
    expect(text()).toContain('up 10.0%');
    account.selectedAccountId.set(2);
    fixture.detectChanges();
    expect(text()).toContain('What would you like');
    expect(text()).not.toContain('up 10.0%');
  });
  it('handles empty holdings, missing prices and terms blocking', () => {
    const { fixture, click, text } = setup();
    fixture.componentRef.setInput('quotes', []);
    fixture.detectChanges();
    click('My holdings');
    expect(text()).toContain('unavailable market prices');
    click('Back to choices');
    fixture.componentRef.setInput('holdings', []);
    fixture.detectChanges();
    click('Daily review');
    expect(text()).toContain('No holdings');
    account.needsTermsAcceptance.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.hidden).toBe(true);
  });
  it('offers stock direction and recovers from failed history requests', () => {
    const { fixture, click, text } = setup();
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    click('This stock');
    expect(text()).toContain('Not enough completed candles');
    market.candles.mockReturnValue(throwError(() => new Error('offline')));
    click('Refresh');
    expect(text()).toContain('Please retry');
    expect(fixture.nativeElement.querySelector('.skeleton')).toBeNull();
  });
  it('cancels outstanding history when the clock seeks', () => {
    const response = new Subject();
    market.candles.mockReturnValue(response);
    const { fixture, click } = setup();
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    click('This stock');
    expect(response.observed).toBe(true);
    clock.clockUpdating.set(true);
    fixture.detectChanges();
    expect(response.observed).toBe(false);
  });
  it('preloads stages and handles missing artwork with an accessible fallback', () => {
    const { fixture } = setup();
    const imgs = fixture.nativeElement.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
    expect(imgs.length).toBe(3);
    imgs[0].dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.fallback').textContent).toBe('Dua');
  });
  it('opens chat and clears the numbered notification in one click', () => {
    const { fixture, click } = setup();
    const imgs = fixture.nativeElement.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
    expect(imgs[0].classList.contains('visible')).toBe(true);
    fixture.componentRef.setInput('quotes', [
      { symbol: 'AAPL', name: 'Apple', price: 120, change: 20, changePercent: 20 },
    ]);
    fixture.detectChanges();
    expect(imgs[2].classList.contains('visible')).toBe(true);
    expect(fixture.nativeElement.querySelector('.notification-count').textContent.trim()).toBe('1');
    click('Dua insights');
    expect(session.minimized()).toBe(false);
    expect(fixture.nativeElement.querySelector('.notification-count')).toBeNull();
    expect(imgs[1].classList.contains('visible')).toBe(true);
    click('Minimize Dua');
    expect(imgs[0].classList.contains('visible')).toBe(true);
    fixture.componentRef.setInput('quotes', [
      { symbol: 'AAPL', name: 'Apple', price: 130, change: 30, changePercent: 30 },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notification-count')).toBeNull();
    expect(imgs[0].classList.contains('visible')).toBe(true);
    account.selectedAccountId.set(2);
    fixture.detectChanges();
    fixture.componentRef.setInput('quotes', [
      { symbol: 'AAPL', name: 'Apple', price: 140, change: 40, changePercent: 40 },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notification-count')).toBeNull();
    fixture.destroy();
  });
  it('changes artwork on hover and restores underwater on pointer leave', () => {
    const { fixture } = setup();
    const launcher = fixture.nativeElement.querySelector('.dua-launcher');
    const event = new Event('pointerenter');
    Object.defineProperty(event, 'pointerType', { value: 'mouse' });
    launcher.dispatchEvent(event);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img.visible').src).toContain('shark_peak.png');
    launcher.dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img.visible').src).toContain('shark_under.png');
    fixture.destroy();
  });
});
