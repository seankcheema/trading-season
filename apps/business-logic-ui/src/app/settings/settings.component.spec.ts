import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionTimeoutService } from '../core/auth/session-timeout.service';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  let setTimeoutMinutes: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    setTimeoutMinutes = vi.fn();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideRouter([]),
        {
          provide: SessionTimeoutService,
          useValue: { timeoutMinutes: signal(15), setTimeoutMinutes },
        },
      ],
    }).compileComponents();
  });

  function render() {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('#idleTimeout') as HTMLSelectElement;
    return { fixture, select };
  }

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
    const { fixture } = render();
    const label = fixture.nativeElement.querySelector('label[for="idleTimeout"]') as HTMLElement;

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

  it('links back to the dashboard', () => {
    const { fixture } = render();
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe('/dashboard');
  });
});
