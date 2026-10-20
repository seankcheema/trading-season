(() => {
  const { DashCard, DashLabel, DashLink, InstrumentSearch, ChangePill, TimeframeToggle, PriceChart, Sparkline, Button } = window.TradingSeasonDesignSystem_86c3eb;
  const { INSTRUMENTS, TRANSACTIONS, POSITIONS, series, LABELS, COUNTS, money, pct, find } = window.TSData;

  const head = { borderBottom: '1px solid var(--border)', paddingBottom: 8, color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' };
  const COLS = 'minmax(0,1fr) minmax(0,.8fr) minmax(0,.6fr) minmax(0,.9fr) minmax(0,.9fr) minmax(0,.85fr) minmax(0,.75fr) minmax(0,1fr) minmax(0,1fr)';
  const cell = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' };
  const gl = (v) => ({ color: v >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' });

  function Hover({ children, style, onClick, ...rest }) {
    const [h, setH] = React.useState(false);
    return <button type="button" onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ border: 0, cursor: 'pointer', textAlign: 'left', color: 'inherit', transition: 'background 150ms', background: h ? 'var(--muted)' : 'transparent', ...style }} {...rest}>{children}</button>;
  }

  // Assets | Watch List segmented tablist (dashboard.component.html portfolioTabs)
  function PortfolioTabs({ value, onChange }) {
    const [h, setH] = React.useState(null);
    return (
      <div role="tablist" aria-label="Assets and watch list" style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 8, background: 'var(--muted)' }}>
        {[['assets', 'Assets'], ['watchlist', 'Watch List']].map(([id, label]) => {
          const on = value === id;
          return <button key={id} type="button" role="tab" aria-selected={on} onClick={() => onChange(id)} onMouseEnter={() => setH(id)} onMouseLeave={() => setH(null)}
            style={{ cursor: 'pointer', border: 0, borderRadius: 6, padding: '4px 12px', fontSize: 14, fontWeight: 600, transition: 'color 150ms, background 150ms', background: on ? 'var(--primary)' : 'transparent', color: on ? 'var(--primary-foreground)' : h === id ? 'var(--foreground)' : 'var(--muted-foreground)' }}>{label}</button>;
        })}
      </div>
    );
  }

  const WCOLS = 'minmax(4.75rem,1fr) minmax(4rem,.7fr) minmax(5.25rem,.95fr) minmax(5.25rem,.95fr) minmax(4.75rem,.8fr)';
  function WatchlistTable({ openOrder }) {
    const list = window.TSData.useWatchlist();
    return (
      <div className="ts-scroll" style={{ marginTop: 16, flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 4 }}>
        <div style={{ ...head, display: 'grid', gridTemplateColumns: WCOLS, gap: 6, padding: '0 8px 8px', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--card)' }}>
          <span>Asset</span><span>Today</span><span style={{ textAlign: 'right' }}>Price</span><span style={{ textAlign: 'right' }}>Change</span><span style={{ textAlign: 'right' }}>Change %</span>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {list.map((s) => { const i = find(s); return (
            <li key={s}>
              {i ? (
                <Hover aria-label={'Watch list: ' + i.name} onClick={() => openOrder(i.symbol)} style={{ display: 'grid', width: '100%', gridTemplateColumns: WCOLS, alignItems: 'center', gap: 6, borderRadius: 8, padding: '10px 8px', fontSize: 14, whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 500 }}>{i.symbol}</span>
                  <Sparkline points={series(i.symbol + 'today', 27, i.price).map((v) => (i.change < 0 ? 2 * i.price - v : v))} />
                  <span style={{ textAlign: 'right' }} className="tabular-nums">{money(i.price)}</span>
                  <span style={{ textAlign: 'right', ...gl(i.change) }} className="tabular-nums">{(i.change >= 0 ? '+' : '') + money(i.change)}</span>
                  <span style={{ textAlign: 'right', ...gl(i.changePercent) }} className="tabular-nums">{pct(i.changePercent)}</span>
                </Hover>
              ) : <span style={{ display: 'flex', minHeight: 44, alignItems: 'center', padding: '0 8px', fontSize: 14, color: 'var(--muted-foreground)' }}>{s} unavailable</span>}
            </li>
          ); })}
          {list.length ? null : <li style={{ padding: '24px 8px', textAlign: 'center', fontSize: 14, color: 'var(--muted-foreground)' }}>Search for a stock and click its star to add it to your watchlist.</li>}
        </ul>
      </div>
    );
  }

  function Dashboard({ openOrder, openCash, accountId, openAllTransactions, openAllAssets }) {
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
      <main style={{ display: 'grid', gap: 12, flex: 1, minHeight: 0, gridTemplateColumns: 'minmax(0,1fr) minmax(0,2.25fr)' }}>
        <div style={{ display: 'flex', minWidth: 0, flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <DashCard data-tour="networth" variant="net-worth" style={{ flexShrink: 0 }}>
            <DashLabel>Net Worth</DashLabel>
            <p style={{ margin: '4px 0 0', fontSize: 36, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums">{money(invested + cash + 21380.4)}</p>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontSize: 12 }}>
              <DashLabel as="h3">Allocation</DashLabel><span style={{ color: 'var(--muted-foreground)' }} className="tabular-nums">{alloc.toFixed(0)}% invested</span>
            </div>
            <div role="meter" aria-valuenow={alloc.toFixed(0)} style={{ marginTop: 8, height: 6, overflow: 'hidden', borderRadius: 9999, background: 'rgba(255,255,255,.1)' }}><div style={{ height: '100%', width: alloc + '%', borderRadius: 9999, background: 'var(--primary)' }} /></div>
            <p style={{ margin: '8px 0 0', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted-foreground)' }} className="tabular-nums"><span>Invested {money(invested)}</span><span>Cash {money(cash)}</span></p>
            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Button size="lg" onClick={() => openCash('deposit')}>Deposit</Button>
              <Button size="lg" variant="glass" onClick={() => openCash('withdraw')}>Withdraw</Button>
            </div>
          </DashCard>
          <DashCard style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Recent Transactions</h2><DashLink onClick={openAllTransactions}>View all</DashLink></div>
            <div style={{ ...head, marginTop: 16, display: 'flex', justifyContent: 'space-between' }}><span>Asset</span><span>Value</span></div>
            <ul className="ts-scroll" style={{ listStyle: 'none', margin: 0, padding: 0, flex: 1, minHeight: 0, overflowY: 'auto', WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 2rem), transparent)' }}>
              {TRANSACTIONS.map((t, k) => {
                const cashT = t.kind === 'cash';
                const dep = t.reason === 'DEPOSIT';
                return (
                  <li key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 0', fontSize: 14, borderBottom: '1px solid var(--border-60)' }}>
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
          </DashCard>
        </div>

        <div style={{ display: 'flex', minWidth: 0, flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <div data-tour="search" style={{ flexShrink: 0, position: 'relative', zIndex: 25 }}><InstrumentSearch size="lg" placeholder="Search a stock to buy or sell" shortcut action={{ label: 'Trade' }} suggestions={window.TSData.searchSuggestions(watched)} instruments={INSTRUMENTS} onSelect={(i) => openOrder(i.symbol)} /></div>
          <DashCard data-tour="portfolio" style={{ display: 'flex', flexDirection: 'column', flex: 2, minHeight: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <DashLabel>Portfolio Value <span style={{ textTransform: 'none', letterSpacing: 'normal' }}>· {accountId === 1 ? 'Growth' : 'Retirement'}</span></DashLabel>
                <p style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', columnGap: 12 }}>
                  <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums">{money(pv)}</span>
                  <ChangePill value={2.14} />
                </p>
              </div>
              <TimeframeToggle value={tf} onChange={setTf} />
            </div>
            <PriceChart area points={series('portfolio' + accountId + tf, COUNTS[tf], pv)} labels={LABELS[tf]} height="100%" style={{ marginTop: 4, flex: 1, minHeight: 0 }} />
          </DashCard>
          <DashCard data-tour="assets" style={{ display: 'flex', flexDirection: 'column', flex: 3, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <PortfolioTabs value={tab} onChange={setTab} />
              {tab === 'assets' ? <DashLink onClick={openAllAssets}>View all</DashLink> : null}
            </div>
            {tab === 'watchlist' ? <WatchlistTable openOrder={openOrder} /> : (
            <div className="ts-scroll" style={{ marginTop: 16, flex: 1, minHeight: 0, overflowX: 'hidden', overflowY: 'auto', paddingBottom: 4 }}>
              <div>
                <div style={{ ...head, display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '0 8px 8px', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--card)' }}>
                  <span style={cell}>Asset</span><span style={cell}>Today</span>{['Shares', 'Avg Price', 'Price', 'Change', 'Change %', 'Value', 'Value $'].map((h) => <span key={h} style={{ ...cell, textAlign: 'right' }}>{h}</span>)}
                </div>
                {holdings.map((h) => (
                  <Hover key={h.i.symbol} aria-label={'Trade ' + h.i.symbol} onClick={() => openOrder(h.i.symbol)} style={{ display: 'grid', width: '100%', gridTemplateColumns: COLS, alignItems: 'center', gap: 6, borderRadius: 8, padding: '10px 8px', fontSize: 14, whiteSpace: 'nowrap' }}>
                    <span style={{ ...cell, fontWeight: 500 }}>{h.i.symbol}</span>
                    <Sparkline points={series(h.i.symbol + 'today', 27, h.i.price).map((v, k) => (h.i.change < 0 ? 2 * h.i.price - v : v))} />
                    <span style={{ textAlign: 'right' }} className="tabular-nums">{h.shares}</span>
                    <span style={{ textAlign: 'right' }} className="tabular-nums">{money(h.cost)}</span>
                    <span style={{ textAlign: 'right' }} className="tabular-nums">{money(h.i.price)}</span>
                    <span style={{ textAlign: 'right', ...gl(h.i.change) }} className="tabular-nums">{(h.i.change >= 0 ? '+' : '') + money(h.i.change)}</span>
                    <span style={{ textAlign: 'right', ...gl(h.i.changePercent) }} className="tabular-nums">{pct(h.i.changePercent)}</span>
                    <span style={{ textAlign: 'right' }} className="tabular-nums">{money(h.value)}</span>
                    <span style={{ textAlign: 'right', ...gl(h.gl) }} className="tabular-nums">{(h.gl >= 0 ? '+' : '') + money(h.gl)}</span>
                  </Hover>
                ))}
              </div>
            </div>
            )}
          </DashCard>
        </div>
      </main>
    );
  }
  Object.assign(window, { Dashboard, WatchlistTable });
})();
