import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronDown } from '@ng-icons/lucide';
import { DashboardHeaderDropdownComponent } from './dashboard-header-dropdown.component';

@Component({
  imports: [DashboardHeaderDropdownComponent],
  providers: [provideIcons({ lucideChevronDown })],
  template: `<app-dashboard-header-dropdown iconName="lucideChevronDown" label="Trading"
    ariaLabel="Select account" [open]="open()" (openChange)="open.set($event)">
    <button>Account</button>
  </app-dashboard-header-dropdown>`,
})
class DropdownHost {
  readonly open = signal(true);
}

describe('DashboardHeaderDropdownComponent keyboard interaction', () => {
  it('closes on Escape from the menu and returns focus to its trigger', () => {
    const fixture = TestBed.createComponent(DropdownHost);
    fixture.detectChanges();
    const details: HTMLDetailsElement = fixture.nativeElement.querySelector('details');
    const button: HTMLButtonElement = details.querySelector('button')!;
    button.focus();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    fixture.detectChanges();
    expect(details.open).toBe(false);
    expect(fixture.componentInstance.open()).toBe(false);
    expect(document.activeElement).toBe(details.querySelector('summary'));
    expect(event.defaultPrevented).toBe(true);
  });

  it('lets Escape propagate when the dropdown is already closed', () => {
    const fixture = TestBed.createComponent(DropdownHost);
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const listener = vi.fn();
    fixture.nativeElement.addEventListener('keydown', listener);
    fixture.nativeElement.querySelector('summary').dispatchEvent(event);
    expect(listener).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(false);
  });
});
