(() => {
  const { SideToggle, ShareSlider } = window.TradingSeasonDesignSystem_86c3eb;
  const { money, POSITIONS } = window.TSData;

  // Order ticket column from order-submission.component.html
  function OrderTicket({ instrument, cash = 4820.55, onSubmit, style }) {
    const [side, setSide] = React.useState('buy');
    const [shares, setShares] = React.useState(1);
    const held = (POSITIONS[instrument.symbol] || {}).shares || 0;
    const max = side === 'buy' ? Math.floor(cash / instrument.price) : held;
    const n = Math.min(shares, max);
    const value = n * instrument.price;
    const after = side === 'buy' ? cash - value : cash + value;
    const row = (k, v, strong) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, ...(strong ? { borderTop: '1px solid var(--border)', paddingTop: 8, fontWeight: 600 } : null) }}>
        <dt style={{ color: strong ? undefined : 'var(--muted-foreground)' }}>{k}</dt><dd style={{ margin: 0 }} className="tabular-nums">{v}</dd>
      </div>
    );
    const can = n > 0;
    return (
      <div style={{ display: 'flex', minWidth: 0, flexDirection: 'column', ...style }}>
        <SideToggle value={side} onChange={(s) => { setSide(s); setShares(1); }} />
        <div style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <label htmlFor="order-shares" style={{ color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 500, letterSpacing: '0.025em', textTransform: 'uppercase' }}>Shares</label>
            <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }} className="tabular-nums">{max === 0 ? (side === 'buy' ? 'Insufficient cash' : 'No shares held') : 'Max ' + max}</span>
          </div>
          <input id="order-shares" type="number" min="0" max={max} value={n} disabled={max === 0} onChange={(e) => setShares(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
            style={{ marginTop: 4, width: '100%', background: 'transparent', border: 0, outline: 'none', fontSize: 36, fontWeight: 600, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums', opacity: max === 0 ? 0.5 : 1 }} />
          <ShareSlider value={n} max={max} tone={side} onChange={setShares} style={{ marginTop: 12 }} />
        </div>
        <dl style={{ margin: '16px 0 0', display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 12, padding: 16, fontSize: 14, background: 'rgba(26,26,26,.6)' }}>
          {row('Market price', money(instrument.price))}
          {row('Shares', n)}
          {row('Cash before', money(cash))}
          {row('Cash after', money(after))}
          {row('Estimated ' + (side === 'buy' ? 'cost' : 'proceeds'), money(value), true)}
        </dl>
        <div style={{ minHeight: 16, flex: 1 }} />
        <button type="button" disabled={!can} onClick={() => onSubmit && onSubmit({ side, shares: n, symbol: instrument.symbol })}
          style={{ height: 44, width: '100%', border: 0, borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: can ? 'pointer' : 'not-allowed', opacity: can ? 1 : 0.4, transition: 'background 150ms',
            background: side === 'buy' ? 'var(--primary)' : 'var(--color-loss)', color: side === 'buy' ? 'var(--primary-foreground)' : '#fff' }}>
          {(side === 'buy' ? 'Buy' : 'Sell') + ' ' + n + ' ' + instrument.symbol}
        </button>
      </div>
    );
  }
  // Symbol tile from order-submission.component.html
  function InstrumentBadge({ symbol, size = 40 }) {
    return <div aria-hidden="true" style={{ width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'var(--primary-15)', color: 'var(--primary)', fontSize: 12, fontWeight: 600 }}>{symbol.slice(0, 4)}</div>;
  }
  Object.assign(window, { OrderTicket, InstrumentBadge });
})();
