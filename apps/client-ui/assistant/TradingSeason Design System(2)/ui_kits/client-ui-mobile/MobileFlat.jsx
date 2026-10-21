(() => {
  // Flat (non-bento) layout: no card containers. Full-bleed hero + chart, then hairline-separated list sections.
  const { DashLabel, DashLink, ChangePill, TimeframeToggle, PriceChart, Button, Icon, MenuItem, NativeSelect } = window.TradingSeasonDesignSystem_86c3eb;
  const { TRANSACTIONS, ACCOUNTS, series, LABELS, COUNTS, money } = window.TSData;
  const { CASH, holdingsOf } = window.MobileKit;

  const rule = { borderTop: '1px solid var(--border)' };
  function Section({ title, action, onAction, children, first }) {
    return (
      <section style={{ padding: '20px 16px 8px', ...(first ? null : rule) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.025em' }}>{title}</h2>
          {action ? <DashLink onClick={onAction} style={{ minHeight: 32, fontSize: 13 }}>{action}</DashLink> : null}
        </div>
        <div style={{ marginTop: 4 }}>{children}</div>
      </section>
    );
  }

  // Underlined text tabs instead of the boxed segment.
  function LineTabs({ value, onChange, options }) {
    return (
      <div role="tablist" style={{ display: 'flex', gap: 20, padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
        {options.map(([k, label]) => {
          const on = value === k;
          return <button key={k} type="button" role="tab" aria-selected={on} onClick={() => onChange(k)}
            style={{ height: 44, padding: 0, border: 0, borderBottom: '2px solid ' + (on ? 'var(--primary)' : 'transparent'), marginBottom: -1, background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: on ? 'var(--foreground)' : 'var(--muted-foreground)', transition: 'color 150ms, border-color 150ms' }}>{label}</button>;
        })}
      </div>
    );
  }

  function SearchField({ onSearch }) {
    return (
      <Pressable onClick={onSearch} label="Search a stock to buy or sell" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 48, padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted-foreground)', fontSize: 16 }}>
        <Icon name="search" size={18} />Search a stock to buy or sell
      </Pressable>
    );
  }

  function FlatHome({ accountId, openOrder, openCash, setTab, onSearch }) {
    const [tf, setTf] = React.useState('1D');
    const holdings = holdingsOf();
    const invested = holdings.reduce((a, h) => a + h.value, 0);
    const pv = accountId === 1 ? invested : 21380.4;
    const alloc = (invested / (invested + CASH)) * 100;
    const top = holdings.slice().sort((a, b) => b.value - a.value).slice(0, 4);
    return (
      <div style={{ paddingBottom: 16 }}>
        <div style={{ padding: '20px 16px 0' }}>
          <DashLabel>Net Worth</DashLabel>
          <p style={{ margin: '4px 0 0', fontSize: 40, lineHeight: 1.1, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums">{money(invested + CASH + 21380.4)}</p>
          <p style={{ margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted-foreground)' }}>
            <ChangePill value={2.14} /><span>{accountId === 1 ? 'Growth' : 'Retirement'} · {money(pv)}</span>
          </p>
        </div>
        <PriceChart area points={series('portfolio' + accountId + tf, COUNTS[tf], pv)} labels={[LABELS[tf][0], LABELS[tf][2], LABELS[tf][4]]} height={210} style={{ margin: '12px 16px 0', gridTemplateColumns: 'minmax(0,1fr) 3.5rem' }} />
        <div style={{ padding: '12px 16px 0' }}><TimeframeToggle value={tf} onChange={setTf} style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }} /></div>
        <div style={{ padding: '20px 16px 0' }}>
          <div role="meter" aria-label="Allocation" aria-valuenow={alloc.toFixed(0)} style={{ height: 6, overflow: 'hidden', borderRadius: 9999, background: 'rgba(255,255,255,.1)' }}><div style={{ height: '100%', width: alloc + '%', borderRadius: 9999, background: 'var(--primary)' }} /></div>
          <p style={{ margin: '8px 0 0', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted-foreground)' }} className="tabular-nums"><span>Invested {money(invested)}</span><span>Cash {money(CASH)}</span></p>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Button size="lg" style={{ height: 44 }} onClick={() => openCash('deposit')}>Deposit</Button>
            <Button size="lg" variant="outline" style={{ height: 44 }} onClick={() => openCash('withdraw')}>Withdraw</Button>
          </div>
          <div style={{ marginTop: 12 }}><SearchField onSearch={onSearch} /></div>
        </div>
        <div style={{ height: 24 }} />
        <Section title="Assets" action="View all" onAction={() => setTab('assets')}>
          {top.map((h, k) => <AssetRow key={h.i.symbol} h={h} last={k === top.length - 1} onClick={() => openOrder(h.i.symbol)} />)}
        </Section>
        <Section title="Watch List" action="View all" onAction={() => setTab('assets', 'watchlist')}><WatchlistRows openOrder={openOrder} limit={4} /></Section>
        <Section title="Recent Transactions" action="View all" onAction={() => setTab('activity')}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{TRANSACTIONS.slice(0, 4).map((t, k) => <TxRow key={k} t={t} last={k === 3} />)}</ul>
        </Section>
      </div>
    );
  }

  function FlatAssets({ openOrder, view, setView }) {
    const [sort, setSort] = React.useState('Value');
    const holdings = holdingsOf();
    const invested = holdings.reduce((a, h) => a + h.value, 0);
    const gl = holdings.reduce((a, h) => a + h.gl, 0);
    const key = { Value: (h) => -h.value, 'Today %': (h) => -h.i.changePercent, 'Gain/Loss': (h) => -h.gl, Name: (h) => h.i.symbol };
    const rows = holdings.slice().sort((a, b) => { const x = key[sort](a), y = key[sort](b); return typeof x === 'string' ? x.localeCompare(y) : x - y; });
    return (
      <div style={{ paddingBottom: 16 }}>
        <LineTabs value={view} onChange={setView} options={[['assets', 'Assets'], ['watchlist', 'Watch List']]} />
        {view === 'watchlist' ? <div style={{ padding: '8px 16px' }}><WatchlistRows openOrder={openOrder} /></div> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '20px 16px 16px' }}>
              <div><DashLabel>Invested</DashLabel><p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums">{money(invested)}</p></div>
              <div style={{ paddingLeft: 16, borderLeft: '1px solid var(--border)' }}><DashLabel>Unrealized</DashLabel><p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', color: gl >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }} className="tabular-nums">{(gl >= 0 ? '+' : '') + money(gl)}</p></div>
            </div>
            <div style={{ padding: '0 16px 8px' }}><Chips value={sort} onChange={setSort} options={['Value', 'Today %', 'Gain/Loss', 'Name']} /></div>
            <div style={{ padding: '0 16px', ...rule }}>
              {rows.map((h, k) => (
                <div key={h.i.symbol} style={{ borderBottom: k === rows.length - 1 ? 0 : '1px solid var(--border-60)' }}>
                  <AssetRow h={h} last onClick={() => openOrder(h.i.symbol)} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '0 0 10px 48px', fontSize: 12, color: 'var(--muted-foreground)' }} className="tabular-nums">
                    <span>Avg {money(h.cost)}</span><span>{((h.value / invested) * 100).toFixed(1)}% of portfolio</span>
                    <span style={{ color: h.gl >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>{(h.gl >= 0 ? '+' : '') + money(h.gl)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  function FlatActivity() {
    const [kind, setKind] = React.useState('all');
    const list = TRANSACTIONS.filter((t) => kind === 'all' || (kind === 'trades' ? t.kind === 'trade' : t.kind === 'cash'));
    return (
      <div style={{ paddingBottom: 16 }}>
        <LineTabs value={kind} onChange={setKind} options={[['all', 'All'], ['trades', 'Trades'], ['cash', 'Cash']]} />
        <ul style={{ listStyle: 'none', margin: 0, padding: '4px 16px' }}>
          {list.length ? list.map((t, k) => <TxRow key={k} t={t} last={k === list.length - 1} />) : <li style={{ padding: '24px 0', textAlign: 'center', fontSize: 14, color: 'var(--muted-foreground)' }}>No transactions yet.</li>}
        </ul>
      </div>
    );
  }

  // Settings-style grouped rows separated by hairlines.
  function GroupLabel({ children }) { return <DashLabel as="p" style={{ margin: 0, padding: '24px 16px 8px' }}>{children}</DashLabel>; }
  function FlatAccount({ accountId, onPick, onSignOut }) {
    const row = { minHeight: 56, borderRadius: 0, padding: '8px 16px', borderBottom: '1px solid var(--border-60)' };
    return (
      <div style={{ paddingBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '24px 16px 4px' }}>
          <span style={{ width: 56, height: 56, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-15)', color: 'var(--primary)', fontSize: 18, fontWeight: 600 }}>SC</span>
          <span><span style={{ display: 'block', fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em' }}>Sean Cheema</span><span style={{ display: 'block', fontSize: 13, color: 'var(--muted-foreground)' }}>sean@example.com · Advanced</span></span>
        </div>
        <GroupLabel>Accounts</GroupLabel>
        <div style={rule}>
          {ACCOUNTS.map((a) => (
            <MenuItem key={a.id} style={row} onClick={() => onPick(a.id)} trailing={a.id === accountId ? <Icon name="check" color="var(--primary)" /> : null}>
              <span style={{ display: 'block' }}>{a.name}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }} className="tabular-nums">Portfolio {money(a.id === 1 ? 7604.68 : 21380.4)}</span>
            </MenuItem>
          ))}
          <MenuItem tone="primary" icon="plus" style={row}>New account</MenuItem>
        </div>
        <GroupLabel>Security</GroupLabel>
        <div style={{ ...rule, padding: '16px 16px 0' }}>
          <label htmlFor="f-idle" style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Sign out after inactivity</label>
          <NativeSelect id="f-idle" radius={5} value="15" style={{ height: 44 }} options={[{ value: '5', label: '5 minutes' }, { value: '15', label: '15 minutes (default)' }, { value: '30', label: '30 minutes' }, { value: '60', label: '60 minutes' }]} />
          <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--muted-foreground)' }}>You will be signed out automatically when there is no mouse, keyboard or touch input for this long. Changes apply immediately.</p>
        </div>
        <div style={{ ...rule, marginTop: 24 }}><MenuItem icon="log-out" tone="danger" style={row} onClick={onSignOut}>Log out</MenuItem></div>
      </div>
    );
  }

  Object.assign(window, { FlatHome, FlatAssets, FlatActivity, FlatAccount });
})();
