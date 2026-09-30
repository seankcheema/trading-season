(() => {
  const { DashCard, DashLabel, DashLink, ChangePill, TimeframeToggle, PriceChart, Sparkline, Button, Icon } = window.TradingSeasonDesignSystem_86c3eb;
  const { series, money } = window.TSData;
  const { FEED, STATUS, TOP } = window.TSReport;

  const RANGE_LABELS = { Today: ['9:30 AM', '11:00 AM', '12:30 PM', '2:00 PM', '3:30 PM'], '7D': ['Sep 8', 'Sep 9', 'Sep 10', 'Sep 11', 'Sep 14'], '30D': ['Aug 18', 'Aug 25', 'Sep 1', 'Sep 8', 'Sep 14'], '90D': ['Jun 16', 'Jul 14', 'Aug 11', 'Sep 8', 'Sep 14'] };
  const FEED_ICON = { fill: ['arrow-right-left', 'var(--primary)'], reject: ['circle-x', 'var(--color-loss)'], cash: ['wallet', 'var(--color-gain)'], lock: ['lock', 'var(--color-loss)'] };

  function Kpi({ label, value, delta, note }) {
    return (
      <DashCard padding={16}>
        <DashLabel>{label}</DashLabel>
        <p style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums">{value}</p>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted-foreground)' }}>{delta != null ? <ChangePill value={delta} /> : null}<span>{note}</span></div>
      </DashCard>
    );
  }

  function ActivityScreen({ go }) {
    const [range, setRange] = React.useState('Today');
    const total = STATUS.reduce((a, s) => a + s[1], 0);
    return (
      <div style={screenRoot}>
        <PageHeader title="Activity" sub="Derived from order and cash ledgers · updated 3:45 PM CT · simulation session #12"
          right={<><TimeframeToggle value={range} onChange={setRange} options={['Today', '7D', '30D', '90D']} /><ExportMenu onCsv={() => downloadCsv('activity-' + range, [['Status', (s) => s[0]], ['Orders', (s) => s[1]]], STATUS)} /></>} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12, flexShrink: 0 }}>
          <Kpi label="Orders" value="1,424" delta={8.4} note="vs prior period" />
          <Kpi label="Fill rate" value="90.2%" delta={-1.1} note="1,284 filled" />
          <Kpi label="Rejected" value="67" note="41 insufficient cash" />
          <Kpi label="Net cash flow" value="+$84,210" delta={3.2} note="deposits – withdrawals" />
          <Kpi label="Active traders" value="312" delta={4.7} note="placed ≥ 1 order" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 12, flex: 1, minHeight: 0 }}>
          <DashCard style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <DashLabel>Notional traded</DashLabel>
            <p style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums">$6,043,598</span><ChangePill value={8.4} /></p>
            <PriceChart area points={series('notional' + range, 27, 6043598)} labels={RANGE_LABELS[range]} height="100%" style={{ marginTop: 4, flex: 1, minHeight: 0 }} />
          </DashCard>
          <DashCard style={{ minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Orders by status</h2><DashLink onClick={() => go('orders')}>Open orders</DashLink></div>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {STATUS.map(([s, n, tone]) => (
                <div key={s}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><StatusPill status={s} /><span className="tabular-nums">{n.toLocaleString()} <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>{((n / total) * 100).toFixed(1)}%</span></span></div>
                  <div style={{ marginTop: 8, height: 6, borderRadius: 9999, background: 'rgba(255,255,255,.1)', overflow: 'hidden' }}><div style={{ height: '100%', width: (n / total) * 100 + '%', borderRadius: 9999, background: { gain: 'var(--color-gain)', primary: 'var(--primary)', loss: 'var(--color-loss)', muted: 'var(--muted-foreground)' }[tone] }} /></div>
                </div>
              ))}
            </div>
          </DashCard>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12, flex: 1, minHeight: 0 }}>
          <DashCard style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Live activity</h2><span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted-foreground)' }}><span style={{ width: 6, height: 6, borderRadius: 9999, background: 'var(--color-gain)' }} />Streaming</span></div>
            <ul className="ts-scroll" style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, ...scrollList }}>
              {FEED.map((f, k) => (
                <li key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: k < FEED.length - 1 ? '1px solid var(--border-60)' : 0, fontSize: 14 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--muted)', color: FEED_ICON[f.kind][1] }}><Icon name={FEED_ICON[f.kind][0]} size={14} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>{f.text}<span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }}>{f.t}</span></span>
                  <span className="tabular-nums" style={{ flexShrink: 0 }}>{f.v}</span>
                </li>
              ))}
            </ul>
          </DashCard>
          <DashCard style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Most traded</h2>
            <div style={{ ...tableHead, marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.8fr 1fr', gap: 8 }}><span>Asset</span><span>Today</span><span style={{ textAlign: 'right' }}>Orders</span><span style={{ textAlign: 'right' }}>Notional</span></div>
            <div className="ts-scroll" style={scrollList}>
            {TOP.map(([s, n, v]) => (
              <div key={s} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.8fr 1fr', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-60)', fontSize: 14 }}>
                <span style={{ fontWeight: 500 }}>{s}</span><Sparkline points={series(s + 'rep', 27, 100)} /><span style={{ textAlign: 'right' }} className="tabular-nums">{n}</span><span style={{ textAlign: 'right' }} className="tabular-nums">{money(v, 0)}</span>
              </div>
            ))}
            </div>
          </DashCard>
        </div>
      </div>
    );
  }
  window.ActivityScreen = ActivityScreen;
})();
