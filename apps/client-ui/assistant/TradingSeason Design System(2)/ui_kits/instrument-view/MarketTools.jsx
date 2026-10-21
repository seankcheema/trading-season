(() => {
  const { Icon, HeaderDropdown, MenuItem, InstrumentSearch, ChangePill } = window.TradingSeasonDesignSystem_86c3eb;
  const { TRANSACTIONS, ACCOUNTS, POSITIONS, money, find } = window.TSData;

  // .tool-button / .tool-icon from market-page.component.css
  function ToolButton({ active, icon, children, onClick, label, square, style }) {
    const [h, setH] = React.useState(false);
    const bg = active ? 'rgba(0,187,255,.12)' : h ? 'rgba(0,187,255,.1)' : '#242424';
    const bc = active ? 'rgba(0,187,255,.45)' : h ? 'rgba(0,187,255,.55)' : 'rgba(238,250,255,.28)';
    return (
      <button type="button" aria-label={label} title={label} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{ display: 'flex', height: 30, width: square ? 30 : undefined, alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid ' + bc, borderRadius: 8, background: bg, padding: square ? 0 : '0 12px', color: active ? '#00bbff' : h ? '#eefaff' : 'rgba(238,250,255,.85)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'border-color 150ms, background-color 150ms, color 150ms', flexShrink: 0, ...style }}>
        {icon ? <Icon name={icon} size={square ? 16 : 14} /> : null}{children}
      </button>
    );
  }

  const FLAT = { border: 0, borderBottom: '1px solid var(--border)', borderRadius: 0, background: 'transparent', paddingLeft: 0, paddingRight: 0 };

  // .comparison-picker: #181818 floating panel
  const pickerStyle = { position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 40, display: 'flex', flexDirection: 'column', border: '1px solid rgba(238,250,255,.15)', borderRadius: 8, background: '#181818', boxShadow: '0 1rem 2.5rem rgba(0,0,0,.45)' };

  function Popover({ trigger, open, setOpen, children }) {
    const ref = React.useRef(null);
    React.useEffect(() => { const c = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', c); return () => document.removeEventListener('mousedown', c); });
    return <div ref={ref} style={{ position: 'relative' }}>{trigger}{open ? children : null}</div>;
  }

  const TABS = [['overview', 'Overview'], ['news', 'News'], ['ai', 'AI'], ['recent-orders', 'Recent Orders']];
  const NEWS = [
    { age: '12 min ago', category: 'Market update', title: 'holds near its session high as trading activity increases.', includeSymbol: true },
    { age: '48 min ago', category: 'Sector watch', title: 'Large-cap peers trade higher as investors favor established companies.' },
    { age: '2 hr ago', category: 'Company outlook', title: 'Analysts continue to focus on demand, margins, and the next earnings update.' },
    { age: '4 hr ago', category: 'Macroeconomy', title: 'Treasury yields ease as markets assess latest economic data.' },
    { age: '5 hr ago', category: 'Earnings', title: 'Tech stocks extend gains ahead of key earnings reports this week.' },
  ];
  const OVERVIEW = [['trending-up', 'Trend', 'Positive', 4], ['users-round', 'Popularity', 'Above average', 4], ['shield-check', 'Short-term risk', 'Moderate', 3], ['message-square-text', 'Sentiment', 'Bullish', 4]];
  const card = { border: '1px solid rgba(238,250,255,.1)', borderRadius: 8.8, background: 'rgba(238,250,255,.018)' };

  function Overview({ symbol, low }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 8, flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'repeat(2, 4.35rem)', gap: 6.4 }}>
          {OVERVIEW.map(([icon, k, v, lvl]) => (
            <article key={k} style={{ ...card, display: 'grid', gridTemplateRows: 'minmax(0,1fr) auto', padding: '6.4px 7.2px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.75rem minmax(0,1fr)', gap: 6.7, alignItems: 'center' }}>
                <div aria-hidden="true" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(238,250,255,.1)', borderRadius: 7.2, background: 'rgba(238,250,255,.025)', color: 'rgba(238,250,255,.58)' }}><Icon name={icon} size={13} /></div>
                <div style={{ display: 'grid', gap: 1.3 }}>
                  <span style={{ color: 'rgba(238,250,255,.55)', fontSize: 9, fontWeight: 600, letterSpacing: '0.035em' }}>{k}</span>
                  <strong style={{ color: 'rgba(255,255,255,.9)', fontSize: 10.6, lineHeight: 1.15 }}>{v}</strong>
                </div>
              </div>
              <div role="progressbar" aria-label={k + ' level'} aria-valuemin="0" aria-valuemax="5" aria-valuenow={lvl} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 3.2, marginTop: 3.5 }}>
                {[1, 2, 3, 4, 5].map((s) => <span key={s} style={{ height: 4.2, borderRadius: 999, background: s <= lvl ? 'rgba(255,255,255,.8)' : 'rgba(238,250,255,.12)' }} />)}
              </div>
            </article>
          ))}
        </div>
        <aside style={{ ...card, flex: '1 1 auto', minHeight: 44, display: 'flex', alignItems: 'center', padding: '6.7px 10.4px', color: 'rgba(238,250,255,.5)' }}>
          <div>
            <strong style={{ display: 'block', marginBottom: 3, color: 'rgba(238,250,255,.82)', fontSize: 10.2 }}>Session brief</strong>
            <p style={{ margin: 0, fontSize: 9.8, lineHeight: 1.35 }}>{symbol} shows steady strength, elevated activity, and positive sentiment with moderate near-term risk.</p>
            <p style={{ margin: '4px 0 0', fontSize: 9.8, lineHeight: 1.35 }}>Support is forming near {money(low)}, while simulated participation remains above average. Signal scores are illustrative.</p>
          </div>
        </aside>
      </div>
    );
  }

  function News({ symbol }) {
    return (
      <div className="ts-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingTop: 12 }}>
        <strong style={{ display: 'block', fontSize: 14, paddingBottom: 12 }}>Latest headlines</strong>
        <div aria-label="Simulated market headlines" style={{ borderTop: '1px solid rgba(238,250,255,.09)' }}>
          {NEWS.map((s) => <NewsStory key={s.title} s={s} symbol={symbol} />)}
        </div>
      </div>
    );
  }
  function NewsStory({ s, symbol }) {
    const [h, setH] = React.useState(false);
    return (
      <article onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ borderBottom: '1px solid rgba(238,250,255,.09)', padding: '13px 2.4px 13.8px', cursor: 'default' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'rgba(238,250,255,.46)', fontSize: 9.3, fontWeight: 600, letterSpacing: '0.045em', textTransform: 'uppercase' }}><time>{s.age}</time><span>{s.category}</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 9, marginTop: 5 }}>
          <h3 style={{ margin: 0, color: h ? 'rgba(238,250,255,.92)' : 'rgba(238,250,255,.6)', fontSize: 12, fontWeight: 500, lineHeight: 1.42, transition: 'color 150ms' }}>{s.includeSymbol ? symbol + ' ' + s.title : s.title}</h3>
          <span aria-hidden="true" style={{ color: 'rgba(238,250,255,.42)', fontSize: 21.6, fontWeight: 300, lineHeight: 1 }}>›</span>
        </div>
      </article>
    );
  }

  function AiChat({ symbol, price, change }) {
    const [msgs, setMsgs] = React.useState([]);
    const [draft, setDraft] = React.useState('');
    const send = (e) => {
      e.preventDefault(); const q = draft.trim(); if (!q) return;
      setMsgs((m) => m.concat({ role: 'user', text: q }, { role: 'assistant', text: 'Simulated reply: ' + symbol + ' is at ' + money(price) + ' (' + (change >= 0 ? '+' : '') + change.toFixed(2) + '% today). Responses in this mock are placeholders.' }));
      setDraft('');
    };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, paddingTop: 8 }}>
        {msgs.length ? (
          <div className="ts-scroll" aria-live="polite" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {msgs.map((m, k) => <div key={k} style={{ maxWidth: '92%', borderRadius: 8, padding: '8px 12px', fontSize: 12, lineHeight: '20px', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? 'var(--primary-15)' : 'rgba(255,255,255,.05)', color: m.role === 'user' ? 'var(--foreground)' : 'var(--muted-foreground)' }}>{m.text}</div>)}
          </div>
        ) : (
          <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px', textAlign: 'center' }}>
            <Icon name="bot-message-square" size={36} style={{ color: 'var(--muted-foreground)', marginBottom: 16 }} />
            <strong style={{ fontSize: 16, fontWeight: 600 }}>Ask about {symbol}</strong>
            <p style={{ margin: '4px 0 0', maxWidth: 224, fontSize: 12, lineHeight: '20px', color: 'var(--muted-foreground)' }}>Explore the chart, price movement, volume, or market terminology.</p>
          </div>
        )}
        <form onSubmit={send} style={{ marginTop: 8, display: 'flex', minHeight: 44, alignItems: 'center', gap: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: '#202020', padding: '6px 6px 6px 12px' }}>
          <input type="text" aria-label="Ask market AI" placeholder={'Ask about ' + symbol} value={draft} onChange={(e) => setDraft(e.target.value)} style={{ minWidth: 0, flex: 1, background: 'transparent', border: 0, outline: 'none', fontSize: 12 }} />
          <button type="submit" aria-label="Send question" title="Send question" disabled={!draft.trim()} style={{ width: 32, height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 6, background: 'var(--primary)', color: 'var(--primary-foreground)', cursor: draft.trim() ? 'pointer' : 'not-allowed', opacity: draft.trim() ? 1 : 0.3 }}><Icon name="send-horizontal" size={16} /></button>
        </form>
      </div>
    );
  }

  function RecentOrders({ accountName }) {
    const trades = TRANSACTIONS.filter((t) => t.kind === 'trade');
    return (
      <div className="ts-scroll" role="tabpanel" aria-label="Recent Orders" style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingTop: 12 }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted-foreground)' }}>{accountName} · All stocks</p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {trades.map((t, k) => (
            <li key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 0', fontSize: 14, borderBottom: '1px solid var(--border-60)' }}>
              <span><span style={{ fontWeight: 500 }}>{t.symbol}</span><ChangePill tag tone={t.side === 'buy' ? 'primary' : 'loss'} style={{ marginLeft: 8 }}>{t.side}</ChangePill><span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }}>{t.date}</span></span>
              <span style={{ textAlign: 'right' }} className="tabular-nums"><span style={{ display: 'block' }}>{money(t.shares * t.price)}</span><span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }}>{t.shares} @ {money(t.price)}</span></span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function InsightPanel({ instrument, low, accountName, onCollapse, narrow, flat }) {
    const [tab, setTab] = React.useState('overview');
    const [hov, setHov] = React.useState(null);
    return (
      <section style={{ display: 'flex', minHeight: narrow ? '18rem' : 140, flex: narrow ? '0 0 auto' : '1 1 0', height: narrow ? 'min(28rem, 60dvh)' : undefined, flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)', padding: 12, ...(flat ? { ...FLAT, paddingTop: 0 } : null) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 48, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
          <ToolButton square icon="chevron-right" label="Hide market tools" onClick={onCollapse} style={{ borderColor: 'rgba(238,250,255,.2)', color: 'rgba(238,250,255,.8)' }} />
          <div role="tablist" aria-label="Instrument tools" style={{ display: 'flex', gap: 4, padding: 5.6, borderRadius: 8, background: 'var(--muted)', marginRight: 'auto' }}>
            {TABS.map(([id, label]) => {
              const on = tab === id;
              return <button key={id} type="button" role="tab" aria-selected={on} onClick={() => setTab(id)} onMouseEnter={() => setHov(id)} onMouseLeave={() => setHov(null)}
                style={{ flex: on ? 1 : undefined, cursor: 'pointer', border: 0, borderRadius: 6, padding: on ? '2px 13.6px' : '2px 8px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', transition: 'color 150ms, background 150ms', background: on ? 'var(--primary)' : 'transparent', color: on ? 'var(--primary-foreground)' : hov === id ? 'var(--foreground)' : 'var(--muted-foreground)' }}>{label}</button>;
            })}
          </div>
        </div>
        {tab === 'overview' ? <Overview symbol={instrument.symbol} low={low} /> : null}
        {tab === 'news' ? <News symbol={instrument.symbol} /> : null}
        {tab === 'ai' ? <AiChat symbol={instrument.symbol} price={instrument.price} change={instrument.changePercent} /> : null}
        {tab === 'recent-orders' ? <RecentOrders accountName={accountName} /> : null}
      </section>
    );
  }

  function AccountValuePanel({ accountId, setAccount, cash, flat }) {
    const acct = ACCOUNTS.find((a) => a.id === accountId) || ACCOUNTS[0];
    const pv = accountId === 1 ? 7604.68 : 21380.4;
    const bal = (label, value, tint) => (
      <div style={flat ? { display: 'grid', gap: 2 } : { display: 'grid', alignContent: 'start', gap: 2.4, padding: '7.2px 12px', border: '1px solid color-mix(in srgb, ' + tint + ' 14%, var(--border))', borderRadius: 8.8, background: 'color-mix(in srgb, ' + tint + ' 2%, transparent)' }}>
        <dt style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{label}</dt>
        <dd style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'color-mix(in srgb, ' + tint + ' 18%, var(--foreground))' }} className="tabular-nums">{money(value)}</dd>
      </div>
    );
    return (
      <section aria-label="Trading account" style={{ position: 'relative', flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 6.4, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)', padding: 10, ...(flat ? { ...FLAT, padding: '16px 0', gap: 12 } : null) }}>
        <HeaderDropdown icon="briefcase-business" label={acct.name} width="100%" ariaLabel="Select account" triggerStyle={{ height: 40, gap: 12 }}>
          {(close) => (
            <div role="menu" aria-label="Accounts">
              {ACCOUNTS.map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MenuItem onClick={() => { setAccount(a.id); close(); }} trailing={a.id === accountId ? <Icon name="check" color="var(--primary)" /> : null} style={{ flex: 1 }}>
                    <span style={{ display: 'block' }}>{a.name}</span><span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }} className="tabular-nums">Portfolio {money(a.id === 1 ? 7604.68 : 21380.4)}</span>
                  </MenuItem>
                  <MenuItem icon="pencil" style={{ width: 32, minHeight: 32, padding: 0, justifyContent: 'center', color: 'var(--muted-foreground)', flex: '0 0 32px' }} />
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
              <MenuItem tone="primary" icon="plus" onClick={close}>New account</MenuItem>
            </div>
          )}
        </HeaderDropdown>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6.4 }}>
          {bal('Available cash', cash, '#c5a77b')}
          {bal('Portfolio value', pv, 'var(--primary)')}
        </dl>
      </section>
    );
  }

  // app-trade-ticket: compact order execution card for the market page.
  function TradeTicket({ instrument, cash, flat }) {
    const { SideToggle } = window.TradingSeasonDesignSystem_86c3eb;
    const [side, setSide] = React.useState('buy');
    const [qty, setQty] = React.useState(0);
    const [msg, setMsg] = React.useState('');
    React.useEffect(() => { setQty(0); setMsg(''); }, [instrument.symbol]);
    const held = (POSITIONS[instrument.symbol] || {}).shares || 0;
    const max = side === 'buy' ? Math.floor(cash / instrument.price) : held;
    const q = Math.min(qty, max);
    const value = q * instrument.price;
    const set = (v) => { setQty(Math.max(0, Math.min(max, Math.floor(Number(v) || 0)))); setMsg(''); };
    const row = (k, v, strong) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, ...(strong ? { borderTop: '1px solid var(--border)', paddingTop: 8, fontWeight: 600 } : null) }}><dt style={{ color: strong ? undefined : 'var(--muted-foreground)' }}>{k}</dt><dd style={{ margin: 0 }} className="tabular-nums">{v}</dd></div>;
    return (
      <section aria-label="Order execution" style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)', padding: 12, ...(flat ? { ...FLAT, borderBottom: 0, padding: '16px 0 0' } : null) }}>
        <SideToggle value={side} onChange={(s) => { setSide(s); setMsg(''); }} />
        <div style={{ marginTop: 10, ...(flat ? { borderBottom: '1px solid var(--border)', padding: '8px 0 12px' } : { border: '1px solid var(--border)', borderRadius: 12, padding: 12 }) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <label htmlFor="future-trade-quantity" style={{ color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 500, letterSpacing: '0.025em', textTransform: 'uppercase' }}>Shares</label>
            <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }} className="tabular-nums">Max {max}</span>
          </div>
          <input id="future-trade-quantity" type="number" min="0" max={max} value={q} disabled={max === 0} onChange={(e) => set(e.target.value)} style={{ marginTop: 4, width: '100%', background: 'transparent', border: 0, outline: 'none', fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums" />
          <input type="range" aria-label="Shares" min="0" max={max} value={q} onChange={(e) => set(e.target.value)} style={{ marginTop: 8, width: '100%', accentColor: '#00bbff' }} />
        </div>
        <dl style={{ margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 6, borderRadius: 12, padding: flat ? '4px 0' : 12, fontSize: 12, background: flat ? 'transparent' : 'rgba(26,26,26,.6)' }}>
          {row('Market price', money(instrument.price))}{row('Shares', q)}{row('Cash before', money(cash))}{row('Cash after', money(side === 'buy' ? cash - value : cash + value))}
          {row('Estimated ' + (side === 'buy' ? 'cost' : 'proceeds'), money(value), true)}
        </dl>
        <div style={{ minHeight: 8 }} />
        <button type="button" disabled={!q} onClick={() => setMsg((side === 'buy' ? 'Bought ' : 'Sold ') + q + ' ' + instrument.symbol + '.')}
          style={{ height: 44, width: '100%', border: 0, borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: q ? 'pointer' : 'not-allowed', opacity: q ? 1 : 0.4, background: side === 'buy' ? 'var(--primary)' : 'var(--color-loss)', color: side === 'buy' ? 'var(--primary-foreground)' : '#fff' }}>
          {(side === 'buy' ? 'Buy' : 'Sell') + ' ' + q + ' ' + instrument.symbol}
        </button>
        {msg ? <p role="status" style={{ margin: '6px 0 0', textAlign: 'center', fontSize: 12 }}>{msg}</p> : null}
      </section>
    );
  }

  Object.assign(window, { ToolButton, Popover, pickerStyle, InsightPanel, AccountValuePanel, TradeTicket });
})();
