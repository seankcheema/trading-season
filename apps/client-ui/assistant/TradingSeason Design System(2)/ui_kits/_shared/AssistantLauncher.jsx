(() => {
  const { Icon, ChangePill } = window.TradingSeasonDesignSystem_86c3eb;
  const { INSTRUMENTS, POSITIONS, money, pct, find } = window.TSData;

  // 1a shark mark (assets/assistant/shark-mark-currentcolor.svg), inlined so it inherits color and animates on hover.
  function SharkMark({ size = 56 }) {
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ display: 'block' }}>
        <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path className="ts-shark-fin" d="M29.5 33.8 C30.6 28.4 33.3 25 37.2 23.6 C36.5 27 36.6 30.6 37.8 34.4" />
          <path d="M12 68 C12 45 20.5 33.5 32 33.5 C43.5 33.5 52 45 52 68" />
          <path d="M44.5 48.5 l2.6 -2.6 M45.5 53 l2.6 -2.6" />
          <path d="M28.6 53 q3.4 2.4 6.8 0" />
        </g>
        <g className="ts-shark-eyes" fill="currentColor"><circle cx="26.5" cy="45" r="2.1" /><circle cx="37.5" cy="45" r="2.1" /></g>
      </svg>
    );
  }

  let styled = false;
  function injectStyles() {
    if (styled) return; styled = true;
    const s = document.createElement('style');
    s.textContent = '.ts-shark-fab{transition:transform 150ms cubic-bezier(.16,1,.3,1),box-shadow 150ms}.ts-shark-fab:hover{transform:translateY(-2px);box-shadow:0 12px 28px -8px rgba(0,0,0,.75)}.ts-shark-fab:active{transform:translateY(0)}.ts-shark-fab:focus-visible{outline:none;box-shadow:0 0 0 3px var(--ring-50)}' +
      '.ts-shark-fin,.ts-shark-eyes{transform-box:fill-box}.ts-shark-fin{transform-origin:50% 100%}.ts-shark-eyes{transform-origin:center}' +
      '.ts-shark-fab:hover .ts-shark-fin{animation:ts-fin 600ms ease-in-out}.ts-shark-fab:hover .ts-shark-eyes{animation:ts-blink 600ms ease-in-out}' +
      '@keyframes ts-fin{0%,100%{transform:rotate(0)}30%{transform:rotate(-8deg)}65%{transform:rotate(5deg)}}@keyframes ts-blink{0%,40%,60%,100%{transform:scaleY(1)}50%{transform:scaleY(.1)}}' +
      '@keyframes ts-dot{0%,100%{opacity:.3}50%{opacity:1}}@keyframes ts-panel-in{from{opacity:0;transform:translateY(8px) scale(.98)}}';
    document.head.appendChild(s);
  }

  const holdings = () => Object.entries(POSITIONS).map(([sym, p]) => { const i = find(sym); return { i, ...p, value: p.shares * i.price, gl: p.shares * (i.price - p.cost) }; });
  const tone = (v) => ({ color: v >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' });
  const H = ({ children }) => <h3 style={{ margin: '14px 0 6px', color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{children}</h3>;
  const P = ({ children }) => <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, textWrap: 'pretty' }}>{children}</p>;
  const Line = ({ k, v, style }) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', fontSize: 14, borderBottom: '1px solid var(--border-60)' }}><span style={{ color: 'var(--muted-foreground)' }}>{k}</span><span className="tabular-nums" style={style}>{v}</span></div>;
  const Mover = ({ i }) => <Line k={<span><span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{i.symbol}</span> {i.name.split(' ')[0].replace(/[,.]$/, '')}</span>} v={pct(i.changePercent)} style={tone(i.changePercent)} />;

  function DailyReview() {
    const spy = find('SPY');
    const sorted = INSTRUMENTS.slice().sort((a, b) => b.changePercent - a.changePercent);
    const up = INSTRUMENTS.filter((i) => i.changePercent >= 0).length;
    return (
      <div>
        <P>The market is <b style={tone(spy.changePercent)}>{spy.changePercent >= 0 ? 'up' : 'down'}</b> today. SPY is at {money(spy.price)} ({pct(spy.changePercent)}), with {up} of {INSTRUMENTS.length} tracked stocks higher.</P>
        <H>Top gainers</H>{sorted.slice(0, 3).map((i) => <Mover key={i.symbol} i={i} />)}
        <H>Top decliners</H>{sorted.slice(-2).reverse().map((i) => <Mover key={i.symbol} i={i} />)}
        <H>Worth noting</H>
        <P>{sorted[0].symbol} leads the session. {sorted[sorted.length - 1].symbol} is the weakest name and is trading below its open.</P>
      </div>
    );
  }

  function HoldingsAnalysis() {
    const hs = holdings();
    const total = hs.reduce((a, h) => a + h.value, 0);
    const gl = hs.reduce((a, h) => a + h.gl, 0);
    const big = hs.slice().sort((a, b) => b.value - a.value)[0];
    const share = (big.value / total) * 100;
    const byGl = hs.slice().sort((a, b) => b.gl - a.gl);
    const today = hs.reduce((a, h) => a + h.shares * h.i.change, 0);
    return (
      <div>
        <P>You hold {hs.length} stocks worth <b className="tabular-nums">{money(total)}</b>. Since purchase they're <b style={tone(gl)} className="tabular-nums">{(gl >= 0 ? '+' : '') + money(gl)}</b>, and today they've moved <span style={tone(today)} className="tabular-nums">{(today >= 0 ? '+' : '') + money(today)}</span>.</P>
        <H>Performance</H>
        <Line k={'Best · ' + byGl[0].i.symbol} v={(byGl[0].gl >= 0 ? '+' : '') + money(byGl[0].gl)} style={tone(byGl[0].gl)} />
        <Line k={'Worst · ' + byGl[byGl.length - 1].i.symbol} v={(byGl[byGl.length - 1].gl >= 0 ? '+' : '') + money(byGl[byGl.length - 1].gl)} style={tone(byGl[byGl.length - 1].gl)} />
        <H>Concentration</H>
        <Line k={'Largest · ' + big.i.symbol} v={share.toFixed(1) + '% of holdings'} />
        <div style={{ marginTop: 8 }}>
          <P>{share > 30 ? big.i.symbol + ' is over 30% of your holdings, so its moves drive most of your returns. Spreading across more names would lower that risk.' : 'No single stock is more than 30% of your holdings, so your risk is reasonably spread out.'}</P>
        </div>
      </div>
    );
  }

  function StockAnalysis({ instrument }) {
    const i = instrument;
    const pos = POSITIONS[i.symbol];
    const peers = INSTRUMENTS.filter((x) => x.symbol !== 'SPY');
    const rank = peers.slice().sort((a, b) => b.changePercent - a.changePercent).findIndex((x) => x.symbol === i.symbol) + 1;
    const spy = find('SPY');
    const vsMkt = i.changePercent - spy.changePercent;
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{i.symbol}</span>
          <span style={{ fontSize: 14 }} className="tabular-nums">{money(i.price)}</span>
          <ChangePill value={i.changePercent} />
        </div>
        <div style={{ marginTop: 10 }}><P>{i.name} is {vsMkt >= 0 ? 'outperforming' : 'lagging'} the market today by {Math.abs(vsMkt).toFixed(2)} points{rank ? ', ranking ' + rank + ' of ' + peers.length + ' tracked stocks' : ''}.</P></div>
        <H>Today</H>
        <Line k="Change" v={(i.change >= 0 ? '+' : '') + money(i.change)} style={tone(i.change)} />
        <Line k="vs SPY" v={(vsMkt >= 0 ? '+' : '') + vsMkt.toFixed(2) + ' pts'} style={tone(vsMkt)} />
        <H>Your position</H>
        {pos ? (
          <>
            <Line k="Shares" v={pos.shares} />
            <Line k="Avg price" v={money(pos.cost)} />
            <Line k="Unrealized" v={(i.price >= pos.cost ? '+' : '') + money(pos.shares * (i.price - pos.cost))} style={tone(i.price - pos.cost)} />
          </>
        ) : <P>You don't own {i.symbol} yet. Use the trade ticket to place an order.</P>}
      </div>
    );
  }

  const OPTIONS = {
    daily: { icon: 'newspaper', title: 'Daily market review', sub: 'What moved today and why it matters', View: DailyReview },
    holdings: { icon: 'chart-pie', title: 'Analyze my holdings', sub: 'Performance, concentration and risk', View: HoldingsAnalysis },
    stock: { icon: 'scan-search', title: 'Analyze this stock', View: StockAnalysis },
  };

  function OptionButton({ o, sub, onClick }) {
    const [h, setH] = React.useState(false);
    return (
      <button type="button" onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', border: '1px solid ' + (h ? 'rgba(0,187,255,.4)' : 'var(--border)'), borderRadius: 12, background: h ? 'var(--primary-10)' : 'transparent', cursor: 'pointer', textAlign: 'left', color: 'var(--foreground)', transition: 'all 150ms' }}>
        <span style={{ display: 'flex', width: 32, height: 32, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'var(--primary-15)', color: 'var(--primary)' }}><Icon name={o.icon} size={16} /></span>
        <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{o.title}</span><span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }}>{sub || o.sub}</span></span>
        <Icon name="chevron-right" size={16} style={{ color: h ? 'var(--primary)' : 'var(--muted-foreground)' }} />
      </button>
    );
  }

  function Thinking() {
    return <div role="status" aria-label="Analyzing" style={{ display: 'flex', gap: 5, padding: '6px 0' }}>{[0, 1, 2].map((k) => <span key={k} style={{ width: 7, height: 7, borderRadius: 9999, background: 'var(--primary)', animation: 'ts-dot 900ms ease-in-out ' + k * 150 + 'ms infinite' }} />)}</div>;
  }

  // Floating assistant: fixed bottom-right launcher → panel with analysis options.
  // instrument (optional) adds "Analyze this stock" for the instrument on screen.
  function AssistantLauncher({ instrument }) {
    injectStyles();
    const [open, setOpen] = React.useState(false);
    const [view, setView] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const ref = React.useRef(null);
    React.useEffect(() => { setView((v) => (v === 'stock' ? null : v)); }, [instrument && instrument.symbol]);
    React.useEffect(() => {
      if (!open) return;
      const k = (e) => { if (e.key === 'Escape') setOpen(false); };
      const c = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      document.addEventListener('keydown', k); document.addEventListener('mousedown', c);
      return () => { document.removeEventListener('keydown', k); document.removeEventListener('mousedown', c); };
    }, [open]);
    const choose = (k) => { setView(k); setBusy(true); setTimeout(() => setBusy(false), 700); };
    const keys = instrument ? ['stock', 'daily', 'holdings'] : ['daily', 'holdings'];
    const o = view && OPTIONS[view];
    const title = o ? (view === 'stock' ? 'Analyze ' + instrument.symbol : o.title) : 'Assistant';
    return (
      <div ref={ref} style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 45 }}>
        {open ? (
          <section role="dialog" aria-label={title} style={{ position: 'absolute', right: 0, bottom: 68, width: 360, maxHeight: 'min(560px, calc(100vh - 120px))', display: 'flex', flexDirection: 'column', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-dialog)', transformOrigin: '100% 100%', animation: 'ts-panel-in 200ms cubic-bezier(.16,1,.3,1) both' }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              {o ? (
                <button type="button" aria-label="Back to options" onClick={() => setView(null)} style={{ display: 'flex', width: 28, height: 28, alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 8, background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer' }}><Icon name="chevron-left" size={16} /></button>
              ) : <span style={{ display: 'flex', width: 28, height: 28, borderRadius: 9999, overflow: 'hidden', background: '#eefaff', color: '#0e0e0e' }}><SharkMark size={28} /></span>}
              <h2 style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h2>
              <button type="button" aria-label="Close assistant" onClick={() => setOpen(false)} style={{ display: 'flex', width: 28, height: 28, alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 8, background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer' }}><Icon name="x" size={16} /></button>
            </header>
            <div className="ts-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14 }}>
              {!o ? (
                <>
                  <p style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: '12px 12px 12px 4px', background: 'var(--muted)', fontSize: 14, lineHeight: 1.45 }}>Hi! What would you like me to look at?</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {keys.map((k) => <OptionButton key={k} o={OPTIONS[k]} sub={k === 'stock' ? instrument.name + ' · price, momentum, your position' : null} onClick={() => choose(k)} />)}
                  </div>
                </>
              ) : busy ? <Thinking /> : (
                <div style={{ animation: 'ts-fade-in 200ms ease-out both' }}>
                  <o.View instrument={instrument} />
                  <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>Based on simulated market data. Not financial advice.</p>
                </div>
              )}
            </div>
          </section>
        ) : null}
        <button type="button" className="ts-shark-fab" aria-label={open ? 'Close assistant' : 'Open assistant'} aria-expanded={open} onClick={() => setOpen(!open)}
          style={{ display: 'flex', width: 56, height: 56, alignItems: 'center', justifyContent: 'center', padding: 0, border: 0, borderRadius: 9999, overflow: 'hidden', cursor: 'pointer', background: '#eefaff', color: '#0e0e0e', boxShadow: '0 8px 24px -8px rgba(0,0,0,.7)' }}>
          {open ? <Icon name="x" size={22} /> : <SharkMark size={56} />}
        </button>
      </div>
    );
  }
  Object.assign(window, { AssistantLauncher, SharkMark });
})();
