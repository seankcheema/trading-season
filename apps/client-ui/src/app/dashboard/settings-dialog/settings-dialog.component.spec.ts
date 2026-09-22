import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SessionTimeoutService } from '../../core/auth/session-timeout.service';
import { SettingsDialogComponent } from './settings-dialog.component';

describe('SettingsDialogComponent', () => {
  let setTimeoutMinutes: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    setTimeoutMinutes = vi.fn();
    await TestBed.configureTestingModule({
      imports: [SettingsDialogComponent],
      providers: [
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
});
