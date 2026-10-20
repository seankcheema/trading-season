(() => {
  const { DashCard, DashLabel, ChangePill, TimeframeToggle, PriceChart, Button } = window.TradingSeasonDesignSystem_86c3eb;
  const { INSTRUMENTS, TRANSACTIONS, series, LABELS, COUNTS, money, pct, find } = window.TSData;
  const { CASH, holdingsOf } = window.MobileKit;
  const pad = { padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 };

  function NetWorthCard({ invested, openCash }) {
    const alloc = (invested / (invested + CASH)) * 100;
    return (
      <DashCard variant="net-worth" padding={16}>
        <DashLabel>Net Worth</DashLabel>
        <p style={{ margin: '4px 0 0', fontSize: 36, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums">{money(invested + CASH + 21380.4)}</p>
        <div role="meter" aria-label="Allocation" aria-valuenow={alloc.toFixed(0)} style={{ marginTop: 16, height: 6, overflow: 'hidden', borderRadius: 9999, background: 'rgba(255,255,255,.1)' }}><div style={{ height: '100%', width: alloc + '%', borderRadius: 9999, background: 'var(--primary)' }} /></div>
        <p style={{ margin: '8px 0 0', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted-foreground)' }} className="tabular-nums"><span>Invested {money(invested)}</span><span>Cash {money(CASH)}</span></p>
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Button size="lg" style={{ height: 44 }} onClick={() => openCash('deposit')}>Deposit</Button>
          <Button size="lg" variant="glass" style={{ height: 44 }} onClick={() => openCash('withdraw')}>Withdraw</Button>
        </div>
      </DashCard>
    );
  }

  function WatchlistRows({ openOrder, limit }) {
    const list = window.TSData.useWatchlist();
    const rows = (limit ? list.slice(0, limit) : list).map(find).filter(Boolean);
    if (!list.length) return <p style={{ margin: 0, padding: '16px 0', textAlign: 'center', fontSize: 14, color: 'var(--muted-foreground)' }}>Search for a stock and tap its star to add it to your watchlist.</p>;
    return rows.map((i, k) => <AssetRow key={i.symbol} h={{ i }} last={k === rows.length - 1} onClick={() => openOrder(i.symbol)} />);
  }

  function MobileHome({ accountId, openOrder, openCash, setTab }) {
    const [tf, setTf] = React.useState('1D');
    const holdings = holdingsOf();
    const invested = holdings.reduce((a, h) => a + h.value, 0);
    const pv = accountId === 1 ? invested : 21380.4;
    const top = holdings.slice().sort((a, b) => b.value - a.value).slice(0, 3);
    return (
      <div style={pad}>
        <NetWorthCard invested={invested} openCash={openCash} />
        <DashCard padding={16}>
          <DashLabel>Portfolio Value <span style={{ textTransform: 'none', letterSpacing: 'normal' }}>· {accountId === 1 ? 'Growth' : 'Retirement'}</span></DashLabel>
          <p style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums">{money(pv)}</span><ChangePill value={2.14} /></p>
          <PriceChart area points={series('portfolio' + accountId + tf, COUNTS[tf], pv)} labels={[LABELS[tf][0], LABELS[tf][2], LABELS[tf][4]]} height={200} style={{ marginTop: 4, gridTemplateColumns: 'minmax(0,1fr) 3.5rem' }} />
          <TimeframeToggle value={tf} onChange={setTf} style={{ marginTop: 12, width: '100%', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }} />
        </DashCard>
        <DashCard padding={16}>
          <SectionHead title="Assets" action="View all" onAction={() => setTab('assets')} />
          {top.map((h, k) => <AssetRow key={h.i.symbol} h={h} last={k === top.length - 1} onClick={() => openOrder(h.i.symbol)} />)}
        </DashCard>
        <DashCard padding={16}>
          <SectionHead title="Watch List" action="View all" onAction={() => setTab('assets', 'watchlist')} />
          <WatchlistRows openOrder={openOrder} limit={4} />
        </DashCard>
        <DashCard padding={16}>
          <SectionHead title="Recent Transactions" action="View all" onAction={() => setTab('activity')} />
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{TRANSACTIONS.slice(0, 4).map((t, k) => <TxRow key={k} t={t} last={k === 3} />)}</ul>
        </DashCard>
      </div>
    );
  }

  function Chips({ value, onChange, options }) {
    return (
      <div role="group" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map((o) => {
          const on = o === value;
          return <button key={o} type="button" aria-pressed={on} onClick={() => onChange(o)} style={{ height: 32, padding: '0 14px', borderRadius: 9999, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid ' + (on ? 'rgba(0,187,255,.4)' : 'var(--border)'), background: on ? 'var(--primary-10)' : 'transparent', color: on ? 'var(--primary)' : 'var(--muted-foreground)', transition: 'all 150ms' }}>{o}</button>;
        })}
      </div>
    );
  }

  function MobileAssets({ openOrder, view, setView }) {
    const [sort, setSort] = React.useState('Value');
    const seg = <TimeframeToggle value={view === 'watchlist' ? 'Watch List' : 'Assets'} onChange={(v) => setView(v === 'Assets' ? 'assets' : 'watchlist')} options={['Assets', 'Watch List']} style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr' }} />;
    if (view === 'watchlist') return (
      <div style={pad}>
        {seg}
        <DashCard padding={16}><WatchlistRows openOrder={openOrder} /></DashCard>
      </div>
    );
    const holdings = holdingsOf();
    const invested = holdings.reduce((a, h) => a + h.value, 0);
    const gl = holdings.reduce((a, h) => a + h.gl, 0);
    const key = { Value: (h) => -h.value, 'Today %': (h) => -h.i.changePercent, 'Gain/Loss': (h) => -h.gl, Name: (h) => h.i.symbol };
    const rows = holdings.slice().sort((a, b) => { const x = key[sort](a), y = key[sort](b); return typeof x === 'string' ? x.localeCompare(y) : x - y; });
    return (
      <div style={pad}>
        {seg}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <DashCard padding={16}><DashLabel>Invested</DashLabel><p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums">{money(invested)}</p></DashCard>
          <DashCard padding={16}><DashLabel>Unrealized</DashLabel><p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', color: gl >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }} className="tabular-nums">{(gl >= 0 ? '+' : '') + money(gl)}</p></DashCard>
        </div>
        <Chips value={sort} onChange={setSort} options={['Value', 'Today %', 'Gain/Loss', 'Name']} />
        <DashCard padding={16}>
          {rows.map((h, k) => (
            <div key={h.i.symbol}>
              <AssetRow h={h} last onClick={() => openOrder(h.i.symbol)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '0 0 10px 48px', fontSize: 12, color: 'var(--muted-foreground)', borderBottom: k === rows.length - 1 ? 0 : '1px solid var(--border-60)' }} className="tabular-nums">
                <span>Avg {money(h.cost)}</span><span>{((h.value / invested) * 100).toFixed(1)}% of portfolio</span>
                <span style={{ color: h.gl >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>{(h.gl >= 0 ? '+' : '') + money(h.gl)}</span>
              </div>
            </div>
          ))}
        </DashCard>
      </div>
    );
  }

  function MobileActivity() {
    const [kind, setKind] = React.useState('All');
    const list = TRANSACTIONS.filter((t) => kind === 'All' || (kind === 'Trades' ? t.kind === 'trade' : t.kind === 'cash'));
    return (
      <div style={pad}>
        <Chips value={kind} onChange={setKind} options={['All', 'Trades', 'Cash']} />
        <DashCard padding={16}>
          {list.length ? <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{list.map((t, k) => <TxRow key={k} t={t} last={k === list.length - 1} />)}</ul>
            : <p style={{ margin: 0, padding: '16px 0', textAlign: 'center', fontSize: 14, color: 'var(--muted-foreground)' }}>No transactions yet.</p>}
        </DashCard>
      </div>
    );
  }
  Object.assign(window, { MobileHome, MobileAssets, MobileActivity, WatchlistRows, Chips });
})();
