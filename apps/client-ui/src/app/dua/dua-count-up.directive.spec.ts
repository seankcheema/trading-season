import { countUpText } from './dua-count-up.directive';

describe('countUpText', () => {
  it('starts at zero and ends at the value, keeping its format', () => {
    expect(countUpText('+$1,234.56', 0)).toBe('+$0.00');
    expect(countUpText('+$1,234.56', 1)).toBe('+$1,234.56');
    expect(countUpText('-2.4%', 0)).toBe('-0.0%');
    expect(countUpText('-2.4%', 1)).toBe('-2.4%');
    expect(countUpText('3 of 5', 1)).toBe('3 of 5');
  });

  it('eases toward the value and groups digits only when the value does', () => {
    expect(countUpText('1000', 0.5)).toBe('875');
    expect(countUpText('1,000', 0.5)).toBe('875');
    expect(countUpText('$20,000', 0.5)).toBe('$17,500');
  });

  it('has nothing to count without a non-zero number', () => {
    expect(countUpText('n/a', 0.5)).toBeNull();
    expect(countUpText('$0.00', 0.5)).toBeNull();
  });
});
