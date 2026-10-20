(() => {
  const { Icon, HeaderDropdown, MenuItem, InstrumentSearch, TimeframeToggle, Button } = window.TradingSeasonDesignSystem_86c3eb;
  const { INSTRUMENTS, POSITIONS, candles, money, find } = window.TSData;

  const CHART_MODES = [['line', 'Line', 'chart-line'], ['area', 'Area', 'chart-area'], ['candles', 'Candles', 'chart-candlestick'], ['ohlc', 'OHLC', 'chart-bar'], ['volume', 'Volume', 'chart-no-axes-column'], ['percent', 'Percent', 'percent']];
  const INDICATORS = [['sma', 'SMA 20'], ['ema', 'EMA 20'], ['bollinger', 'Bollinger Bands 20 · 2σ'], ['rsi', 'RSI 14']];
  const MKT_CAP = { AAPL: '$3.42T', MSFT: '$3.81T', NVDA: '$4.49T', AMZN: '$2.46T', GOOGL: '$2.52T', TSLA: '$1.12T', META: '$1.87T', SPCX: '$41.2B', JPM: '$802B', SPY: '$612B' };

  // Bars per timeframe and their timestamps (America/Chicago session, ending Mon Sep 14 2026).
  const SPEC = { '1D': { n: 78, per: 78, mins: 5 }, '5D': { n: 130, per: 26, mins: 15 }, '1M': { n: 132, per: 6, mins: 65 }, '1Y': { n: 252, per: 1, mins: 0 } };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = (() => { const out = []; let d = new Date(2026, 8, 14); while (out.length < 252) { if (d.getDay() % 6) out.unshift(new Date(d)); d = new Date(d.getTime() - 864e5); } return out; })();
  const clock = (m) => { const h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12) + 1 + ':' + String(mm).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); };
  function labeler(tf) {
    const s = SPEC[tf], nDays = Math.ceil(s.n / s.per);
    return (i, full) => {
      const day = days[days.length - nDays + Math.floor(i / s.per)];
      const t = clock(510 + (i % s.per) * s.mins);
      if (tf === '1D') return full ? MON[day.getMonth()] + ' ' + day.getDate() + ' · ' + t : t;
      if (tf === '5D') return DOW[day.getDay()] + ' ' + day.getDate() + (full ? ' · ' + t : '');
      if (tf === '1M') return MON[day.getMonth()] + ' ' + day.getDate() + (full ? ' · ' + t : '');
      return full ? MON[day.getMonth()] + ' ' + day.getDate() + ', ' + day.getFullYear() : MON[day.getMonth()] + " '" + String(day.getFullYear()).slice(2);
    };
  }
  const seriesFor = (sym, tf, price) => candles(sym + tf, SPEC[tf].n, price);

  const FLAT = { border: 0, borderBottom: '1px solid var(--border)', borderRadius: 0, background: 'transparent' };

  function useWide() {
    const [w, setW] = React.useState(() => window.innerWidth >= 1280);
    React.useEffect(() => { const f = () => setW(window.innerWidth >= 1280); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
    return w;
  }

  function NavBack({ onClick }) {
    const [h, setH] = React.useState(false);
    return (
      <a href="#" aria-label="Back to dashboard" onClick={(e) => { e.preventDefault(); onClick(); }} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{ display: 'flex', width: 40, height: 40, flex: '0 0 auto', alignItems: 'center', justifyContent: 'center', border: '1px solid ' + (h ? 'rgba(0,187,255,.35)' : 'rgba(238,250,255,.15)'), borderRadius: 8, color: h ? '#00bbff' : 'rgba(238,250,255,.62)', transition: '150ms ease', textDecoration: 'none' }}>
        <Icon name="chevron-left" size={24} />
      </a>
    );
  }

  function MarketClock() {
    const clockLabel = 'Sep 14, 2026 · 3:45 PM CT';
    return (
      <HeaderDropdown icon="calendar-clock" label={clockLabel} ariaLabel="Change simulated market time" panelStyle={{ padding: 12 }}>
        {(close) => (
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }} className="tabular-nums">{clockLabel}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>Range: Jan 2 – Sep 14, 2026</p>
            <input type="datetime-local" defaultValue="2026-09-14T15:45" aria-label="Simulated time" style={{ marginTop: 12, height: 36, width: '100%', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', padding: '0 12px', fontSize: 14, colorScheme: 'dark' }} />
            <Button size="lg" fullWidth style={{ marginTop: 12 }} onClick={close}>Apply time</Button>
          </div>
        )}
      </HeaderDropdown>
    );
  }

  function MarketNav({ onBack, onPick, layout, onLayout }) {
    return (
      <header style={{ position: 'relative', zIndex: 100, height: 72, padding: '0 24px', background: 'rgba(14,14,14,.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
        <div style={{ margin: '0 auto', display: 'flex', height: '100%', maxWidth: 1600, alignItems: 'center', gap: 12 }}>
          <NavBack onClick={onBack} />
          <div style={{ marginRight: 'auto', minWidth: 192, maxWidth: 672, flex: 1 }}><InstrumentSearch instruments={INSTRUMENTS} onSelect={(i) => onPick(i.symbol)} /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <MarketClock />
            <HeaderDropdown trigger={<Icon name="bell" size={18} />} ariaLabel="Open notifications" triggerStyle={{ background: 'transparent', color: 'var(--muted-foreground)' }} panelWidth={256} panelStyle={{ padding: 12 }}>
              <div aria-label="Notifications"><strong style={{ fontSize: 14 }}>Notifications</strong><p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>No notifications yet.</p></div>
            </HeaderDropdown>
            <HeaderDropdown trigger="SC" ariaLabel="Open profile menu">
              {(close) => (
                <div role="menu" aria-label="Profile">
                  <MenuItem icon={layout === 'flat' ? 'layout-grid' : 'rows-3'} onClick={() => { close(); onLayout(layout === 'flat' ? 'cards' : 'flat'); }}>{layout === 'flat' ? 'Card layout' : 'Flat layout'}</MenuItem>
                  <MenuItem icon="settings" onClick={close}>Settings</MenuItem>
                  <MenuItem icon="log-out" tone="danger" onClick={() => { close(); location.href = '../client-ui/index.html'; }}>Log out</MenuItem>
                </div>
              )}
            </HeaderDropdown>
          </div>
        </div>
      </header>
    );
  }

  function Summary({ i, stats, rangeVolume, collapsed, onOpenTools, wide, flat }) {
    const metric = (k, v) => <div key={k} style={{ minWidth: 0, textAlign: wide ? 'right' : 'left' }}><dt style={{ color: 'rgba(238,250,255,.46)', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{k}</dt><dd style={{ margin: '1px 0 0', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</dd></div>;
    return (
      <section style={{ display: 'flex', flex: wide ? '0 0 4rem' : '0 0 auto', minHeight: 64, flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'flex-start', justifyContent: 'space-between', gap: wide ? 16 : 12, padding: wide ? '4px 16px' : '12px 16px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)', ...(flat ? { ...FLAT, paddingLeft: 0, paddingRight: 0 } : null) }}>
        <div style={{ display: 'flex', flexShrink: 0, minWidth: 0, width: wide ? undefined : '100%', alignItems: 'center', justifyContent: wide ? 'flex-start' : 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{i.symbol}</h1><WatchlistStar symbol={i.symbol} /></div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</p>
          </div>
          <span style={{ fontSize: 30, fontWeight: 700 }} className="tabular-nums">{money(i.price)}</span>
        </div>
        <dl style={{ margin: 0, display: 'grid', flex: 1, minWidth: 0, width: wide ? undefined : '100%', gap: 12, ...(wide ? { gridTemplateColumns: 'repeat(5, minmax(3.5rem, 1fr)) minmax(8rem, 1.6fr) minmax(6rem, 1.2fr)' + (collapsed ? ' minmax(2rem, .5fr)' : ''), borderLeft: '1px solid var(--border)', paddingLeft: 16 } : { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', borderTop: '1px solid var(--border)', paddingTop: 12 }) }}>
          {metric('Mkt Cap', MKT_CAP[i.symbol] || '—')}{metric('Bid', money(stats.bid))}{metric('Ask', money(stats.ask))}{metric('Spread', money(stats.spread))}{metric('Open', money(stats.open))}
          {metric('Day Range', money(stats.low) + '–' + money(stats.high))}{metric('Range Volume', rangeVolume.toLocaleString('en-US'))}
          {collapsed ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}><ToolButton square icon="chevron-left" label="Open market tools" onClick={onOpenTools} style={{ borderColor: 'rgba(238,250,255,.2)', color: 'rgba(238,250,255,.8)' }} /></div> : null}
        </dl>
      </section>
    );
  }

  function Toolbar({ i, mode, setMode, indicators, toggleInd, compare, setCompare, tf, setTf }) {
    const [menu, setMenu] = React.useState(null);
    const sel = CHART_MODES.find((m) => m[0] === mode);
    const others = INSTRUMENTS.filter((x) => x.symbol !== i.symbol);
    const opener = (k) => (v) => setMenu(v ? k : null);
    return (
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid var(--border)', padding: '4px 0 12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <Popover open={menu === 'ind'} setOpen={opener('ind')} trigger={
            <ToolButton icon="sliders-horizontal" active={menu === 'ind' || indicators.length > 0} onClick={() => setMenu(menu === 'ind' ? null : 'ind')}>
              Indicators{indicators.length ? <span style={{ display: 'inline-flex', width: 16, height: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, fontSize: 9, color: 'var(--primary)', background: 'var(--primary-15)' }}>{indicators.length}</span> : null}
            </ToolButton>}>
            <div role="menu" aria-label="Technical indicators" style={{ ...pickerStyle, width: '11rem', gap: 2, padding: 4 }}>
              <span style={{ padding: 8, fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>Technical indicators</span>
              {INDICATORS.map(([k, label]) => { const on = indicators.includes(k); return (
                <PickerItem key={k} role="menuitemcheckbox" checked={on} onClick={() => toggleInd(k)}>
                  <span aria-hidden="true" style={{ width: 12, height: 12, flex: '0 0 auto', border: '1px solid ' + (on ? '#00bbff' : 'rgba(238,250,255,.3)'), borderRadius: 3.2, background: on ? '#00bbff' : 'transparent', boxShadow: on ? 'inset 0 0 0 2px #181818' : 'none' }} />{label}
                </PickerItem>); })}
            </div>
          </Popover>
          <Popover open={menu === 'mode'} setOpen={opener('mode')} trigger={<ToolButton icon={sel[2]} active={menu === 'mode'} onClick={() => setMenu(menu === 'mode' ? null : 'mode')}>Graph view: {sel[1]}</ToolButton>}>
            <div role="menu" aria-label="Chart mode" style={{ ...pickerStyle, width: '7.5rem', gap: 2, padding: 4 }}>
              {CHART_MODES.map(([k, label, icon]) => <PickerItem key={k} role="menuitemradio" checked={mode === k} selected={mode === k} onClick={() => { setMode(k); setMenu(null); }}><Icon name={icon} size={14} />{label}</PickerItem>)}
            </div>
          </Popover>
          <Popover open={menu === 'cmp'} setOpen={opener('cmp')} trigger={
            <ToolButton icon="git-compare" active={menu === 'cmp' || !!compare} onClick={() => setMenu(menu === 'cmp' ? null : 'cmp')}>
              {compare || 'Compare'}
              {compare ? <span role="button" tabIndex={-1} aria-label="Remove comparison" title="Remove comparison" onClick={(e) => { e.stopPropagation(); setCompare(null); }} style={{ display: 'flex', padding: '0 2px', cursor: 'pointer' }}><Icon name="x" size={14} /></span> : null}
            </ToolButton>}>
            <div role="dialog" aria-label="Choose a stock to compare" style={{ ...pickerStyle, width: '16rem' }}>
              <span style={{ padding: '12px 12px 8px', fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>Compare {i.symbol} with</span>
              <InstrumentSearch embedded autoFocus instruments={others} onSelect={(x) => { setCompare(x.symbol); setMenu(null); }} />
            </div>
          </Popover>
        </div>
        <TimeframeToggle value={tf} onChange={setTf} />
      </div>
    );
  }
  function PickerItem({ children, onClick, role, checked, selected }) {
    const [h, setH] = React.useState(false);
    return (
      <button type="button" role={role} aria-checked={checked} onClick={(e) => { e.stopPropagation(); onClick(); }} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{ display: 'flex', minHeight: 30, alignItems: 'center', gap: 8, borderRadius: 6, padding: '0 8px', border: 0, textAlign: 'left', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: selected ? 'var(--primary-15)' : h ? 'var(--primary-10)' : 'transparent', color: selected || h ? 'var(--primary)' : 'var(--muted-foreground)' }}>{children}</button>
    );
  }

  function CompareLabel({ x, style }) {
    return (
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 20, display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'none', fontSize: 12, fontWeight: 600, ...style }} className="tabular-nums">
        <span>{x.symbol}</span><span>{money(x.price)}</span>
        <span style={{ color: x.change >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>{x.change.toFixed(1)} ({(x.changePercent >= 0 ? '+' : '') + x.changePercent.toFixed(2)}%)</span>
      </div>
    );
  }

  function MarketPage({ symbol, setSymbol, onBack }) {
    const i = find(symbol);
    const [tf, setTf] = React.useState('1D');
    const [mode, setMode] = React.useState('candles');
    const [indicators, setInd] = React.useState([]);
    const [compare, setCompare] = React.useState(null);
    const [collapsed, setCollapsed] = React.useState(false);
    const [account, setAccount] = React.useState(1);
    const wide = useWide();
    const [layout, setLayoutState] = React.useState(() => new URLSearchParams(location.search).get('layout') || localStorage.getItem('ts-client-layout') || 'cards');
    const setLayout = (l) => { setLayoutState(l); localStorage.setItem('ts-client-layout', l); };
    const flat = layout === 'flat';
    const shut = collapsed && wide;
    React.useEffect(() => { if (compare === symbol) setCompare(null); }, [symbol]);
    const data = React.useMemo(() => seriesFor(symbol, tf, i.price), [symbol, tf]);
    const day = React.useMemo(() => seriesFor(symbol, '1D', i.price), [symbol]);
    const spread = Math.max(0.01, +(i.price * 0.0004).toFixed(2));
    const stats = { bid: i.price - spread / 2, ask: i.price + spread / 2, spread, open: day[0].open, low: Math.min(...day.map((d) => d.low)), high: Math.max(...day.map((d) => d.high)) };
    const rangeVolume = data.reduce((a, d) => a + d.volume, 0);
    const labelFor = labeler(tf);
    const cmp = compare ? find(compare) : null;
    const cmpData = React.useMemo(() => (cmp ? seriesFor(cmp.symbol, tf, cmp.price) : null), [compare, tf]);
    const toggleInd = (k) => setInd((a) => (a.includes(k) ? a.filter((x) => x !== k) : a.concat(k)));
    const chartKey = symbol + tf;
    const chart = (d, k) => <MarketChart key={k} data={d} mode={mode} indicators={indicators} labelFor={labelFor} initialCount={tf === '1Y' ? 126 : SPEC[tf].n} />;
    const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
    return (
      <main style={{ ...(wide ? { height: '100dvh', overflow: 'hidden' } : { minHeight: '100dvh' }), background: '#0e0e0e', color: '#eefaff', fontVariantNumeric: 'tabular-nums' }}>
        <MarketNav onBack={onBack} onPick={setSymbol} layout={layout} onLayout={setLayout} />
        <div style={{ width: '100%', maxWidth: 1648, margin: '0 auto', padding: wide ? '10px 24px' : '10px 16px', height: wide ? 'calc(100dvh - 72px)' : 'auto' }}>
          <div style={{ display: 'grid', height: wide ? '100%' : 'auto', minHeight: 0, gridTemplateColumns: !wide ? '1fr' : collapsed ? 'minmax(0,10fr) minmax(0,0fr)' : 'minmax(0,7fr) minmax(0,3fr)', gap: shut ? 0 : flat ? 24 : 12, transition: collapsed ? 'grid-template-columns 320ms ease 160ms, gap 320ms ease 160ms' : 'grid-template-columns 320ms ' + ease + ', gap 320ms ' + ease }}>
            <div style={{ display: 'flex', minWidth: 0, minHeight: 0, flexDirection: 'column', gap: flat ? 0 : 12 }}>
              <Summary flat={flat} wide={wide} i={i} stats={stats} rangeVolume={rangeVolume} collapsed={collapsed} onOpenTools={() => setCollapsed(false)} />
              <section style={{ display: 'flex', minHeight: wide ? 0 : '33.5rem', minWidth: 0, flex: 1, flexDirection: 'column', gap: 8, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)', padding: 12, ...(flat ? { ...FLAT, borderBottom: 0, padding: '12px 0 0' } : null) }}>
                <Toolbar i={i} mode={mode} setMode={setMode} indicators={indicators} toggleInd={toggleInd} compare={compare} setCompare={setCompare} tf={tf} setTf={setTf} />
                <div style={{ position: 'relative', minHeight: 0, flex: 1, borderRadius: 12, background: '#0e0e0e', padding: flat ? '12px 0 0' : 12 }}>
                  {cmp ? (
                    <div style={{ display: 'grid', height: '100%', minHeight: 0, gridTemplateColumns: '1fr 1fr' }}>
                      <section aria-label={i.symbol + ' price chart'} style={{ position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, paddingRight: 12, paddingTop: 28 }}><CompareLabel x={i} style={{ top: 0, right: 12 }} />{chart(data, chartKey)}</section>
                      <section aria-label={cmp.symbol + ' price chart'} style={{ position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, paddingLeft: 12, paddingTop: 28, borderLeft: '1px solid rgba(238,250,255,.1)' }}><CompareLabel x={cmp} style={{ top: 0, right: 0 }} />{chart(cmpData, cmp.symbol + tf)}</section>
                    </div>
                  ) : chart(data, chartKey)}
                </div>
              </section>
            </div>
            <aside aria-hidden={shut} style={{ display: !wide && collapsed ? 'none' : 'flex', minWidth: 0, minHeight: 0, flexDirection: 'column', gap: flat ? 0 : 12, ...(flat && wide ? { borderLeft: '1px solid var(--border)', paddingLeft: 24 } : null), visibility: shut ? 'hidden' : 'visible', opacity: shut ? 0 : 1, transform: shut ? 'translateX(1rem)' : 'none', pointerEvents: shut ? 'none' : 'auto', transition: shut ? 'opacity 150ms ease, transform 150ms ease, visibility 0s linear 150ms' : 'opacity 240ms ease 100ms, transform 320ms ' + ease }}>
              <InsightPanel flat={flat} narrow={!wide} instrument={i} low={stats.low} accountName={account === 1 ? 'Growth' : 'Retirement'} onCollapse={() => setCollapsed(true)} />
              <AccountValuePanel flat={flat} accountId={account} setAccount={setAccount} cash={4820.55} />
              <TradeTicket flat={flat} instrument={i} cash={4820.55} />
            </aside>
          </div>
        </div>
      </main>
    );
  }
  window.MarketPage = MarketPage;
})();
