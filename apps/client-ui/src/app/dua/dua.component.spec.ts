import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
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
    selectedAccount: signal({ accountId: 1, name: 'Investing' }),
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
  it('starts fin-focused with chat closed, reveals the face while open, and minimizes again', () => {
    const { fixture, click } = setup();
    expect(session.minimized()).toBe(true);
    expect(fixture.nativeElement.querySelector('.launcher-body').src).toContain(
      'shark-launcher-body-512.png',
    );
    expect(fixture.nativeElement.querySelector('.launcher-fin').src).toContain(
      'shark-launcher-fin-512.png',
    );
    expect(fixture.nativeElement.querySelector('.launcher-art.face-visible')).toBeNull();
    expect(fixture.nativeElement.querySelector('input,textarea')).toBeNull();
    click('Dua insights');
    expect(session.minimized()).toBe(false);
    expect(fixture.nativeElement.querySelector('.launcher-art.face-visible')).not.toBeNull();
    click('Minimize Dua');
    expect(session.minimized()).toBe(true);
    fixture.destroy();
  });
  it('keeps launcher and panel clicks open, but closes outside without stealing focus', () => {
    vi.useFakeTimers();
    const { fixture, click } = setup();
    const outside = document.createElement('button');
    document.body.append(outside);
    try {
      click('Dua insights');
      expect(session.minimized()).toBe(false);
      click('Daily Review');
      expect(session.minimized()).toBe(false);
      fixture.nativeElement.querySelector('.takeaway').click();
      fixture.detectChanges();
      expect(session.minimized()).toBe(false);

      outside.focus();
      outside.click();
      fixture.detectChanges();
      vi.runOnlyPendingTimers();
      expect(session.minimized()).toBe(true);
      expect(document.activeElement).toBe(outside);

      click('Dua insights');
      expect(session.minimized()).toBe(false);
      click('Dua insights');
      expect(session.minimized()).toBe(true);
    } finally {
      outside.remove();
      fixture.destroy();
    }
  });

  it('calculates selected insights and clears results on account changes', () => {
    const { fixture, click, text } = setup();
    click('Daily Review');
    expect(
      fixture.nativeElement.querySelector('.takeaway').textContent.replace(/\s+/g, ' '),
    ).toContain('market closed on a high note');
    expect(fixture.nativeElement.querySelector('.insight-card strong')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.insight-card:not(.inactive)').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.distribution')).toBeNull();
    click('Next insight');
    expect(text()).toContain('$385');
    expect(fixture.nativeElement.querySelector('[aria-label="Up"]')).not.toBeNull();
    account.selectedAccountId.set(2);
    fixture.detectChanges();
    expect(text()).toContain('What would you like');
    expect(text()).not.toContain('$385');
  });
  it('handles empty holdings, missing prices and terms blocking', () => {
    const { fixture, click, text } = setup();
    fixture.componentRef.setInput('quotes', []);
    fixture.detectChanges();
    click('My Holdings');
    expect(text()).toContain('+12.4%');
    click('Back to choices');
    fixture.componentRef.setInput('holdings', []);
    fixture.detectChanges();
    click('Daily Review');
    expect(text()).toContain('Market overview');
    account.needsTermsAcceptance.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.hidden).toBe(true);
  });
  it('shows three disclosed illustrative cards without fetching stock history', () => {
    const { fixture, click, text } = setup();
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    click('This Stock');
    expect(text()).toContain('Stock Insights');
    expect(text()).toContain('+24.8%');
    expect(fixture.nativeElement.querySelector('.card-meta').textContent).toContain('01/05/2026');
    expect(fixture.nativeElement.querySelectorAll('.card-indicator').length).toBe(3);
    click('Next insight');
    expect(text()).toContain('-18%');
    expect(fixture.nativeElement.querySelector('.card-meta').textContent).toContain('01/05/2026');
    click('Next insight');
    expect(text()).toContain('65%');
    expect(text()).toContain('03 / 03');
    expect(market.candles).not.toHaveBeenCalled();
    click('Refresh');
    expect(text()).toContain('Growth insight');
  });
  it('shows holdings placeholders with periods and restores them after explanations', () => {
    const { fixture, click, text } = setup();
    click('My Holdings');
    expect(text()).toContain('This Month');
    expect(text()).toContain('+12.4%');
    click('Next insight');
    expect(text()).toContain('68%');
    expect(text()).toContain('Current');
    expect(text()).not.toContain('A downturn in this sector');
    click('Explain these numbers');
    expect(text()).toContain('Why it matters');
    expect(text()).toContain('A downturn in this sector');
    expect(fixture.nativeElement.querySelector('.insight-explanation')).not.toBeNull();
    expect(text()).toContain('not calculated from your account');
    click('Back to results');
    expect(text()).toContain('68%');
    click('Next insight');
    expect(text()).toContain('+32.8%');
    expect(fixture.nativeElement.querySelectorAll('.card-indicator').length).toBe(3);
    click('Refresh');
    expect(text()).toContain('+12.4%');
  });
  it('keeps the daily market review available for an account without holdings', () => {
    const { fixture, click, text } = setup();
    fixture.componentRef.setInput('holdings', []);
    fixture.detectChanges();
    click('Daily Review');
    expect(text()).toContain('Market overview');
    expect(
      fixture.nativeElement.querySelector('.insight-card').querySelectorAll('.overview-metrics dt')
        .length,
    ).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.card-indicator').length).toBe(3);
    click('Show Portfolio impact');
    expect(text()).toContain('Portfolio impact');
    click('Refresh');
    expect(text()).toContain('Market overview');
    expect(fixture.nativeElement.querySelector('.stock-list')).toBeNull();
    expect(text().toLowerCase()).not.toContain('simulat');
    expect(text()).not.toContain('Investing');
  });
  it('keeps only the current card accessible while inactive cards share layout sizing', () => {
    const { fixture, click } = setup();
    click('Daily Review');
    expect(fixture.nativeElement.querySelectorAll('.insight-card').length).toBe(3);
    expect(
      fixture.nativeElement.querySelectorAll('.insight-card.inactive[inert][aria-hidden="true"]')
        .length,
    ).toBe(2);
    click('Next insight');
    expect(
      fixture.nativeElement.querySelector('.insight-card:not(.inactive) h3').textContent,
    ).toContain('Portfolio impact');
  });
  it('shows all three daily examples with periods and explanatory limitations', () => {
    const { fixture, click, text } = setup();
    click('Daily Review');
    expect(text()).toContain('+1.8%');
    expect(text()).toContain('Today');
    click('Next insight');
    expect(text()).toContain('$385');
    click('Next insight');
    expect(text()).toContain('Up Next');
    expect(text()).toContain('Three key events');
    expect(fixture.nativeElement.querySelectorAll('.card-indicator').length).toBe(3);
    click('Explain these numbers');
    expect(text()).toContain("not today's actual market data");
    click('Back to results');
    expect(text()).toContain('Up Next');
    click('Refresh');
    expect(text()).toContain('+1.8%');
  });
  it('returns from explanations to the same stock snapshot without fetching or recalculating', () => {
    const { fixture, click, text } = setup();
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    click('This Stock');
    const original = text();
    const requests = market.candles.mock.calls.length;
    click('Explain these numbers');
    expect(text()).toContain('not figures for the selected stock');
    fixture.componentRef.setInput('quotes', [
      { symbol: 'AAPL', name: 'Apple', price: 999, change: 899, changePercent: 899 },
    ]);
    fixture.detectChanges();
    click('Back to results');
    expect(text()).toBe(original);
    expect(market.candles.mock.calls.length).toBe(requests);
    click('Explain these numbers');
    account.selectedAccountId.set(2);
    fixture.detectChanges();
    expect(text()).toContain('What would you like to review');
    expect(text()).not.toContain('not figures for the selected stock');
  });
  it('layers the launcher fin over the body and handles missing artwork with an accessible fallback', () => {
    const { fixture } = setup();
    const imgs = fixture.nativeElement.querySelectorAll(
      '.dua-launcher img',
    ) as NodeListOf<HTMLImageElement>;
    expect(imgs.length).toBe(2);
    imgs[0].dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.fallback').textContent).toBe('Dua');
  });
  it('opens chat and clears the numbered notification in one click', () => {
    const { fixture, click } = setup();
    const art = fixture.nativeElement.querySelector('.launcher-art') as HTMLElement;
    expect(art.classList.contains('face-visible')).toBe(false);
    fixture.componentRef.setInput('quotes', [
      { symbol: 'AAPL', name: 'Apple', price: 120, change: 20, changePercent: 20 },
    ]);
    fixture.detectChanges();
    expect(art.classList.contains('face-visible')).toBe(true);
    expect(fixture.nativeElement.querySelector('.notification-count').textContent.trim()).toBe('1');
    const hover = new Event('pointerenter');
    Object.defineProperty(hover, 'pointerType', { value: 'mouse' });
    fixture.nativeElement.querySelector('.dua-launcher').dispatchEvent(hover);
    fixture.detectChanges();
    expect(art.classList.contains('face-visible')).toBe(true);
    expect(fixture.nativeElement.querySelector('.notification-count')).not.toBeNull();
    expect(session.minimized()).toBe(true);
    click('Dua insights');
    expect(session.minimized()).toBe(false);
    expect(fixture.nativeElement.querySelector('.notification-count')).toBeNull();
    expect(art.classList.contains('face-visible')).toBe(true);
    click('Minimize Dua');
    fixture.componentRef.setInput('quotes', [
      { symbol: 'AAPL', name: 'Apple', price: 130, change: 30, changePercent: 30 },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notification-count')).toBeNull();
    account.selectedAccountId.set(2);
    fixture.detectChanges();
    fixture.componentRef.setInput('quotes', [
      { symbol: 'AAPL', name: 'Apple', price: 140, change: 40, changePercent: 40 },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notification-count')).toBeNull();
    fixture.destroy();
  });
  it('reveals the face on hover without opening chat, then restores the fin crop', () => {
    const { fixture } = setup();
    const launcher = fixture.nativeElement.querySelector('.dua-launcher');
    const event = new Event('pointerenter');
    Object.defineProperty(event, 'pointerType', { value: 'mouse' });
    launcher.dispatchEvent(event);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.launcher-art.face-visible')).not.toBeNull();
    expect(session.minimized()).toBe(true);
    launcher.dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.launcher-art.face-visible')).toBeNull();
    fixture.destroy();
  });
  it('reveals the face on keyboard focus and shows the selected view title with back navigation', () => {
    const { fixture, click } = setup();
    const launcher = fixture.nativeElement.querySelector('.dua-launcher') as HTMLButtonElement;
    vi.spyOn(launcher, 'matches').mockReturnValue(true);
    launcher.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.launcher-art.face-visible')).not.toBeNull();
    expect(session.minimized()).toBe(true);
    launcher.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.launcher-art.face-visible')).toBeNull();
    click('Dua insights');
    expect(fixture.nativeElement.querySelector('h2').textContent.replace(/\s+/g, ' ').trim()).toBe(
      'Dua Free Plan',
    );
    click('Daily Review');
    expect(fixture.nativeElement.querySelector('h2').textContent.replace(/\s+/g, ' ').trim()).toBe(
      'Daily Review',
    );
    click('Back to choices');
    expect(fixture.nativeElement.querySelector('h2').textContent.replace(/\s+/g, ' ').trim()).toBe(
      'Dua Free Plan',
    );
    fixture.destroy();
  });
  it('focuses the panel after it opens', () => {
    vi.useFakeTimers();
    const { fixture, click } = setup();
    click('Dua insights');
    const panel = fixture.nativeElement.querySelector('[role="dialog"], .dua-panel') as HTMLElement;
    const focus = vi.spyOn(panel, 'focus');
    vi.runOnlyPendingTimers();
    expect(focus).toHaveBeenCalled();
    fixture.destroy();
  });
  it('reports unavailable data instead of a snapshot when the market clock is updating', () => {
    const { fixture, click, text } = setup();
    clock.clockUpdating.set(true);
    fixture.detectChanges();
    click('Daily Review');
    expect(text()).toContain('Account or market data is unavailable. Please try again.');
    expect(fixture.nativeElement.querySelector('.insight-card')).toBeNull();
    fixture.destroy();
  });
  describe('panel resize animation', () => {
    const animation = {
      cancel: vi.fn(),
      onfinish: null as null | (() => void),
      oncancel: null as null | (() => void),
    };
    const animate = vi.fn((_keyframes: unknown, _options: unknown) => animation);
    let height = 300;
    let width = 400;
    beforeEach(() => {
      height = 300;
      width = 400;
      animation.cancel.mockClear();
      animation.onfinish = null;
      animation.oncancel = null;
      animate.mockClear();
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
        () => ({ height, width }) as DOMRect,
      );
      Object.defineProperty(HTMLElement.prototype, 'animate', {
        configurable: true,
        writable: true,
        value: animate,
      });
    });
    afterEach(() => {
      vi.restoreAllMocks();
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
    });
    it('animates from the previous height, restarts from the current height when interrupted', () => {
      const { fixture, click } = setup();
      click('Dua insights');
      expect(animate).not.toHaveBeenCalled();
      height = 420;
      click('Daily Review');
      expect(animate).toHaveBeenCalledTimes(1);
      expect(animate.mock.calls[0]).toEqual([
        [{ height: '300px' }, { height: '420px' }],
        expect.objectContaining({ duration: 380 }),
      ]);
      height = 520;
      // The first measurement is taken mid-animation, before the running animation is cancelled.
      vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValueOnce({
        height: 350,
        width,
      } as DOMRect);
      click('Next insight');
      expect(animation.cancel).toHaveBeenCalled();
      expect(animate).toHaveBeenCalledTimes(2);
      expect(animate.mock.calls[1][0]).toEqual([{ height: '350px' }, { height: '520px' }]);
      animation.onfinish?.();
      height = 540;
      click('Next insight');
      expect(animation.cancel).toHaveBeenCalledTimes(1);
      expect(animate).toHaveBeenCalledTimes(3);
      fixture.destroy();
    });
    it('hides scrollbars only while the panel is resizing', () => {
      const { fixture, click } = setup();
      const panel = fixture.nativeElement.querySelector('.dua-panel') as HTMLElement;
      click('Dua insights');
      expect(panel.classList).not.toContain('resizing');
      height = 420;
      click('Daily Review');
      expect(panel.classList).toContain('resizing');
      animation.onfinish?.();
      expect(panel.classList).not.toContain('resizing');
      fixture.destroy();
    });
    it('does not animate unchanged heights, width changes or reduced motion', () => {
      const { fixture, click } = setup();
      click('Dua insights');
      click('Daily Review');
      expect(animate).not.toHaveBeenCalled();
      width = 500;
      height = 450;
      click('Next insight');
      expect(animate).not.toHaveBeenCalled();
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      height = 600;
      click('Next insight');
      expect(animate).not.toHaveBeenCalled();
      fixture.destroy();
    });
  });
});
