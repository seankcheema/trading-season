(() => {
  // Flat (non-bento) dashboard: no card containers. A main column of stacked, hairline-separated sections
  // and a full-height right rail for Recent Transactions.
  const { DashLabel, DashLink, InstrumentSearch, ChangePill, TimeframeToggle, PriceChart, Sparkline, Button } = window.TradingSeasonDesignSystem_86c3eb;
  const { INSTRUMENTS, TRANSACTIONS, POSITIONS, series, LABELS, COUNTS, money, pct, find } = window.TSData;

  const head = { borderBottom: '1px solid var(--border)', paddingBottom: 8, color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' };
  const COLS = 'minmax(0,1fr) minmax(0,.8fr) minmax(0,.6fr) minmax(0,.9fr) minmax(0,.9fr) minmax(0,.85fr) minmax(0,.75fr) minmax(0,1fr) minmax(0,1fr)';
  const gl = (v) => ({ color: v >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' });
  const rule = '1px solid var(--border)';
  const cell = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' };

  function Row({ children, onClick, label, cols }) {
    const [h, setH] = React.useState(false);
    return <button type="button" aria-label={label} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: 'grid', width: '100%', gridTemplateColumns: cols, alignItems: 'center', gap: 10, padding: '10px 8px', border: 0, borderBottom: '1px solid var(--border-60)', cursor: 'pointer', textAlign: 'left', color: 'inherit', fontSize: 14, whiteSpace: 'nowrap', background: h ? 'rgba(26,26,26,.7)' : 'transparent', transition: 'background 150ms' }}>{children}</button>;
  }

  function LineTabs({ value, onChange, options }) {
    const [hov, setHov] = React.useState(null);
    return (
      <div role="tablist" aria-label="Assets and watch list" style={{ display: 'flex', gap: 24 }}>
        {options.map(([k, label]) => {
          const on = value === k;
          return <button key={k} type="button" role="tab" aria-selected={on} onClick={() => onChange(k)} onMouseEnter={() => setHov(k)} onMouseLeave={() => setHov(null)}
            style={{ height: 40, padding: 0, border: 0, borderBottom: '2px solid ' + (on ? 'var(--primary)' : 'transparent'), marginBottom: -1, background: 'transparent', cursor: 'pointer', fontSize: 18, fontWeight: 600, letterSpacing: '-0.025em', color: on || hov === k ? 'var(--foreground)' : 'var(--muted-foreground)', transition: 'color 150ms, border-color 150ms' }}>{label}</button>;
        })}
      </div>
    );
  }

  function FlatDashboard({ openOrder, openCash, accountId, openAllTransactions, openAllAssets }) {
    const watched = window.TSData.useWatchlist();
    const [tf, setTf] = React.useState('1D');
    const [tab, setTab] = React.useState(() => localStorage.getItem('ts-assets-tab') || 'assets');
    React.useEffect(() => { localStorage.setItem('ts-assets-tab', tab); }, [tab]);
    const cash = 4820.55;
    const holdings = Object.entries(POSITIONS).map(([sym, p]) => { const i = find(sym); return { i, ...p, value: p.shares * i.price, gl: p.shares * (i.price - p.cost) }; });
    const invested = holdings.reduce((a, h) => a + h.value, 0);
    const pv = accountId === 1 ? invested : 21380.4;
    const alloc = (invested / (invested + cash)) * 100;
    return (
      <main style={{ display: 'grid', flex: 1, minHeight: 0, gridTemplateColumns: 'minmax(0,1fr) 360px', borderTop: rule }}>
        <div className="ts-scroll" style={{ display: 'flex', minWidth: 0, minHeight: 0, flexDirection: 'column', paddingRight: 32, overflowY: 'auto' }}>
          <section data-tour="networth" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', columnGap: 40, rowGap: 16, padding: '24px 0 20px', borderBottom: rule, flexShrink: 0 }}>
            <div style={{ flex: '1 0 auto' }}>
              <DashLabel style={{ whiteSpace: 'nowrap' }}>Net Worth</DashLabel>
              <p style={{ margin: '4px 0 0', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 16 }}>
                <span style={{ fontSize: 48, lineHeight: 1.05, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums">{money(invested + cash + 21380.4)}</span>
                <ChangePill value={2.14} />
              </p>
            </div>
            <div style={{ flex: '1 1 320px', maxWidth: 420 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontSize: 12 }}><DashLabel as="h3">Allocation</DashLabel><span style={{ color: 'var(--muted-foreground)' }} className="tabular-nums">{alloc.toFixed(0)}% invested</span></div>
              <div role="meter" aria-label="Invested share of net worth" aria-valuenow={alloc.toFixed(0)} style={{ marginTop: 8, height: 6, overflow: 'hidden', borderRadius: 9999, background: 'rgba(255,255,255,.1)' }}><div style={{ height: '100%', width: alloc + '%', borderRadius: 9999, background: 'var(--primary)' }} /></div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <p style={{ margin: 0, display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted-foreground)' }} className="tabular-nums"><span>Invested {money(invested)}</span><span>Cash {money(cash)}</span></p>
                <div style={{ display: 'flex', gap: 8 }}><Button size="lg" onClick={() => openCash('deposit')}>Deposit</Button><Button size="lg" variant="outline" onClick={() => openCash('withdraw')}>Withdraw</Button></div>
              </div>
            </div>
          </section>

          <div data-tour="search" style={{ padding: '16px 0', borderBottom: rule, flexShrink: 0, position: 'relative', zIndex: 25 }}>
            <InstrumentSearch size="lg" placeholder="Search a stock to buy or sell" shortcut action={{ label: 'Trade' }} suggestions={window.TSData.searchSuggestions(watched)} instruments={INSTRUMENTS} onSelect={(i) => openOrder(i.symbol)} />
          </div>

          <section data-tour="portfolio" style={{ display: 'flex', flexDirection: 'column', flex: '2 0 auto', minHeight: 240, padding: '20px 0 16px', borderBottom: rule }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <DashLabel>Portfolio Value <span style={{ textTransform: 'none', letterSpacing: 'normal' }}>· {accountId === 1 ? 'Growth' : 'Retirement'}</span></DashLabel>
                <p style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', columnGap: 12 }}><span style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums">{money(pv)}</span><ChangePill value={2.14} /></p>
              </div>
              <TimeframeToggle value={tf} onChange={setTf} />
            </div>
            <PriceChart area points={series('portfolio' + accountId + tf, COUNTS[tf], pv)} labels={LABELS[tf]} height="100%" style={{ marginTop: 4, flex: 1, minHeight: 0 }} />
          </section>

          <section data-tour="assets" style={{ display: 'flex', flexDirection: 'column', flex: '3 0 auto', minHeight: 220, paddingTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <LineTabs value={tab} onChange={setTab} options={[['assets', 'Assets'], ['watchlist', 'Watch List']]} />
              {tab === 'assets' ? <DashLink onClick={openAllAssets}>View all</DashLink> : null}
            </div>
            {tab === 'watchlist' ? <WatchlistTable openOrder={openOrder} /> : (
              <div className="ts-scroll" style={{ marginTop: 16, flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
                <div style={{ ...head, display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '0 8px 8px', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--background)' }}>
                  <span style={cell}>Asset</span><span style={cell}>Today</span>{['Shares', 'Avg Price', 'Price', 'Change', 'Change %', 'Value', 'Value $'].map((h) => <span key={h} style={{ ...cell, textAlign: 'right' }}>{h}</span>)}
                </div>
                {holdings.map((h) => (
                  <Row key={h.i.symbol} label={'Trade ' + h.i.symbol} cols={COLS} onClick={() => openOrder(h.i.symbol)}>
                    <span style={{ ...cell, fontWeight: 500 }}>{h.i.symbol}</span>
                    <Sparkline points={series(h.i.symbol + 'today', 27, h.i.price).map((v) => (h.i.change < 0 ? 2 * h.i.price - v : v))} />
                    <span style={{ ...cell, textAlign: 'right' }} className="tabular-nums">{h.shares}</span>
                    <span style={{ ...cell, textAlign: 'right' }} className="tabular-nums">{money(h.cost)}</span>
                    <span style={{ ...cell, textAlign: 'right' }} className="tabular-nums">{money(h.i.price)}</span>
                    <span style={{ ...cell, textAlign: 'right', ...gl(h.i.change) }} className="tabular-nums">{(h.i.change >= 0 ? '+' : '') + money(h.i.change)}</span>
                    <span style={{ ...cell, textAlign: 'right', ...gl(h.i.changePercent) }} className="tabular-nums">{pct(h.i.changePercent)}</span>
                    <span style={{ ...cell, textAlign: 'right' }} className="tabular-nums">{money(h.value)}</span>
                    <span style={{ ...cell, textAlign: 'right', ...gl(h.gl) }} className="tabular-nums">{(h.gl >= 0 ? '+' : '') + money(h.gl)}</span>
                  </Row>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside style={{ display: 'flex', minHeight: 0, flexDirection: 'column', borderLeft: rule, paddingLeft: 24, paddingTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.025em' }}>Recent Transactions</h2><DashLink onClick={openAllTransactions}>View all</DashLink></div>
          <div style={{ ...head, marginTop: 16, display: 'flex', justifyContent: 'space-between' }}><span>Asset</span><span>Value</span></div>
          <ul className="ts-scroll" style={{ listStyle: 'none', margin: 0, padding: 0, flex: 1, minHeight: 0, overflowY: 'auto', WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 2rem), transparent)' }}>
            {TRANSACTIONS.map((t, k) => {
              const cashT = t.kind === 'cash', dep = t.reason === 'DEPOSIT';
              return (
                <li key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 0', fontSize: 14, borderBottom: '1px solid var(--border-60)' }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 500 }}>{cashT ? 'Cash' : t.symbol}</span>
                    <ChangePill tag tone={cashT ? (dep ? 'gain' : 'loss') : t.side === 'buy' ? 'primary' : 'loss'} style={{ marginLeft: 8 }}>{cashT ? (dep ? 'deposit' : 'withdrawal') : t.side}</ChangePill>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }}>{t.date}</span>
                  </span>
                  <span style={{ flexShrink: 0, textAlign: 'right' }} className="tabular-nums">
                    <span style={{ display: 'block' }}>{cashT ? (dep ? '+' : '-') + money(t.value) : money(t.shares * t.price)}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }}>{cashT ? 'Cash transfer' : t.shares + ' @ ' + money(t.price)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </aside>
      </main>
    );
  }
  window.FlatDashboard = FlatDashboard;
})();
