import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from '../core/auth/token-storage.service';
import { DuaSession } from './dua-session.service';
import { NavigationEnd, NavigationStart, Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

describe('Dua session', () => {
  it('resets information baselines and closes the chat on identity changes', () => {
    let reset = () => {};
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: TokenStorageService,
          useValue: {
            onIdentityChange: (listener: () => void) => {
              reset = listener;
            },
          },
        },
      ],
    });
    const session = TestBed.inject(DuaSession);
    expect(session.minimized()).toBe(true);
    expect(session.hasNewInformation('account', 'first', false)).toBe(false);
    expect(session.hasNewInformation('account', 'second', false)).toBe(true);
    expect(session.hasNewInformation('account', 'second', true)).toBe(false);
    expect(session.hasNewInformation('account', 'second', false)).toBe(false);
    session.minimized.set(false);
    reset();
    expect(session.minimized()).toBe(true);
    expect(session.hasNewInformation('account', 'new identity', false)).toBe(false);
    session.acknowledgeNotification();
    expect(session.hasNewInformation('account', 'another change', false)).toBe(false);
    expect(session.hasNewInformation('different stock', 'first', false)).toBe(false);
    expect(session.hasNewInformation('different stock', 'second', false)).toBe(false);
    // A new page gets a fresh root injector, with notifications available again.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: TokenStorageService, useValue: { onIdentityChange: () => {} } },
      ],
    });
    const refreshed = TestBed.inject(DuaSession);
    expect(refreshed.hasNewInformation('account', 'first', false)).toBe(false);
    expect(refreshed.hasNewInformation('account', 'second', false)).toBe(true);
  });
  it('closes on navigation without resetting the notification acknowledgement', () => {
    const events = new Subject<NavigationStart>();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { events } },
        { provide: TokenStorageService, useValue: { onIdentityChange: () => {} } },
      ],
    });
    const session = TestBed.inject(DuaSession);
    session.minimized.set(false);
    events.next(new NavigationEnd(0, '/dashboard', '/dashboard') as unknown as NavigationStart);
    expect(session.minimized()).toBe(false);
    session.acknowledgeNotification();
    events.next(new NavigationStart(1, '/dashboard/markets/aapl'));
    expect(session.minimized()).toBe(true);
    expect(session.hasNewInformation('stock', 'changed', false)).toBe(false);
    session.minimized.set(false);
    events.next(new NavigationStart(2, '/dashboard'));
    expect(session.minimized()).toBe(true);
  });
});
