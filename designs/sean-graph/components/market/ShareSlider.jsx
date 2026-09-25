import React from 'react';

let injected = false;
function inject() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.textContent = '.ts-slider{--fill:0%;--slider-color:var(--primary);appearance:none;-webkit-appearance:none;width:100%;height:16px;background:transparent;cursor:pointer;margin:0}' +
    '.ts-slider:disabled{cursor:not-allowed;opacity:.5}' +
    '.ts-slider::-webkit-slider-runnable-track{height:4px;border-radius:9999px;background:linear-gradient(to right,var(--slider-color) var(--fill),var(--muted) var(--fill))}' +
    '.ts-slider::-moz-range-track{height:4px;border-radius:9999px;background:var(--muted)}.ts-slider::-moz-range-progress{height:4px;border-radius:9999px;background:var(--slider-color)}' +
    '.ts-slider::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-6px;border:3px solid var(--card);border-radius:9999px;background:var(--slider-color);box-shadow:0 0 0 1px var(--slider-color)}' +
    '.ts-slider::-moz-range-thumb{width:10px;height:10px;border:3px solid var(--card);border-radius:9999px;background:var(--slider-color);box-shadow:0 0 0 1px var(--slider-color)}';
  document.head.appendChild(s);
}

// Order-ticket share slider; fill is the chosen share of max.
export function ShareSlider({ value = 0, max = 0, onChange, tone = 'buy', disabled, style }) {
  inject();
  const fill = max ? (value / max) * 100 : 0;
  return (
    <input type="range" aria-label="Shares" className="ts-slider" min="0" max={max} step="1" value={value} disabled={disabled || max === 0}
      onChange={(e) => onChange && onChange(Number(e.target.value))}
      style={{ '--fill': fill + '%', '--slider-color': tone === 'sell' ? 'var(--color-loss)' : 'var(--primary)', ...style }} />
  );
}
