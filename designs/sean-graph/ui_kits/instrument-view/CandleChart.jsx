(() => {
  const { money } = window.TSData;
  const { Icon } = window.TradingSeasonDesignSystem_86c3eb;
  const W = 1000, H = 100;
  const MIN_BARS = 20;

  // Bar timestamps for axis labels, per interval, ending at Sep 14 2026 3:55 PM.
  function barLabel(interval, idxFromEnd) {
    const end = Date.UTC(2026, 8, 14, 15, 55);
    const step = { '1m': 60e3, '5m': 300e3, '1h': 3600e3, '1D': 86400e3 }[interval] || 300e3;
    const d = new Date(end - idxFromEnd * step);
    const h = d.getUTCHours(), m = d.getUTCMinutes();
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
    const time = ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM');
    if (interval === '1D') return mon + ' ' + d.getUTCDate();
    if (interval === '1h') return mon + ' ' + d.getUTCDate() + ', ' + time;
    return time;
  }

  function ZoomBtn({ icon, label, onClick, disabled }) {
    const [h, setH] = React.useState(false);
    return (
      <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, background: h && !disabled ? 'var(--muted)' : 'transparent', color: h && !disabled ? 'var(--foreground)' : 'var(--muted-foreground)', transition: 'all 150ms' }}>
        <Icon name={icon} size={14} />
      </button>
    );
  }

  // OHLC candles + volume, with wheel/pinch zoom, drag pan, and zoom controls. Styled like PriceChart.
  function CandleChart({ data: all, mode = 'candles', ma = true, volume = true, interval = '5m', onHover }) {
    const N = all.length;
    const [view, setView] = React.useState(() => ({ start: Math.max(0, N - 78), count: Math.min(78, N) }));
    const [hi, setHi] = React.useState(null);
    const [drag, setDrag] = React.useState(null);
    const ref = React.useRef(null);

    const clamp = (start, count) => {
      const c = Math.max(MIN_BARS, Math.min(N, Math.round(count)));
      return { start: Math.max(0, Math.min(N - c, Math.round(start))), count: c };
    };
    const zoomAt = (factor, anchor = 1) => setView((v) => {
      const c = Math.max(MIN_BARS, Math.min(N, v.count * factor));
      return clamp(v.start + (v.count - c) * anchor, c);
    });

    React.useEffect(() => {
      const el = ref.current;
      const wheel = (e) => {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        const anchor = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          setView((v) => clamp(v.start + (e.deltaX / r.width) * v.count, v.count));
        } else {
          const f = Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
          setView((v) => { const c = Math.max(MIN_BARS, Math.min(N, v.count * f)); return clamp(v.start + (v.count - c) * anchor, c); });
        }
      };
      el.addEventListener('wheel', wheel, { passive: false });
      return () => el.removeEventListener('wheel', wheel);
    }, [N]);

    const data = all.slice(view.start, view.start + view.count);
    const n = data.length;
    const lo = Math.min(...data.map((d) => d.low)), top = Math.max(...data.map((d) => d.high));
    const pad = (top - lo) * 0.06, min = lo - pad, max = top + pad, range = max - min || 1;
    const priceH = volume ? 78 : 98;
    const y = (v) => ((max - v) / range) * priceH + 1;
    const step = W / n, bw = Math.max(0.6, step * 0.62);
    const vmax = Math.max(...data.map((d) => d.volume));
    const maAll = all.map((d, i) => { const s = all.slice(Math.max(0, i - 19), i + 1); return s.reduce((a, b) => a + b.close, 0) / s.length; });
    const maPts = maAll.slice(view.start, view.start + view.count);
    const toPath = (arr) => arr.map((v, i) => (i ? 'L' : 'M') + (i * step + step / 2).toFixed(1) + ',' + y(v).toFixed(2)).join(' ');
    const ticks = [0, 1, 2, 3, 4].map((i) => max - pad - ((range - 2 * pad) / 4) * i);
    const up = data[n - 1].close >= data[0].open;
    const last = all[N - 1];
    const lastVisible = view.start + view.count === N;
    const labelIdx = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.min(n - 1, Math.round(t * (n - 1))));

    const barAt = (clientX) => { const r = ref.current.getBoundingClientRect(); return Math.min(n - 1, Math.max(0, Math.floor(((clientX - r.left) / r.width) * n))); };
    const down = (e) => { ref.current.setPointerCapture(e.pointerId); setDrag({ x: e.clientX, start: view.start }); };
    const move = (e) => {
      if (drag) {
        const r = ref.current.getBoundingClientRect();
        setView((v) => clamp(drag.start - ((e.clientX - drag.x) / r.width) * v.count, v.count));
        return;
      }
      const k = barAt(e.clientX); setHi(k); onHover && onHover(data[k]);
    };
    const up_ = () => setDrag(null);
    const leave = () => { if (!drag) { setHi(null); onHover && onHover(null); } };
    const key = (e) => {
      const map = { ArrowLeft: () => setView((v) => clamp(v.start - Math.max(1, v.count * 0.1), v.count)), ArrowRight: () => setView((v) => clamp(v.start + Math.max(1, v.count * 0.1), v.count)), '+': () => zoomAt(0.8), '=': () => zoomAt(0.8), '-': () => zoomAt(1.25), '0': () => setView(clamp(N - 78, 78)) };
      if (map[e.key]) { e.preventDefault(); map[e.key](); }
    };

    return (
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 4.75rem', gridTemplateRows: 'minmax(0,1fr) 1rem', columnGap: 12, rowGap: 8, height: '100%', minHeight: 0 }}>
        <div ref={ref} tabIndex={0} role="group" aria-label="Price chart. Scroll to zoom, drag to pan, arrow keys to move, plus and minus to zoom."
          onPointerDown={down} onPointerMove={move} onPointerUp={up_} onPointerCancel={up_} onPointerLeave={leave} onKeyDown={key} onDoubleClick={() => setView(clamp(N - 78, 78))}
          style={{ position: 'relative', minHeight: 0, cursor: drag ? 'grabbing' : 'crosshair', touchAction: 'none', outline: 'none', borderRadius: 2, userSelect: 'none' }}>
          <svg viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden' }} aria-hidden="true">
            {ticks.map((t) => <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="rgba(238,250,255,.09)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />)}
            {labelIdx.map((k, j) => <line key={'x' + j} x1={k * step + step / 2} x2={k * step + step / 2} y1="0" y2={H} stroke="rgba(238,250,255,.0525)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />)}
            {volume ? <line x1="0" x2={W} y1={priceH + 2} y2={priceH + 2} stroke="var(--border)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" /> : null}
            <line x1="0" x2={W} y1={H} y2={H} stroke="var(--border)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
            {volume ? data.map((d, i) => { const h = (d.volume / vmax) * (H - priceH - 5); return <rect key={'v' + i} x={i * step + (step - bw) / 2} y={H - h} width={bw} height={h} fill={d.close >= d.open ? 'rgba(51,255,0,.28)' : 'rgba(255,0,55,.3)'} />; }) : null}
            {mode === 'candles' ? data.map((d, i) => {
              const c = d.close >= d.open ? '#33ff00' : '#ff0037';
              const x = i * step + step / 2;
              const bt = y(Math.max(d.open, d.close)), bb = y(Math.min(d.open, d.close));
              return (
                <g key={i} opacity={hi == null || hi === i ? 1 : 0.55}>
                  <line x1={x} x2={x} y1={y(d.high)} y2={y(d.low)} stroke={c} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                  <rect x={x - bw / 2} y={bt} width={bw} height={Math.max(0.25, bb - bt)} fill={c} />
                </g>
              );
            }) : <path d={toPath(data.map((d) => d.close))} fill="none" stroke={up ? 'var(--color-gain)' : 'var(--color-loss)'} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
            {ma ? <path d={toPath(maPts)} fill="none" stroke="#58c9f4" strokeWidth="1.5" strokeOpacity="0.9" vectorEffect="non-scaling-stroke" /> : null}
            {last.close >= min && last.close <= max ? <line x1="0" x2={W} y1={y(last.close)} y2={y(last.close)} stroke={last.close >= all[0].open ? '#33ff00' : '#ff0037'} strokeOpacity="0.5" strokeDasharray="3 4" strokeWidth="1" vectorEffect="non-scaling-stroke" /> : null}
          </svg>
          {hi != null && !drag ? <div style={{ position: 'absolute', top: 0, bottom: 0, left: ((hi + 0.5) / n) * 100 + '%', width: 1, background: 'var(--foreground-40)', pointerEvents: 'none' }} /> : null}
          <div onPointerDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 6, left: 6, display: 'flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 8, background: 'rgba(20,20,20,.85)', border: '1px solid var(--border)', backdropFilter: 'blur(4px)' }}>
            <ZoomBtn icon="zoom-out" label="Zoom out" disabled={view.count >= N} onClick={() => zoomAt(1.25)} />
            <ZoomBtn icon="zoom-in" label="Zoom in" disabled={view.count <= MIN_BARS} onClick={() => zoomAt(0.8)} />
            <span style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 2px' }} />
            <ZoomBtn icon="chevron-left" label="Pan left" disabled={view.start === 0} onClick={() => setView((v) => clamp(v.start - v.count * 0.25, v.count))} />
            <ZoomBtn icon="chevron-right" label="Pan right" disabled={lastVisible} onClick={() => setView((v) => clamp(v.start + v.count * 0.25, v.count))} />
            <ZoomBtn icon="rotate-ccw" label="Reset view" onClick={() => setView(clamp(N - 78, 78))} />
            <span style={{ padding: '0 6px', fontSize: 11, color: 'var(--muted-foreground)' }} className="tabular-nums">{view.count} bars</span>
          </div>
          {!lastVisible ? (
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setView((v) => clamp(N - v.count, v.count))}
              style={{ position: 'absolute', right: 8, bottom: volume ? '24%' : 8, display: 'flex', alignItems: 'center', gap: 4, height: 26, padding: '0 10px', borderRadius: 9999, border: '1px solid rgba(0,187,255,.4)', background: 'var(--primary-15)', color: 'var(--primary)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              Latest <Icon name="chevrons-right" size={12} />
            </button>
          ) : null}
        </div>
        <div style={{ position: 'relative', borderLeft: '1px solid rgba(238,250,255,.105)', fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'right', overflow: 'hidden' }} className="tabular-nums">
          {ticks.map((t) => <span key={t} style={{ position: 'absolute', right: 0, top: y(t) + '%', transform: 'translateY(-50%)' }}>{money(t)}</span>)}
          {last.close >= min && last.close <= max ? <span style={{ position: 'absolute', right: 0, top: y(last.close) + '%', transform: 'translateY(-50%)', padding: '1px 5px', borderRadius: 4, fontWeight: 600, color: 'var(--primary-foreground)', background: last.close >= all[0].open ? 'var(--color-gain)' : 'var(--color-loss)' }}>{last.close.toFixed(2)}</span> : null}
          {volume ? <span style={{ position: 'absolute', right: 0, top: priceH + 4 + '%' }}>Vol</span> : null}
        </div>
        <div style={{ position: 'relative', height: 16, fontSize: 12, color: 'var(--muted-foreground)' }}>
          {labelIdx.map((k, j) => { const x = ((k + 0.5) / n) * 100; return <span key={j} style={{ position: 'absolute', left: x + '%', transform: x < 12 ? 'none' : x > 88 ? 'translateX(-100%)' : 'translateX(-50%)', whiteSpace: 'nowrap' }}>{barLabel(interval, N - 1 - (view.start + k))}</span>; })}
        </div>
        <div />
      </div>
    );
  }
  window.CandleChart = CandleChart;
})();
