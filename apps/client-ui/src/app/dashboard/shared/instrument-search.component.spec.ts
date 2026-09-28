import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Instrument } from '../mock-data';
import { InstrumentSearchComponent } from './instrument-search.component';

const INSTRUMENTS: readonly Instrument[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 316.59, change: 15.65, changePercent: 5.2 },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', price: 231.05, change: -2.88, changePercent: -1.26 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: 512.3, change: 6.12, changePercent: 1.21 },
];

describe('InstrumentSearchComponent', () => {
  let fixture: ComponentFixture<InstrumentSearchComponent>;
  let input: HTMLInputElement;
  let selected: Instrument[];

  function type(value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function press(key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
    input.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  function options(): HTMLLIElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('li[role="option"]'));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [InstrumentSearchComponent] }).compileComponents();
    fixture = TestBed.createComponent(InstrumentSearchComponent);
    fixture.componentRef.setInput('instruments', INSTRUMENTS);
    selected = [];
    fixture.componentInstance.selected.subscribe((instrument) => selected.push(instrument));
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input');
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
  });

  it('should label the combobox and stay closed until a query is typed', () => {
    const label: HTMLLabelElement = fixture.nativeElement.querySelector('label');
    expect(label.htmlFor).toBe(input.id);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();
  });

  it('should list matching instruments with the first one active', () => {
    type('a');

    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(options().length).toBeGreaterThan(0);
    expect(options()[0].getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[0].id);
  });

  it('should say when nothing matches', () => {
    type('zzzz');

    expect(options()).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('No instruments match "zzzz"');
  });

  it('should close when the input loses focus', () => {
    type('a');
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();
  });

  it('should move the active option with the arrow keys and wrap at both ends', () => {
    type('a');
    const count = options().length;

    const down = press('ArrowDown');
    expect(down.defaultPrevented).toBe(true);
    expect(options()[1 % count].getAttribute('aria-selected')).toBe('true');

    press('ArrowUp');
    const up = press('ArrowUp');
    expect(up.defaultPrevented).toBe(true);
    expect(options()[count - 1].getAttribute('aria-selected')).toBe('true');
  });

  it('should ignore arrow keys when there are no results', () => {
    type('zzzz');

    expect(() => press('ArrowDown')).not.toThrow();
    expect(() => press('ArrowUp')).not.toThrow();
  });

  it('should select the active option on Enter and clear the query', () => {
    type('msft');

    const enter = press('Enter');

    expect(enter.defaultPrevented).toBe(true);
    expect(selected.map((i) => i.symbol)).toEqual(['MSFT']);
    expect(input.value).toBe('');
  });

  it('should not select on Enter while the list is closed', () => {
    const enter = press('Enter');

    expect(enter.defaultPrevented).toBe(false);
    expect(selected).toEqual([]);
  });

  it('should clear the query on Escape without letting it reach an enclosing dialog', () => {
    type('a');
    const reached = vi.fn();
    fixture.nativeElement.parentElement?.addEventListener('keydown', reached);

    press('Escape');

    expect(input.value).toBe('');
    expect(reached).not.toHaveBeenCalled();
  });

  it('should let Escape through when there is nothing to clear', () => {
    const reached = vi.fn();
    fixture.nativeElement.addEventListener('keydown', reached);

    press('Escape');

    expect(reached).toHaveBeenCalledOnce();
  });

  it('should select an option by pointer, keeping focus in the input', () => {
    type('a');
    const [first, second] = options();

    const mousedown = new MouseEvent('mousedown', { cancelable: true });
    second.dispatchEvent(mousedown);
    second.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(mousedown.defaultPrevented).toBe(true);
    expect(options()[1].getAttribute('aria-selected')).toBe('true');
    expect(first.getAttribute('aria-selected')).toBe('false');

    options()[1].click();
    expect(selected).toHaveLength(1);
  });

  it('should fall back to the built-in instrument list when none is provided', () => {
    fixture.componentRef.setInput('instruments', []);
    type('nvda');

    expect(options().map((li) => li.textContent)).toEqual([expect.stringContaining('NVDA')]);
  });

  it('should use the larger input style when size is lg', () => {
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();

    expect(input.className).toContain('text-2xl');
  });
});
