import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CancelOrderButtonComponent } from './cancel-order-button.component';

describe('CancelOrderButtonComponent', () => {
  it('keeps the menu open for inside interactions and closes it on outside interactions', () => {
    const fixture = TestBed.createComponent(CancelOrderButtonComponent);
    fixture.componentRef.setInput('orderLabel', 'AAPL');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const menu = root.querySelector('details')!;
    menu.open = true;
    root.querySelector('[role="menu"]')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(menu.open).toBe(true);
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(menu.open).toBe(false);

    menu.open = true;
    document.body.click();
    expect(menu.open).toBe(false);
  });

  it('closes the previous menu when another order menu is clicked', () => {
    const first = TestBed.createComponent(CancelOrderButtonComponent);
    const second = TestBed.createComponent(CancelOrderButtonComponent);
    for (const fixture of [first, second]) {
      fixture.componentRef.setInput('orderLabel', 'AAPL');
      fixture.detectChanges();
    }
    const firstMenu = first.nativeElement.querySelector('details') as HTMLDetailsElement;
    firstMenu.open = true;
    second.nativeElement.querySelector('summary').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(firstMenu.open).toBe(false);
  });

  it('requests confirmation and only cancels after the user confirms', () => {
    const fixture = TestBed.createComponent(CancelOrderButtonComponent);
    fixture.componentRef.setInput('orderLabel', 'AAPL');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const dialog = root.querySelector('dialog')!;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    const cancelled = vi.fn();
    fixture.componentInstance.confirmed.subscribe(cancelled);
    root.querySelector('summary')!.click();
    const cancel = [...root.querySelectorAll<HTMLButtonElement>('[role=menuitem]')].find((item) => item.textContent?.trim() === 'Cancel order')!;
    cancel.click();
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(cancelled).not.toHaveBeenCalled();
    const buttons = dialog.querySelectorAll('button');
    buttons[0].click();
    expect(cancelled).not.toHaveBeenCalled();
    buttons[1].click();
    expect(cancelled).toHaveBeenCalledOnce();
  });
  it('offers editing without submitting cancellation', () => {
    const fixture = TestBed.createComponent(CancelOrderButtonComponent);
    fixture.componentRef.setInput('orderLabel', 'AAPL'); fixture.detectChanges();
    const edited = vi.fn(); const cancelled = vi.fn();
    fixture.componentInstance.edited.subscribe(edited);
    fixture.componentInstance.confirmed.subscribe(cancelled);
    fixture.nativeElement.querySelector('[role=menuitem]').click();
    expect(edited).toHaveBeenCalledOnce();
    expect(cancelled).not.toHaveBeenCalled();
  });

});
