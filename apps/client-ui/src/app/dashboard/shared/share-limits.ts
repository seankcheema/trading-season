/** Whole-share limits for the cash or holdings currently available. */
export function wholeShares(value: number): number {
  return Number.isFinite(value)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value)))
    : 0;
}

export function affordableShares(cash: number, price: number): number {
  return Number.isFinite(cash) && Number.isFinite(price) && price > 0
    ? wholeShares(cash / price)
    : 0;
}

export function boundedShares(value: number, maximum: number): number {
  return Math.min(wholeShares(maximum), wholeShares(value));
}
