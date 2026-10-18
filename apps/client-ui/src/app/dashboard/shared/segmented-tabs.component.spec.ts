import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SegmentedTab, SegmentedTabsComponent } from './segmented-tabs.component';

@Component({
  imports: [SegmentedTabsComponent],
  template: `<app-segmented-tabs
    label="Views"
    testIdPrefix="view"
    [tabs]="tabs()"
    [(value)]="selected"
  />`,
})
class HostComponent {
  readonly tabs = signal<SegmentedTab<'a' | 'b' | 'c'>[]>([
    { id: 'a', label: 'Alpha', count: 3 },
    { id: 'b', label: 'Beta', count: null },
    { id: 'c', label: 'Gamma' },
  ]);
  readonly selected = signal<'a' | 'b' | 'c'>('a');
}

describe('SegmentedTabsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let root: HTMLElement;

  const tab = (id: string) => root.querySelector<HTMLElement>(`[data-testid="view-${id}"]`)!;
  const press = (key: string) => {
    root
      .querySelector('[role="tablist"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    root = fixture.nativeElement;
  });

  it('marks the selected tab and gives only that tab a tab stop', () => {
    expect(root.querySelector('[role="tablist"]')!.getAttribute('aria-label')).toBe('Views');
    expect(tab('a').getAttribute('aria-selected')).toBe('true');
    expect(tab('b').getAttribute('aria-selected')).toBe('false');
    expect(tab('a').tabIndex).toBe(0);
    expect(tab('b').tabIndex).toBe(-1);
  });

  it('selects the tab that is clicked and slides the thumb under it', () => {
    tab('b').click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selected()).toBe('b');
    expect(
      root.querySelector<HTMLElement>('[data-testid="segmented-tabs-thumb"]')!.style.transform,
    ).toBe('translateX(100%)');
  });

  it('shows a count only for a tab that has one', () => {
    expect(root.querySelector('[data-testid="view-count-a"]')!.textContent).toContain('3');
    expect(root.querySelector('[data-testid="view-count-b"]')).toBeNull();
    expect(root.querySelector('[data-testid="view-count-c"]')).toBeNull();
  });

  it('moves between tabs with the arrow keys, wrapping at the ends, and with Home and End', () => {
    press('ArrowLeft');
    expect(fixture.componentInstance.selected()).toBe('c');
    press('ArrowRight');
    expect(fixture.componentInstance.selected()).toBe('a');
    press('End');
    expect(fixture.componentInstance.selected()).toBe('c');
    press('Home');
    expect(fixture.componentInstance.selected()).toBe('a');
  });

  it('leaves other keys alone', () => {
    press('x');

    expect(fixture.componentInstance.selected()).toBe('a');
  });
});
