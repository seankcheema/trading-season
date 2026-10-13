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
