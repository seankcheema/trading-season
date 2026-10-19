import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from '../core/auth/token-storage.service';
import { DuaSession } from './dua-session.service';

describe('Dua session', () => {
  it('resets information baselines and closes the chat on identity changes', () => {
    let reset = () => {};
    TestBed.configureTestingModule({
      providers: [
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
      providers: [{ provide: TokenStorageService, useValue: { onIdentityChange: () => {} } }],
    });
    const refreshed = TestBed.inject(DuaSession);
    expect(refreshed.hasNewInformation('account', 'first', false)).toBe(false);
    expect(refreshed.hasNewInformation('account', 'second', false)).toBe(true);
  });
});
