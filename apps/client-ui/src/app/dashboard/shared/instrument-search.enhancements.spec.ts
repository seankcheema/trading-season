import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Instrument } from '../mock-data';
import { InstrumentSearchComponent, SearchSuggestionGroup } from './instrument-search.component';

const INSTRUMENTS: readonly Instrument[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 316.59, change: 15.65, changePercent: 5.2 },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', price: 231.05, change: -2.88, changePercent: -1.26 },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    price: 512.3,
    change: 6.12,
    changePercent: 1.21,
  },
];

const GROUPS: SearchSuggestionGroup[] = [
  { label: 'Trending', icon: 'lucideFlame', items: [INSTRUMENTS[0], INSTRUMENTS[1]] },
  { label: 'Your watch list', icon: 'lucideStar', items: [] },
  { label: 'Recently viewed', icon: 'lucideHistory', items: [INSTRUMENTS[2]] },
];

describe('InstrumentSearchComponent enhancements', () => {
  let fixture: ComponentFixture<InstrumentSearchComponent>;
  let root: HTMLElement;
  let input: HTMLInputElement;
  let selected: Instrument[];

  function render(inputs: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(InstrumentSearchComponent);
    fixture.componentRef.setInput('instruments', INSTRUMENTS);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    selected = [];
    fixture.componentInstance.selected.subscribe((instrument) => selected.push(instrument));
    // Focus only works on elements that are attached to the document.
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    root = fixture.nativeElement;
    input = root.querySelector('input')!;
  }

  function focus(): void {
    input.focus();
    fixture.detectChanges();
  }

  function type(value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = input) {
    const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true, ...init });
    target.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  const options = () => [...root.querySelectorAll('li[role="option"]')] as HTMLLIElement[];
  const symbolsShown = () =>
    options().map((option) => option.querySelector('span span')!.textContent);
  const action = () =>
    root.querySelector('[data-testid="search-action"]') as HTMLButtonElement | null;
  const hint = () => root.querySelector('[data-testid="search-hint"]');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstrumentSearchComponent],
    }).compileComponents();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    document.querySelectorAll('[aria-modal="true"]').forEach((modal) => modal.remove());
  });

  describe('keyboard shortcut', () => {
    it('is off unless asked for', () => {
      render();
      expect(input.getAttribute('aria-keyshortcuts')).toBeNull();
      expect(hint()).toBeNull();
      press('k', { ctrlKey: true }, document.body);
      expect(document.activeElement).not.toBe(input);
    });

    it('announces the shortcuts and shows the Ctrl or Cmd K hint while idle', () => {
      render({ shortcut: true });
      expect(input.getAttribute('aria-keyshortcuts')).toBe('/ Control+K Meta+K');
      expect(hint()!.querySelectorAll('kbd')).toHaveLength(2);
      expect(hint()!.querySelectorAll('kbd')[1].textContent).toBe('K');
      expect(['Ctrl', '⌘']).toContain(hint()!.querySelector('kbd')!.textContent);
      expect(hint()!.getAttribute('aria-hidden')).toBe('true');
    });

    it('hides the hint while focused or holding a query', () => {
      render({ shortcut: true });
      focus();
      expect(hint()).toBeNull();
      type('a');
      input.blur();
      fixture.detectChanges();
      expect(hint()).toBeNull();
    });

    it.each([
      ['Ctrl+K', 'k', { ctrlKey: true }],
      ['Cmd+K', 'K', { metaKey: true }],
    ])('focuses the search with %s, even from another field', (_, key, init) => {
      render({ shortcut: true });
      const other = document.createElement('input');
      document.body.appendChild(other);
      other.focus();

      const event = press(key, init, other);

      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(input);
      other.remove();
    });

    it('focuses the search with a slash from the page', () => {
      render({ shortcut: true });
      const event = press('/', {}, document.body);
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(input);
    });

    it('leaves a slash typed into a field, or with a modifier, alone', () => {
      render({ shortcut: true });
      const other = document.createElement('textarea');
      document.body.appendChild(other);
      expect(press('/', {}, other).defaultPrevented).toBe(false);
      expect(press('/', { ctrlKey: true }, document.body).defaultPrevented).toBe(false);
      expect(press('/', { altKey: true }, document.body).defaultPrevented).toBe(false);
      expect(press('/', { metaKey: true }, document.body).defaultPrevented).toBe(false);
      expect(document.activeElement).not.toBe(input);
      other.remove();
    });

    it('ignores other keys', () => {
      render({ shortcut: true });
      expect(press('j', { ctrlKey: true }, document.body).defaultPrevented).toBe(false);
      expect(press('k', {}, document.body).defaultPrevented).toBe(false);
    });

    it('treats a slash with no element target as typed on the page', () => {
      render({ shortcut: true });
      expect(press('/', {}, document).defaultPrevented).toBe(true);
    });

    it('steps aside while a modal dialog is open', () => {
      render({ shortcut: true });
      const modal = document.createElement('div');
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);

      const event = press('k', { ctrlKey: true }, document.body);

      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).not.toBe(input);
    });

    it('leaves a slash typed into an editable region alone', () => {
      render({ shortcut: true });
      const editable = document.createElement('div');
      Object.defineProperty(editable, 'isContentEditable', { value: true });
      document.body.appendChild(editable);
      expect(press('/', {}, editable).defaultPrevented).toBe(false);
      editable.remove();
    });
  });

  describe('suggestions', () => {
    it('stay closed when none are given', () => {
      render();
      focus();
      expect(root.querySelector('[role="listbox"]')).toBeNull();
    });

    it('open on focus, grouped, hiding empty groups', () => {
      render({ suggestions: GROUPS });
      expect(root.querySelector('[role="listbox"]')).toBeNull();
      focus();

      expect(input.getAttribute('aria-expanded')).toBe('true');
      expect(root.querySelector('[data-testid="search-suggestions-Trending"]')).not.toBeNull();
      expect(root.querySelector('[data-testid="search-suggestions-Your watch list"]')).toBeNull();
      expect(
        root.querySelector('[data-testid="search-suggestions-Recently viewed"]'),
      ).not.toBeNull();
      expect(
        [...root.querySelectorAll('[role="group"]')].map((group) =>
          group.getAttribute('aria-label'),
        ),
      ).toEqual(['Trending', 'Recently viewed']);
      expect(symbolsShown()).toEqual(['AAPL', 'AMZN', 'MSFT']);
    });

    it('number options across groups so the active descendant is unique', () => {
      render({ suggestions: GROUPS });
      focus();
      const ids = options().map((option) => option.id);
      expect(new Set(ids).size).toBe(3);
      expect(input.getAttribute('aria-activedescendant')).toBe(ids[0]);
    });

    it('walk across groups with the arrow keys and wrap', () => {
      render({ suggestions: GROUPS });
      focus();
      press('ArrowDown');
      press('ArrowDown');
      expect(options()[2].getAttribute('aria-selected')).toBe('true');
      press('ArrowDown');
      expect(options()[0].getAttribute('aria-selected')).toBe('true');
      press('ArrowUp');
      expect(options()[2].getAttribute('aria-selected')).toBe('true');
    });

    it('select with Enter, then close instead of reopening', () => {
      render({ suggestions: GROUPS });
      focus();
      press('ArrowDown');
      press('ArrowDown');

      const enter = press('Enter');

      expect(enter.defaultPrevented).toBe(true);
      expect(selected.map((instrument) => instrument.symbol)).toEqual(['MSFT']);
      expect(document.activeElement).not.toBe(input);
      expect(root.querySelector('[role="listbox"]')).toBeNull();
    });

    it('select by pointer and follow the pointer with the highlight', () => {
      render({ suggestions: GROUPS });
      focus();
      options()[1].dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();
      expect(options()[1].getAttribute('aria-selected')).toBe('true');

      options()[1].click();

      expect(selected.map((instrument) => instrument.symbol)).toEqual(['AMZN']);
    });

    it('give way to search results once something is typed', () => {
      render({ suggestions: GROUPS });
      focus();
      type('msft');
      expect(root.querySelector('[role="group"]')).toBeNull();
      expect(symbolsShown()).toEqual(['MSFT']);

      type('zzzz');
      expect(root.textContent).toContain('No instruments match "zzzz"');

      type('');
      expect(root.querySelectorAll('[role="group"]')).toHaveLength(2);
    });

    it('start every focus on the first option', () => {
      render({ suggestions: GROUPS });
      focus();
      press('ArrowDown');
      input.blur();
      fixture.detectChanges();
      focus();
      expect(options()[0].getAttribute('aria-selected')).toBe('true');
    });

    it('do nothing on Enter or arrows when every group is empty', () => {
      render({ suggestions: [{ label: 'Trending', items: [] }] });
      focus();
      expect(root.querySelector('[role="listbox"]')).toBeNull();
      expect(press('Enter').defaultPrevented).toBe(false);
      expect(() => press('ArrowDown')).not.toThrow();
    });

    it('render a group without an icon', () => {
      render({ suggestions: [{ label: 'Plain', items: [INSTRUMENTS[0]] }] });
      focus();
      const heading = root.querySelector('[data-testid="search-suggestions-Plain"] div')!;
      expect(heading.querySelector('ng-icon')).toBeNull();
      expect(heading.textContent!.trim()).toBe('Plain');
    });

    it('show an icon beside a group label', () => {
      render({ suggestions: GROUPS });
      focus();
      expect(
        root.querySelector('[data-testid="search-suggestions-Trending"] div ng-icon'),
      ).not.toBeNull();
    });
  });

  describe('Escape', () => {
    it('blurs the input when there is nothing to clear', () => {
      render({ suggestions: GROUPS });
      focus();
      const reached = vi.fn();
      root.addEventListener('keydown', reached);

      press('Escape');

      expect(document.activeElement).not.toBe(input);
      expect(root.querySelector('[role="listbox"]')).toBeNull();
      expect(reached).toHaveBeenCalledOnce();
    });
  });

  describe('action button', () => {
    it('is absent by default', () => {
      render();
      expect(action()).toBeNull();
    });

    it('shows its label and does not steal focus when pressed', () => {
      render({ action: 'Trade' });
      expect(action()!.textContent!.trim()).toBe('Trade');
      expect(action()!.querySelector('ng-icon')).not.toBeNull();
      const mousedown = new MouseEvent('mousedown', { cancelable: true, bubbles: true });
      action()!.dispatchEvent(mousedown);
      expect(mousedown.defaultPrevented).toBe(true);
    });

    it('opens the best match for what was typed', () => {
      render({ action: 'Trade' });
      focus();
      type('a');
      const best = fixture.componentInstance['results']()[0];

      action()!.click();
      fixture.detectChanges();

      expect(selected.map((instrument) => instrument.symbol)).toEqual([best.symbol]);
      expect(input.value).toBe('');
    });

    it('focuses the search when nothing was typed', () => {
      render({ action: 'Trade' });
      action()!.click();
      fixture.detectChanges();
      expect(document.activeElement).toBe(input);
      expect(selected).toEqual([]);
    });

    it('focuses the search when what was typed matches nothing', () => {
      render({ action: 'Trade' });
      type('zzzz');
      action()!.click();
      expect(selected).toEqual([]);
      expect(document.activeElement).toBe(input);
    });

    it('lights the search icon and ring while focused', () => {
      render({ action: 'Trade' });
      const icon = root.querySelector('ng-icon')!;
      expect(icon.className).toContain('text-muted-foreground');
      expect(input.className).toContain('focus-visible:ring-3');
      focus();
      expect(icon.className).toContain('text-primary');
    });

    it('does not add a ring without an action', () => {
      render();
      expect(input.className).not.toContain('focus-visible:ring-3');
    });

    it('makes room on the right for the button and the hint', () => {
      render();
      expect(input.className).toContain('pr-4');
      fixture.componentRef.setInput('shortcut', true);
      fixture.detectChanges();
      expect(input.className).toContain('pr-20');
      fixture.componentRef.setInput('action', 'Trade');
      fixture.detectChanges();
      expect(input.className).toContain('pr-40');
      focus();
      expect(input.className).toContain('pr-24');
    });

    it('sizes the button for the large and standard search', () => {
      render({ action: 'Trade', size: 'lg' });
      expect(action()!.className).toContain('h-9');
      fixture.componentRef.setInput('size', 'md');
      fixture.detectChanges();
      expect(action()!.className).toContain('h-[34px]');
    });
  });

  describe('embedded', () => {
    it('keeps the flat style with suggestions', () => {
      render({ embedded: true, suggestions: GROUPS });
      focus();
      expect(input.className).toContain('rounded-none');
      expect(root.querySelector('[role="listbox"]')!.className).toContain('max-h-64');
    });
  });
});
