import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MenuKeyboardDirective } from './menu-keyboard.directive';

@Component({
  imports: [MenuKeyboardDirective],
  template: `
    <details id="menu">
      <summary>Profile</summary>
      <div role="menu" aria-label="Profile">
        <button type="button" role="menuitem">Settings</button>
        <button type="button" role="menuitem" disabled>Unavailable</button>
        <button type="button" role="menuitem">Take the tour</button>
        <button type="button" role="menuitem">Log out</button>
      </div>
    </details>
  `,
})
class MenuHostComponent {}

describe('MenuKeyboardDirective', () => {
  function render() {
    const fixture = TestBed.createComponent(MenuHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const details = root.querySelector<HTMLDetailsElement>('details')!;
    details.open = true;
    const items = [...root.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    const press = (key: string) =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
    return { root, items, press };
  }

  it('moves between enabled items with the arrow keys, wrapping at the ends', () => {
    const { items, press } = render();
    items[0].focus();

    press('ArrowDown');
    expect(document.activeElement).toBe(items[2]);
    press('ArrowDown');
    expect(document.activeElement).toBe(items[3]);
    press('ArrowDown');
    expect(document.activeElement).toBe(items[0]);
    press('ArrowUp');
    expect(document.activeElement).toBe(items[3]);
  });

  it('jumps to the first and last items with Home and End', () => {
    const { items, press } = render();
    items[2].focus();

    press('End');
    expect(document.activeElement).toBe(items[3]);
    press('Home');
    expect(document.activeElement).toBe(items[0]);
  });

  it('leaves other keys alone', () => {
    const { items } = render();
    items[0].focus();
    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    items[0].dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(items[0]);
  });
});
