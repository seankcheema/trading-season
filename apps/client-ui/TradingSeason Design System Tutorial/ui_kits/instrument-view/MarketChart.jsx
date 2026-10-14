(() => {
  const { Icon } = window.TradingSeasonDesignSystem_86c3eb;
  const { money } = window.TSData;

  const IND_COLORS = { sma: '#f6c453', ema: '#b784ff', bollinger: '#ff8f66', rsi: '#42d3ff' };
  const MIN_BARS = 12, W = 1000, H = 100;
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const sma = (c, p) => c.map((_, i) => (i < p - 1 ? null : avg(c.slice(i - p + 1, i + 1))));
  const ema = (c, p) => { const k = 2 / (p + 1); let e = null; return c.map((v, i) => { e = e == null ? v : v * k + e * (1 - k); return i < p - 1 ? null : e; }); };
  const boll = (c, p) => { const m = sma(c, p); return c.map((_, i) => { if (m[i] == null) return null; const sd = Math.sqrt(avg(c.slice(i - p + 1, i + 1).map((v) => (v - m[i]) ** 2))); return [m[i] + 2 * sd, m[i] - 2 * sd]; }); };
  const rsi = (c, p) => { let g = 0, l = 0; return c.map((v, i) => { if (!i) return null; const d = v - c[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0); if (i < p) { g += up; l += dn; return null; } if (i === p) { g = (g + up) / p; l = (l + dn) / p; } else { g = (g * (p - 1) + up) / p; l = (l * (p - 1) + dn) / p; } return 100 - 100 / (1 + g / (l || 1e-9)); }); };

  function CtrlBtn({ icon, label, onClick, disabled }) {
    const [h, setH] = React.useState(false);
    return (
      <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 6, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1, background: h && !disabled ? 'rgba(0,187,255,.1)' : 'transparent', color: h && !disabled ? 'var(--foreground)' : 'rgba(238,250,255,.7)', transition: 'all 150ms' }}>
        <Icon name={icon} size={14} />
      </button>
    );
  }

  // Interactive market chart (app-price-chart interactive): modes, indicators, current-price label, wheel/drag pan-zoom.
  function MarketChart({ data, mode = 'candles', indicators = [], labelFor, initialCount }) {
    const N = data.length;
    const init = () => { const c = Math.min(N, initialCount || N); return { start: N - c, count: c }; };
    const [view, setView] = React.useState(init);
    const [hi, setHi] = React.useState(null);
    const [drag, setDrag] = React.useState(null);
    const ref = React.useRef(null);
    const clamp = (s, c) => { c = Math.round(Math.max(MIN_BARS, Math.min(N, c))); return { start: Math.max(0, Math.min(N - c, Math.round(s))), count: c }; };
    const zoom = (f, anchor = 1) => setView((v) => { const c = Math.max(MIN_BARS, Math.min(N, v.count * f)); return clamp(v.start + (v.count - c) * anchor, c); });
    React.useEffect(() => {
      const el = ref.current; if (!el) return;
      const wheel = (e) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoom(e.deltaY > 0 ? 1.12 : 0.89, (e.clientX - r.left) / r.width); };
      el.addEventListener('wheel', wheel, { passive: false });
      return () => el.removeEventListener('wheel', wheel);
    });

    const closes = data.map((d) => d.close);
    const vis = data.slice(view.start, view.start + view.count);
    const n = vis.length, step = W / n, bw = Math.max(1, step * 0.62);
    const base = vis[0].open;
    const pctMode = mode === 'percent', volMode = mode === 'volume';
    const tx = (v) => (pctMode ? (v / base - 1) * 100 : v);
    const ov = {};
    if (indicators.includes('sma')) ov.sma = sma(closes, 20);
    if (indicators.includes('ema')) ov.ema = ema(closes, 20);
    if (indicators.includes('bollinger')) ov.bollinger = boll(closes, 20);
    const showRsi = indicators.includes('rsi');
    const rsiVals = showRsi ? rsi(closes, 14) : null;
    const slice = (a) => a.slice(view.start, view.start + view.count);

    let lo, hiV;
    if (volMode) { lo = 0; hiV = Math.max(...vis.map((d) => d.volume)) * 1.08; }
    else {
      const vals = vis.flatMap((d) => [tx(d.low), tx(d.high)]);
      Object.entries(ov).forEach(([k, a]) => slice(a).forEach((v) => { if (v == null) return; (k === 'bollinger' ? v : [v]).forEach((x) => vals.push(tx(x))); }));
      lo = Math.min(...vals); hiV = Math.max(...vals); const pad = (hiV - lo) * 0.06 || 1; lo -= pad; hiV += pad;
    }
    const y = (v) => ((hiV - v) / (hiV - lo)) * H;
    const cx = (i) => i * step + step / 2;
    const path = (arr, f = (v) => v) => { let d = '', pen = false; arr.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + cx(i).toFixed(1) + ',' + y(tx(f(v))).toFixed(2); pen = true; }); return d; };
    const last = data[N - 1];
    const up = last.close >= data[0].open;
    const col = up ? 'var(--color-gain)' : 'var(--color-loss)';
    const ticks = [0, 1, 2, 3, 4].map((k) => lo + ((hiV - lo) * (k + 0.5)) / 5);
    const fmtAxis = (v) => (volMode ? (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : (v / 1e3).toFixed(0) + 'K') : pctMode ? (v >= 0 ? '+' : '') + v.toFixed(2) + '%' : money(v));
    const lastVisible = view.start + view.count >= N;
    const curV = volMode ? null : tx(last.close);

    const idxAt = (e) => { const r = ref.current.getBoundingClientRect(); return Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n))); };
    const down = (e) => { ref.current.setPointerCapture(e.pointerId); setDrag({ x: e.clientX, start: view.start }); };
    const move = (e) => {
      if (drag) { const r = ref.current.getBoundingClientRect(); setView((v) => clamp(drag.start - ((e.clientX - drag.x) / r.width) * v.count, v.count)); return; }
      setHi(idxAt(e));
    };
    const up_ = () => setDrag(null);
    const o = vis[hi != null ? hi : n - 1];
    const gi = view.start + (hi != null ? hi : n - 1);
    const lineArr = vis.map((d) => d.close);
    const areaId = React.useMemo(() => 'mc' + Math.random().toString(36).slice(2), []);

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 4.75rem', gridTemplateRows: showRsi ? 'minmax(0,1fr) 88px 1rem' : 'minmax(0,1fr) 1rem', columnGap: 12, rowGap: 8, height: '100%', minHeight: 0 }}>
        <div ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up_} onPointerCancel={up_} onPointerLeave={() => { if (!drag) setHi(null); }} onDoubleClick={() => setView(init())}
          role="img" aria-label="Price chart. Scroll to zoom, drag to pan, double-click to reset."
          style={{ position: 'relative', minHeight: 0, cursor: drag ? 'grabbing' : 'crosshair', touchAction: 'none', userSelect: 'none' }}>
          <svg viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} aria-hidden="true">
            <defs><linearGradient id={areaId} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={up ? '#25eb69' : '#ff3d5a'} stopOpacity="0.28" /><stop offset="1" stopColor={up ? '#25eb69' : '#ff3d5a'} stopOpacity="0" /></linearGradient></defs>
            {ticks.map((t) => <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="rgba(238,250,255,.09)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />)}
            <line x1="0" x2={W} y1={H} y2={H} stroke="var(--border)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
            {pctMode ? <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="rgba(238,250,255,.25)" strokeDasharray="3 4" strokeWidth="1" vectorEffect="non-scaling-stroke" /> : null}
            {volMode ? vis.map((d, i) => <rect key={i} x={i * step + (step - bw) / 2} y={y(d.volume)} width={bw} height={H - y(d.volume)} fill={d.close >= d.open ? 'rgba(37,235,105,.55)' : 'rgba(255,61,90,.55)'} />) : null}
            {mode === 'candles' ? vis.map((d, i) => { const c = d.close >= d.open ? '#25eb69' : '#ff3d5a'; const t = y(tx(Math.max(d.open, d.close))), b = y(tx(Math.min(d.open, d.close))); return <g key={i}><line x1={cx(i)} x2={cx(i)} y1={y(tx(d.high))} y2={y(tx(d.low))} stroke={c} strokeWidth="1" vectorEffect="non-scaling-stroke" /><rect x={cx(i) - bw / 2} y={t} width={bw} height={Math.max(0.3, b - t)} fill={c} /></g>; }) : null}
            {mode === 'ohlc' ? vis.map((d, i) => { const c = d.close >= d.open ? '#25eb69' : '#ff3d5a'; return <g key={i} stroke={c} strokeWidth="1.2" vectorEffect="non-scaling-stroke"><line x1={cx(i)} x2={cx(i)} y1={y(d.high)} y2={y(d.low)} vectorEffect="non-scaling-stroke" /><line x1={cx(i) - bw / 2} x2={cx(i)} y1={y(d.open)} y2={y(d.open)} vectorEffect="non-scaling-stroke" /><line x1={cx(i)} x2={cx(i) + bw / 2} y1={y(d.close)} y2={y(d.close)} vectorEffect="non-scaling-stroke" /></g>; }) : null}
            {mode === 'area' ? <path d={path(lineArr) + ' L' + cx(n - 1) + ',' + H + ' L' + cx(0) + ',' + H + ' Z'} fill={'url(#' + areaId + ')'} /> : null}
            {mode === 'line' || mode === 'area' || pctMode ? <path d={path(lineArr)} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /> : null}
            {!volMode && ov.bollinger ? <><path d={path(slice(ov.bollinger), (v) => v[0])} fill="none" stroke={IND_COLORS.bollinger} strokeWidth="1.2" strokeOpacity="0.85" vectorEffect="non-scaling-stroke" /><path d={path(slice(ov.bollinger), (v) => v[1])} fill="none" stroke={IND_COLORS.bollinger} strokeWidth="1.2" strokeOpacity="0.85" vectorEffect="non-scaling-stroke" /></> : null}
            {!volMode && ov.sma ? <path d={path(slice(ov.sma))} fill="none" stroke={IND_COLORS.sma} strokeWidth="1.4" vectorEffect="non-scaling-stroke" /> : null}
            {!volMode && ov.ema ? <path d={path(slice(ov.ema))} fill="none" stroke={IND_COLORS.ema} strokeWidth="1.4" vectorEffect="non-scaling-stroke" /> : null}
            {curV != null && lastVisible ? <line x1="0" x2={W} y1={y(curV)} y2={y(curV)} stroke={up ? '#25eb69' : '#ff3d5a'} strokeOpacity="0.55" strokeDasharray="3 4" strokeWidth="1" vectorEffect="non-scaling-stroke" /> : null}
          </svg>
          {hi != null && !drag ? <div style={{ position: 'absolute', top: 0, bottom: 0, left: ((hi + 0.5) / n) * 100 + '%', width: 1, background: 'var(--foreground-40)', pointerEvents: 'none' }} /> : null}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 150, display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, fontWeight: 600, color: 'rgba(238,250,255,.46)', pointerEvents: 'none' }} className="tabular-nums">
            <span style={{ color: 'var(--foreground)' }}>{labelFor(gi, true)}</span>
            {[['O', o.open], ['H', o.high], ['L', o.low], ['C', o.close]].map(([k, v]) => <span key={k}>{k} <span style={{ color: o.close >= o.open ? 'var(--color-gain)' : 'var(--color-loss)' }}>{v.toFixed(2)}</span></span>)}
            <span>Vol <span style={{ color: 'var(--foreground)' }}>{o.volume.toLocaleString('en-US')}</span></span>
            {indicators.filter((k) => k !== 'rsi').map((k) => <span key={k} style={{ color: IND_COLORS[k] }}>{k === 'bollinger' ? 'BB 20 · 2σ' : k.toUpperCase() + ' 20'}</span>)}
          </div>
          <div onPointerDown={(e) => e.stopPropagation()} className="chart-controls" style={{ position: 'absolute', top: -2, right: 0, display: 'flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 8, border: '1px solid rgba(238,250,255,.15)', background: 'rgba(24,24,24,.9)' }}>
            <CtrlBtn icon="zoom-out" label="Zoom out" disabled={view.count >= N} onClick={() => zoom(1.25)} />
            <CtrlBtn icon="zoom-in" label="Zoom in" disabled={view.count <= MIN_BARS} onClick={() => zoom(0.8)} />
            <CtrlBtn icon="chevron-left" label="Pan left" disabled={view.start === 0} onClick={() => setView((v) => clamp(v.start - v.count * 0.25, v.count))} />
            <CtrlBtn icon="chevron-right" label="Pan right" disabled={lastVisible} onClick={() => setView((v) => clamp(v.start + v.count * 0.25, v.count))} />
            <CtrlBtn icon="rotate-ccw" label="Reset view" onClick={() => setView(init())} />
          </div>
        </div>
        <div style={{ position: 'relative', borderLeft: '1px solid rgba(238,250,255,.105)', fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'right' }} className="tabular-nums">
          {ticks.map((t) => <span key={t} style={{ position: 'absolute', right: 0, top: (y(t) / H) * 100 + '%', transform: 'translateY(-50%)', whiteSpace: 'nowrap' }}>{fmtAxis(t)}</span>)}
          {curV != null && lastVisible ? <span style={{ position: 'absolute', right: 0, top: Math.min(98, Math.max(2, (y(curV) / H) * 100)) + '%', transform: 'translateY(-50%)', padding: '1px 5px', borderRadius: 4, fontWeight: 600, color: '#0e0e0e', background: col, whiteSpace: 'nowrap' }}>{pctMode ? fmtAxis(curV) : last.close.toFixed(2)}</span> : null}
        </div>
        {showRsi ? (
          <>
            <div style={{ position: 'relative', borderTop: '1px solid var(--border)' }}>
              <svg viewBox={'0 0 ' + W + ' 100'} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
                <rect x="0" y="30" width={W} height="40" fill="rgba(66,211,255,.06)" />
                {[30, 70].map((v) => <line key={v} x1="0" x2={W} y1={v} y2={v} stroke="rgba(238,250,255,.12)" strokeDasharray="3 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
                <path d={slice(rsiVals).map((v, i) => (v == null ? '' : (i && slice(rsiVals)[i - 1] != null ? 'L' : 'M') + cx(i).toFixed(1) + ',' + (100 - v).toFixed(2))).join(' ')} fill="none" stroke={IND_COLORS.rsi} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
              </svg>
              <span style={{ position: 'absolute', top: 4, left: 0, fontSize: 11, fontWeight: 600, color: IND_COLORS.rsi }}>RSI 14 {(rsiVals[gi] || 0).toFixed(1)}</span>
            </div>
            <div style={{ position: 'relative', borderLeft: '1px solid rgba(238,250,255,.105)', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'right' }}>
              <span style={{ position: 'absolute', right: 0, top: '30%', transform: 'translateY(-50%)' }}>70</span><span style={{ position: 'absolute', right: 0, top: '70%', transform: 'translateY(-50%)' }}>30</span>
            </div>
          </>
        ) : null}
        <div style={{ position: 'relative', height: 16, fontSize: 12, color: 'var(--muted-foreground)' }}>
          {[0, 1, 2, 3, 4].map((k) => { const x = k / 4; const idx = Math.min(n - 1, Math.round(x * (n - 1))); return <span key={k} style={{ position: 'absolute', left: x * 100 + '%', transform: k === 0 ? 'none' : k === 4 ? 'translateX(-100%)' : 'translateX(-50%)', whiteSpace: 'nowrap' }}>{labelFor(view.start + idx)}</span>; })}
        </div>
        <div />
      </div>
    );
  }
  window.MarketChart = MarketChart;
})();
