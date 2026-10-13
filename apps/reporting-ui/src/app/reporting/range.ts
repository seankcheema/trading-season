import { ActivityRange } from './console.models';

// A range a screen can cover, as its toggle offers it.
export interface RangeOption {
  value: ActivityRange;
  label: string;
  // What the range is called away from the toggle, where its label alone would not say.
  name?: string;
}

// The ranges Activity and Report runs cover, shortest first.
export const RANGES: RangeOption[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'All', name: 'All time' },
];

// The range a browser with nothing remembered opens on.
export const DEFAULT_RANGE: ActivityRange = '7d';

// What a range is called in a sentence or a column heading.
export function rangeName(range: ActivityRange): string {
  const option = RANGES.find((candidate) => candidate.value === range)!;
  return option.name ?? option.label;
}

// The range this browser last chose under key. Storage can throw in private windows
// or with blocked site data; the screen then opens on the default.
export function readRange(key: string): ActivityRange {
  try {
    const saved = localStorage.getItem(key);
    return RANGES.find((option) => option.value === saved)?.value ?? DEFAULT_RANGE;
  } catch {
    return DEFAULT_RANGE;
  }
}

// Remembers the choice under key. When storage refuses, the choice still holds
// until the screen is left.
export function rememberRange(key: string, range: ActivityRange): void {
  try {
    localStorage.setItem(key, range);
  } catch {
    // Nothing to do: the screen keeps the range it was given.
  }
}
