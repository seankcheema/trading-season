import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DashboardDialogComponent } from './dashboard-dialog.component';

@Component({
  imports: [DashboardDialogComponent],
  template: `
    <app-dashboard-dialog
      dialogTitle="Example"
      closeLabel="Close example"
      [dismissible]="dismissible()"
      (closed)="closed()"
    >
      <p>Body</p>
    </app-dashboard-dialog>
  `,
})
class HostComponent {
  readonly dismissible = signal(true);
  readonly closed = vi.fn();
}

@Component({
  imports: [DashboardDialogComponent],
  template: `
    <button type="button" id="opener" (click)="open.set(true)">Open</button>
    <details id="menu">
      <summary>Menu</summary>
      <button type="button" id="menu-item" (click)="open.set(true)">From the menu</button>
    </details>
    @if (open()) {
      <app-dashboard-dialog dialogTitle="Example" (closed)="open.set(false)">
        <button type="button">Inside</button>
      </app-dashboard-dialog>
    }
  `,
})
class FocusHostComponent {
  readonly open = signal(false);
}

describe('DashboardDialogComponent focus', () => {
  async function openFrom(id: string) {
    const fixture = TestBed.createComponent(FocusHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const opener = root.querySelector<HTMLButtonElement>(`#${id}`)!;
    opener.focus();
    opener.click();
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, root, opener };
  }

  it('takes focus, and hands it back to the control that opened it on close', async () => {
    const { fixture, root, opener } = await openFrom('opener');
    const dialog = root.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(document.activeElement).toBe(dialog);
    // The CDK focus trap's sentinels wrap Tab around inside the dialog.
    expect(dialog.parentElement!.querySelectorAll('.cdk-focus-trap-anchor').length).toBe(2);

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(document.activeElement).toBe(opener);
  });

  it('hands focus to the menu button when the item that opened it has been hidden', async () => {
    const { fixture, root } = await openFrom('menu-item');
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(document.activeElement).toBe(root.querySelector('#menu summary'));
  });
});

describe('DashboardDialogComponent', () => {
  function render(dismissible = true) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.dismissible.set(dismissible);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const closeButton = () =>
      element.querySelector<HTMLButtonElement>('button[aria-label="Close example"]');
    const backdrop = element.querySelector<HTMLElement>('.dashboard-dialog-backdrop')!;
    const dialog = element.querySelector<HTMLElement>('[role="dialog"]')!;
    const pressEscape = () =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    return { closed: fixture.componentInstance.closed, closeButton, backdrop, dialog, pressEscape };
  }

  it('labels the dialog with its title and shows the projected content', () => {
    const { dialog } = render();

    const title = document.getElementById(dialog.getAttribute('aria-labelledby')!);
    expect(title?.textContent).toBe('Example');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('Body');
  });

  describe('by default', () => {
    it('closes from the close button', () => {
      const { closed, closeButton } = render();

      closeButton()!.click();

      expect(closed).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape', () => {
      const { closed, pressEscape } = render();

      pressEscape();

      expect(closed).toHaveBeenCalledTimes(1);
    });

    it('closes on a click on the backdrop, but not on a click inside the dialog', () => {
      const { closed, backdrop, dialog } = render();

      dialog.click();
      expect(closed).not.toHaveBeenCalled();

      backdrop.click();
      expect(closed).toHaveBeenCalledTimes(1);
    });
  });

  describe('when it is not dismissible', () => {
    it('has no close button', () => {
      const { closeButton } = render(false);

      expect(closeButton()).toBeNull();
    });

    it('stays open on Escape and on a click on the backdrop', () => {
      const { closed, backdrop, pressEscape } = render(false);

      pressEscape();
      backdrop.click();

      expect(closed).not.toHaveBeenCalled();
    });
  });
});
