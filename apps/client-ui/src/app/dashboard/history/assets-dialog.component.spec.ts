import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Instrument } from '../mock-data';
import { PricedHolding } from '../shared/assets';
import { AssetsDialogComponent } from './assets-dialog.component';

function holding(
  symbol: string,
  shares: number,
  costBasis: number,
  price: number,
  changePercent = 1,
): PricedHolding {
  const instrument: Instrument = {
    symbol,
    name: `${symbol} Corp`,
    price,
    change: changePercent,
    changePercent,
  };
  const value = shares * price;
  return { symbol, shares, costBasis, instrument, value, gainLoss: value - shares * costBasis };
}

const HOLDINGS = [
  holding('AAPL', 2, 100, 150, 2),
  holding('MSFT', 1, 300, 250, -1),
  holding('NVDA', 4, 50, 50, 0),
];

describe('AssetsDialogComponent', () => {
  let fixture: ComponentFixture<AssetsDialogComponent>;
  let root: HTMLElement;
  let closed: number;
  let selected: Instrument[];

  function render(holdings: readonly PricedHolding[] = HOLDINGS): void {
    fixture = TestBed.createComponent(AssetsDialogComponent);
    fixture.componentRef.setInput('holdings', holdings);
    closed = 0;
    selected = [];
    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.componentInstance.selected.subscribe((instrument) => selected.push(instrument));
    fixture.detectChanges();
    root = fixture.nativeElement;
  }

  const symbols = () =>
    [...root.querySelectorAll('[data-testid^="assets-dialog-row-"]')].map((row) =>
      row.getAttribute('data-testid')!.replace('assets-dialog-row-', ''),
    );
  const tile = (id: string) =>
    root.querySelector(`[data-testid="assets-summary-${id}"]`)!.textContent!.trim();
  const sortHeader = (label: string) =>
    root.querySelector(`button[aria-label="Sort by ${label}"]`) as HTMLButtonElement;
  const click = (element: Element | null) => {
    (element as HTMLElement).click();
    fixture.detectChanges();
  };
  const type = (value: string) => {
    const input = root.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AssetsDialogComponent] }).compileComponents();
  });

  it('is a dialog titled Assets with a close button', () => {
    render();
    const dialog = root.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(root.querySelector('h2')!.textContent).toContain('Assets');
    expect(dialog.className).toContain('max-w-[70rem]');

    click(root.querySelector('button[aria-label="Close assets"]'));
    expect(closed).toBe(1);
  });

  it('totals the whole portfolio in the summary tiles', () => {
    render();
    expect(tile('market-value')).toBe('$750.00');
    expect(tile('cost-basis')).toBe('$700.00');
    expect(tile('unrealized')).toBe('+$50.00');
    expect(root.querySelector('[data-testid="assets-summary-unrealized"]')!.className).toContain(
      'text-gain',
    );
    expect(tile('positions')).toBe('3');
  });

  it('colors a negative unrealized total as a loss without a plus sign', () => {
    render([holding('MSFT', 1, 300, 250, -1)]);
    expect(tile('unrealized')).toBe('-$50.00');
    expect(root.querySelector('[data-testid="assets-summary-unrealized"]')!.className).toContain(
      'text-loss',
    );
  });

  it('lists positions largest first with their weight', () => {
    render();
    expect(symbols()).toEqual(['AAPL', 'MSFT', 'NVDA']);
    const weights = [...root.querySelectorAll('[data-testid="assets-weight"]')].map((cell) =>
      cell.textContent!.trim(),
    );
    expect(weights).toEqual(['40.0%', '33.3%', '26.7%']);
    expect(root.querySelector('[data-testid="assets-count"]')!.textContent!.trim()).toBe(
      '3 assets',
    );
  });

  it('shows each column of a position, colored by direction', () => {
    render();
    const row = root.querySelector('[data-testid="assets-dialog-row-MSFT"]')!;
    const cells = [...row.children].map((cell) => cell.textContent!.replace(/\s+/g, ' ').trim());
    expect(row.children[0].children[0].textContent).toBe('MSFT');
    expect(row.children[0].children[1].textContent).toBe('MSFT Corp');
    expect(cells.slice(2)).toEqual([
      '1',
      '$300.00',
      '$250.00',
      '-1.00%',
      '$250.00',
      '-$50.00',
      '-16.67%',
      '33.3%',
    ]);
    expect(row.children[5].className).toContain('text-loss');
    expect(row.children[7].className).toContain('text-loss');
    expect(row.querySelector('app-daily-sparkline')).not.toBeNull();

    const apple = root.querySelector('[data-testid="assets-dialog-row-AAPL"]')!;
    expect(apple.children[5].className).toContain('text-gain');
    expect(apple.children[7].textContent).toContain('+$100.00');
  });

  it('sorts by a column, descending first and then flipping', () => {
    render();
    click(sortHeader('Return'));
    expect(symbols()).toEqual(['AAPL', 'NVDA', 'MSFT']);
    expect(sortHeader('Return').getAttribute('data-sort')).toBe('desc');

    click(sortHeader('Return'));
    expect(symbols()).toEqual(['MSFT', 'NVDA', 'AAPL']);
    expect(sortHeader('Return').getAttribute('data-sort')).toBe('asc');

    click(sortHeader('Asset'));
    expect(symbols()).toEqual(['NVDA', 'MSFT', 'AAPL']);
    expect(sortHeader('Return').getAttribute('data-sort')).toBeNull();
  });

  it('offers a sort for every column but the sparkline', () => {
    render();
    const labels = [...root.querySelectorAll('button[app-sort-header]')].map((button) =>
      button.getAttribute('aria-label'),
    );
    expect(labels).toEqual([
      'Sort by Asset',
      'Sort by Shares',
      'Sort by Avg Price',
      'Sort by Price',
      'Sort by Change %',
      'Sort by Value',
      'Sort by Value $',
      'Sort by Return',
      'Sort by Weight',
    ]);
    expect(root.querySelector('.dash-table-head')!.textContent).toContain('Today');
  });

  it('filters to gainers or losers and back', () => {
    render();
    click(root.querySelector('[data-testid="assets-filter-gainers"]'));
    expect(symbols()).toEqual(['AAPL']);
    expect(
      root.querySelector('[data-testid="assets-filter-gainers"]')!.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(root.querySelector('[data-testid="assets-count"]')!.textContent!.trim()).toBe('1 asset');

    click(root.querySelector('[data-testid="assets-filter-losers"]'));
    expect(symbols()).toEqual(['MSFT']);

    click(root.querySelector('[data-testid="assets-filter-all"]'));
    expect(symbols()).toHaveLength(3);
  });

  it('filters by symbol or company name and keeps the totals', () => {
    render();
    type('nvidia');
    expect(symbols()).toEqual([]);
    type('nvda corp');
    expect(symbols()).toEqual(['NVDA']);
    type('MS');
    expect(symbols()).toEqual(['MSFT']);
    expect(tile('market-value')).toBe('$750.00');
    expect(tile('positions')).toBe('3');
  });

  it('says when filters hide everything', () => {
    render();
    type('zzz');
    expect(root.textContent).toContain('No assets match these filters.');
    expect(root.querySelector('[data-testid="assets-count"]')!.textContent!.trim()).toBe(
      '0 assets',
    );
  });

  it('says when the account has no holdings', () => {
    render([]);
    expect(root.textContent).toContain('This account has no holdings yet.');
    expect(tile('market-value')).toBe('$0.00');
    expect(tile('positions')).toBe('0');
  });

  it('opens the order ticket for the chosen row', () => {
    render();
    click(root.querySelector('[data-testid="assets-dialog-row-NVDA"]'));
    expect(selected.map((instrument) => instrument.symbol)).toEqual(['NVDA']);
  });

  it('follows price changes while open', () => {
    render();
    fixture.componentRef.setInput('holdings', [holding('AAPL', 2, 100, 200, 2)]);
    fixture.detectChanges();
    expect(tile('market-value')).toBe('$400.00');
    expect(symbols()).toEqual(['AAPL']);
  });

  it('draws a sparkline from the charts it is given', () => {
    render();
    fixture.componentRef.setInput('charts', {
      AAPL: [
        { time: new Date('2026-01-05T15:00:00Z'), value: 100 },
        { time: new Date('2026-01-05T15:01:00Z'), value: 110 },
      ],
    });
    fixture.detectChanges();
    const apple = root.querySelector('[data-testid="assets-dialog-row-AAPL"]')!;
    expect(apple.querySelector('[data-testid="sparkline-path"]')).not.toBeNull();
    const msft = root.querySelector('[data-testid="assets-dialog-row-MSFT"]')!;
    expect(msft.querySelector('[data-testid="sparkline-path"]')).toBeNull();
  });
});
