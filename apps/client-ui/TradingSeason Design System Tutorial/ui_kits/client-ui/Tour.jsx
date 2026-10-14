(() => {
  const { Button, Icon } = window.TradingSeasonDesignSystem_86c3eb;

  // Short first-run tour of the dashboard. Each step spotlights one element; target = CSS selector (null = centered).
  const STEPS = [
    { target: null, title: 'Welcome to TradingSeason', body: 'Trade stocks in a simulated market with fake money and real-looking prices. This tour takes about 30 seconds.' },
    { target: '[data-tour="search"]', title: 'Every trade starts with a search', body: 'Type a company or ticker, or press ⌘K from anywhere. Pick a result to open its order ticket.', place: 'bottom' },
    { target: '[data-tour="networth"]', title: 'Your money', body: 'Net worth is your cash plus everything you own. Deposit or withdraw cash here at any time.', place: 'right' },
    { target: '[aria-label="Select account"]', title: 'Accounts', body: 'Split your cash across accounts, like Growth and Retirement. Holdings and charts follow the account you pick.', place: 'bottom' },
    { target: '[data-tour="portfolio"]', title: 'Track performance', body: 'See how the selected account has moved over the day, week, month or year.', place: 'left' },
    { target: '[data-tour="assets"]', title: 'Holdings and watch list', body: 'Click any row to trade it. Star a stock in its order ticket to keep it on your watch list.', place: 'top' },
    { target: '[data-tour="search"]', title: "You're ready", body: 'Search for a stock and place your first trade.', place: 'bottom', final: true },
  ];
  const PAD = 6, GAP = 14, W = 320;

  function placePopover(r, place, h) {
    const vw = window.innerWidth, vh = window.innerHeight;
    if (!r) return { left: (vw - W) / 2, top: Math.max(16, (vh - h) / 2) };
    const fits = { bottom: r.bottom + GAP + h < vh, top: r.top - GAP - h > 0, right: r.right + GAP + W < vw, left: r.left - GAP - W > 0 };
    const p = fits[place] ? place : ['bottom', 'top', 'right', 'left'].find((k) => fits[k]) || 'bottom';
    let left, top;
    if (p === 'bottom' || p === 'top') { left = r.left + r.width / 2 - W / 2; top = p === 'bottom' ? r.bottom + GAP : r.top - GAP - h; }
    else { top = r.top + r.height / 2 - h / 2; left = p === 'right' ? r.right + GAP : r.left - GAP - W; }
    return { left: Math.max(16, Math.min(vw - W - 16, left)), top: Math.max(16, Math.min(vh - h - 16, top)) };
  }

  function Tour({ open, onClose }) {
    const [step, setStep] = React.useState(() => Math.min(STEPS.length - 1, +(localStorage.getItem('ts-tour-step') || 0)));
    const [rect, setRect] = React.useState(null);
    const [h, setH] = React.useState(190);
    const card = React.useRef(null);
    const s = STEPS[step];

    React.useEffect(() => { if (open) localStorage.setItem('ts-tour-step', step); }, [step, open]);
    React.useLayoutEffect(() => {
      if (!open) return;
      const measure = () => {
        const el = s.target && document.querySelector(s.target);
        const b = el && el.getBoundingClientRect();
        setRect(b ? { left: b.left - PAD, top: b.top - PAD, width: b.width + PAD * 2, height: b.height + PAD * 2, right: b.right + PAD, bottom: b.bottom + PAD } : null);
        if (card.current) setH(card.current.offsetHeight);
      };
      measure();
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }, [open, step]);

    const finish = (focusSearch) => {
      localStorage.setItem('ts-tour-done', '1'); localStorage.removeItem('ts-tour-step'); setStep(0); onClose();
      if (focusSearch) setTimeout(() => { const i = document.querySelector('[data-tour="search"] input'); i && i.focus(); }, 50);
    };
    const next = () => (s.final ? finish(true) : setStep(step + 1));
    const back = () => setStep(Math.max(0, step - 1));
    React.useEffect(() => {
      if (!open) return;
      const k = (e) => { if (e.key === 'Escape') finish(false); else if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') back(); };
      document.addEventListener('keydown', k);
      return () => document.removeEventListener('keydown', k);
    });
    if (!open) return null;

    const pos = placePopover(rect, s.place, h);
    const ease = 'cubic-bezier(0.16,1,0.3,1)';
    return (
      <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 80 }}>
        {rect ? (
          <div aria-hidden="true" style={{ position: 'fixed', left: rect.left, top: rect.top, width: rect.width, height: rect.height, borderRadius: 16, boxShadow: '0 0 0 2px var(--primary), 0 0 0 9999px rgba(0,0,0,.62)', transition: 'all 260ms ' + ease, pointerEvents: 'none' }} />
        ) : <div aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.62)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', animation: 'ts-fade-in 150ms ease-out both' }} />}
        <section ref={card} key={step} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body"
          style={{ position: 'fixed', left: pos.left, top: pos.top, width: W, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-dialog)', padding: 20, animation: 'ts-pop-in 200ms ' + ease + ' both' }}>
          {!rect ? <img src="../../assets/2b-waves.svg" alt="" style={{ width: 40, height: 40, marginBottom: 12 }} /> : null}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }} className="tabular-nums">{step === 0 ? 'Quick tour' : step + ' of ' + (STEPS.length - 1)}</span>
            <button type="button" aria-label="Close tour" onClick={() => finish(false)} style={{ display: 'flex', width: 28, height: 28, alignItems: 'center', justifyContent: 'center', margin: '-6px -8px 0 0', border: 0, borderRadius: 8, background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer' }}><Icon name="x" size={16} /></button>
          </div>
          <h2 id="tour-title" style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 600, letterSpacing: '-0.025em' }}>{s.title}</h2>
          <p id="tour-body" style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--muted-foreground)', textWrap: 'pretty' }}>{s.body}</p>
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div aria-hidden="true" style={{ display: 'flex', gap: 4 }}>
              {STEPS.slice(1).map((_, k) => <span key={k} style={{ width: k + 1 === step ? 16 : 6, height: 6, borderRadius: 9999, background: k + 1 <= step ? 'var(--primary)' : 'rgba(238,250,255,.15)', transition: 'all 200ms' }} />)}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {step === 0 ? <Button variant="ghost" onClick={() => finish(false)}>Skip</Button> : <Button variant="ghost" onClick={back}>Back</Button>}
              <Button radius={5} iconEnd={s.final ? 'search' : step === 0 ? undefined : 'arrow-right'} onClick={next}>{step === 0 ? 'Start tour' : s.final ? 'Find a stock' : 'Next'}</Button>
            </div>
          </div>
        </section>
      </div>
    );
  }
  window.Tour = Tour;
})();
