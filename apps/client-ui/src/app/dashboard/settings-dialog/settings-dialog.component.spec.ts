import { ExecutionSettingsService } from './execution-settings.service';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SessionTimeoutService } from '../../core/auth/session-timeout.service';
import { SettingsDialogComponent } from './settings-dialog.component';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MarketClockService } from '../shared/market-clock.service';

describe('SettingsDialogComponent', () => {
  let setTimeoutMinutes: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    setTimeoutMinutes = vi.fn();
    await TestBed.configureTestingModule({
      imports: [SettingsDialogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), MarketClockService, { provide: ExecutionSettingsService, useValue: { load: () => of({ executionBufferPercent: 0 }), save: (executionBufferPercent: number) => of({ executionBufferPercent }) } },
        {
          provide: SessionTimeoutService,
          useValue: { timeoutMinutes: signal(15), setTimeoutMinutes },
        },
      ],
    }).compileComponents();
  });

  function render() {
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const select = element.querySelector('#idleTimeout') as HTMLSelectElement;
    return { element, select, closed };
  }

  it('moves the simulated market clock and reports the new snapshot', () => {
    const clock = TestBed.inject(MarketClockService);
    const snapshot = {
      sessionId: 7,
      status: 'CLOSED',
      marketTimestamp: '2026-01-05T22:00:00Z',
      serverTimestamp: '2026-01-05T22:00:00Z',
      calendar: {
        timezone: 'America/Chicago',
        firstTimestamp: '2026-01-05T14:30:00Z',
        lastTimestamp: '2026-01-06T05:59:59Z',
        tradingDates: ['2026-01-05'],
      },
      stocks: [],
    };
    clock.sync({ ...snapshot, status: 'OPEN', marketTimestamp: '2026-01-05T14:30:00Z' });
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    const applied = vi.fn();
    fixture.componentInstance.clockApplied.subscribe(applied);
    fixture.detectChanges();
    const section = fixture.nativeElement.querySelector('[data-testid="market-clock-settings"]') as HTMLElement;
    const input = section.querySelector('#market-date-time') as HTMLInputElement;
    expect(section.textContent).toContain('Market clock');
    expect(input.max).toBe('2026-01-05T23:59');

    input.value = '2026-01-05T16:00';
    (Array.from(section.querySelectorAll('button')).find((b) => b.textContent?.includes('Apply time')) as HTMLButtonElement).click();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/market/clock?sessionId=7');
    expect(request.request.body).toEqual({ timestamp: '2026-01-05T22:00:00.000Z' });
    request.flush(snapshot);

    expect(applied).toHaveBeenCalledWith(snapshot);
    expect(clock.marketOpen()).toBe(true);
    clock.sync(snapshot);
    expect(clock.marketOpen()).toBe(false);
  });

  it('is a labelled modal dialog', () => {
    const { element } = render();
    const dialog = element.querySelector('[role="dialog"]') as HTMLElement;

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(element.querySelector(`#${dialog.getAttribute('aria-labelledby')}`)?.textContent).toBe(
      'Settings',
    );
  });

  it('offers each inactivity limit and marks the default', () => {
    const { select } = render();

    expect([...select.options].map((option) => option.textContent?.trim())).toEqual([
      '5 minutes',
      '10 minutes (default)',
      '15 minutes',
      '30 minutes',
      '60 minutes',
    ]);
  });

  it('labels the inactivity limit control', () => {
    const { element } = render();
    const label = element.querySelector('label[for="idleTimeout"]') as HTMLElement;

    expect(label.textContent?.trim()).toBe('Sign out after inactivity');
  });

  it('shows the current limit', () => {
    const { select } = render();

    expect(select.value).toBe('15');
  });

  it('saves a newly chosen limit in minutes', () => {
    const { select } = render();

    select.value = '30';
    select.dispatchEvent(new Event('change'));

    expect(setTimeoutMinutes).toHaveBeenCalledWith(30);
  });

  it('closes from the close button', () => {
    const { element, closed } = render();

    (element.querySelector('[aria-label="Close settings"]') as HTMLButtonElement).click();

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const { closed } = render();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked, but not the dialog itself', () => {
    const { element, closed } = render();

    (element.querySelector('[role="dialog"]') as HTMLElement).click();
    expect(closed).not.toHaveBeenCalled();

    (element.querySelector('.settings-backdrop') as HTMLElement).click();
    expect(closed).toHaveBeenCalledTimes(1);
  });
  it('ignores a save request while one has just succeeded', () => {
    const fixture = TestBed.createComponent(SettingsDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['saved'].set(true);

    component['saveBuffer']();

    expect(component['saving']()).toBe(false);
  });

});
