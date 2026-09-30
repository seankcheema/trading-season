(() => {
  const { DashCard, DashLabel, DashLink, ChangePill, TimeframeToggle, Button, Icon, InstrumentSearch } = window.TradingSeasonDesignSystem_86c3eb;
  const { INSTRUMENTS, POSITIONS, candles, money, pct, find } = window.TSData;

  const head = { color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' };
  const vol = (v) => (v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : (v / 1e3).toFixed(0) + 'K');

  function Stat({ k, v, tone }) {
    return <div style={{ minWidth: 0 }}><div style={head}>{k}</div><div style={{ marginTop: 4, fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', color: tone }} className="tabular-nums">{v}</div></div>;
  }
  function Toggle({ on, children, onClick }) {
    return <button type="button" aria-pressed={on} onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', borderRadius: 9999, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid ' + (on ? 'rgba(0,187,255,.4)' : 'var(--border)'), background: on ? 'var(--primary-10)' : 'transparent', color: on ? 'var(--primary)' : 'var(--muted-foreground)', transition: 'all 150ms' }}>{children}</button>;
  }
  function Meter({ label, value, hint }) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--muted-foreground)' }}>{label}</span><span className="tabular-nums">{value.toFixed(2)} <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>· {hint}</span></span></div>
        <div style={{ marginTop: 6, height: 6, borderRadius: 9999, background: 'rgba(255,255,255,.1)', overflow: 'hidden' }}><div style={{ width: value * 100 + '%', height: '100%', borderRadius: 9999, background: 'var(--primary)' }} /></div>
      </div>
    );
  }

  function InstrumentView({ symbol, setSymbol }) {
    const i = find(symbol);
    const [iv, setIv] = React.useState('5m');
    const [mode, setMode] = React.useState('Candles');
    const [ma, setMa] = React.useState(true);
    const [showVol, setShowVol] = React.useState(true);
    const [hover, setHover] = React.useState(null);
    const data = React.useMemo(() => candles(symbol + iv, 240, i.price), [symbol, iv]);
    const day = data.slice(-78);
    const o = hover || data[data.length - 1];
    const open = day[0].open, high = Math.max(...day.map((d) => d.high)), low = Math.min(...day.map((d) => d.low));
    const totalVol = day.reduce((a, d) => a + d.volume, 0);
    const spread = Math.max(0.01, i.price * 0.0004);
    const bid = i.price - spread / 2, ask = i.price + spread / 2;
    const pos = POSITIONS[symbol];
    const behaviors = [
      { type: 'Momentum burst', start: '2:58 PM', dur: '420s', strength: 0.72, tone: 'gain' },
      { type: 'Volume spike', start: '1:12 PM', dur: '180s', strength: 0.55, tone: 'primary' },
      { type: 'Mean reversion', start: '11:40 AM', dur: '900s', strength: 0.38, tone: 'loss' },
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
        <DashCard padding={16} style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <InstrumentBadge symbol={i.symbol} size={44} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em' }}>{i.symbol}</span><ChangePill tag tone="muted">Equity</ChangePill><ChangePill tag tone="muted">SIM</ChangePill></div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{i.name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums">{money(i.price)}</span>
            <ChangePill tone={i.change >= 0 ? 'gain' : 'loss'}>{(i.change >= 0 ? '+' : '') + money(i.change) + ' (' + pct(i.changePercent) + ')'}</ChangePill>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, auto)', columnGap: 28, marginLeft: 'auto' }}>
            <Stat k="Bid" v={money(bid)} tone="var(--color-gain)" />
            <Stat k="Ask" v={money(ask)} tone="var(--color-loss)" />
            <Stat k="Spread" v={money(spread, 3)} />
            <Stat k="Day range" v={low.toFixed(2) + ' – ' + high.toFixed(2)} />
            <Stat k="Volume" v={vol(totalVol)} />
            <Stat k="Trend" v="Uptrend" tone="var(--color-gain)" />
          </div>
        </DashCard>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 12, flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, minWidth: 0 }}>
            <DashCard style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TimeframeToggle value={mode} onChange={setMode} options={['Candles', 'Line']} />
                  <Toggle on={ma} onClick={() => setMa(!ma)}><span style={{ width: 10, height: 2, background: '#58c9f4', borderRadius: 1 }} />MA 20</Toggle>
                  <Toggle on={showVol} onClick={() => setShowVol(!showVol)}>Volume</Toggle>
                </div>
                <TimeframeToggle value={iv} onChange={setIv} options={['1m', '5m', '1h', '1D']} />
              </div>
              <div style={{ margin: '12px 0 8px', display: 'flex', gap: 16, fontSize: 13, color: 'var(--muted-foreground)', minHeight: 20 }} className="tabular-nums">
                {[['O', o.open], ['H', o.high], ['L', o.low], ['C', o.close]].map(([k, v]) => <span key={k}>{k} <span style={{ color: o.close >= o.open ? 'var(--color-gain)' : 'var(--color-loss)' }}>{v.toFixed(2)}</span></span>)}
                <span>Vol <span style={{ color: 'var(--foreground)' }}>{vol(o.volume)}</span></span>
                {hover ? null : <span>· latest bar</span>}
                <span style={{ marginLeft: 'auto', fontSize: 12 }}>Scroll to zoom · drag to pan · double-click to reset</span>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <CandleChart key={symbol + iv} data={data} mode={mode === 'Candles' ? 'candles' : 'line'} ma={ma} volume={showVol} interval={iv} onHover={setHover} />
              </div>
            </DashCard>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, flexShrink: 0 }}>
              <DashCard>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Key stats</h2>
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14, columnGap: 12 }}>
                  <Stat k="Open" v={money(open)} /><Stat k="Prev close" v={money(i.price - i.change)} />
                  <Stat k="High" v={money(high)} /><Stat k="Low" v={money(low)} />
                  <Stat k="Avg volume" v={vol(totalVol * 0.86)} /><Stat k="Base volatility" v="0.021" />
                </div>
              </DashCard>
              <DashCard>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Market state</h2><ChangePill tag tone="gain">Uptrend</ChangePill></div>
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Meter label="Volatility" value={0.34} hint="moderate" />
                  <Meter label="Liquidity" value={0.81} hint="deep" />
                  <Meter label="Momentum" value={0.62} hint="building" />
                </div>
              </DashCard>
              <DashCard>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Market behaviors</h2><DashLabel as="span" style={{ fontSize: 11 }}>Today</DashLabel></div>
                <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
                  {behaviors.map((b) => (
                    <li key={b.type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-60)', fontSize: 14 }}>
                      <span><span style={{ display: 'block', fontWeight: 500 }}>{b.type}</span><span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }} className="tabular-nums">{b.start} · {b.dur}</span></span>
                      <ChangePill tone={b.tone}>{'Strength ' + b.strength.toFixed(2)}</ChangePill>
                    </li>
                  ))}
                </ul>
              </DashCard>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
            <DashCard padding={16} style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Your position</h2><DashLabel as="span" style={{ fontSize: 11 }}>Growth</DashLabel></div>
              {pos ? (
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 12 }}>
                  <Stat k="Shares" v={pos.shares} /><Stat k="Avg price" v={money(pos.cost)} />
                  <Stat k="Market value" v={money(pos.shares * i.price)} /><Stat k="Unrealized" v={(i.price >= pos.cost ? '+' : '') + money(pos.shares * (i.price - pos.cost))} tone={i.price >= pos.cost ? 'var(--color-gain)' : 'var(--color-loss)'} />
                </div>
              ) : <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--muted-foreground)' }}>You don't hold {i.symbol} in this account.</p>}
            </DashCard>
            <DashCard padding={16} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}><OrderTicket key={symbol} instrument={i} style={{ flex: 1 }} /></DashCard>
          </div>
        </div>
      </div>
    );
  }
  window.InstrumentView = InstrumentView;
})();
