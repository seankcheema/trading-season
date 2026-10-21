(() => {
  const { Dialog, ChangePill, Sparkline, Input, TimeframeToggle, Icon } = window.TradingSeasonDesignSystem_86c3eb;
  const { TRANSACTIONS, POSITIONS, series, money, pct, find } = window.TSData;

  const head = { color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: 8 };
  const cell = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  const gl = (v) => ({ color: v >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' });
  const dateNum = (d) => { const [m, day] = d.split(' '); return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(m) * 100 + +day; };

  function Sort({ k, sort, setSort, align, children }) {
    const on = sort.key === k;
    return (
      <button type="button" onClick={() => setSort({ key: k, dir: on && sort.dir === 'desc' ? 'asc' : 'desc' })}
        style={{ ...cell, display: 'flex', alignItems: 'center', gap: 4, justifyContent: align === 'right' ? 'flex-end' : 'flex-start', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: on ? 'var(--foreground)' : 'inherit' }}>
        {children}<Icon name={on ? (sort.dir === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down'} size={12} style={{ opacity: on ? 1 : 0.6, color: on ? 'var(--primary)' : undefined }} />
      </button>
    );
  }
  const sorted = (rows, sort, get) => { const r = rows.slice().sort((a, b) => { const x = get(a, sort.key), y = get(b, sort.key); return typeof x === 'string' ? x.localeCompare(y) : x - y; }); return sort.dir === 'desc' ? r.reverse() : r; };
  function Row({ children, cols, onClick, expanded }) {
    const [h, setH] = React.useState(false);
    const Tag = onClick ? 'button' : 'div';
    return <Tag type={onClick ? 'button' : undefined} aria-expanded={expanded} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'center', width: '100%', padding: '10px 8px', border: 0, borderRadius: 8, fontSize: 14, textAlign: 'left', color: 'inherit', cursor: onClick ? 'pointer' : 'default', background: expanded ? 'transparent' : h && onClick ? 'var(--muted)' : 'transparent', transition: 'background 150ms' }}>{children}</Tag>;
  }
  const Empty = ({ children }) => <p style={{ margin: 0, padding: '32px 8px', textAlign: 'center', fontSize: 14, color: 'var(--muted-foreground)' }}>{children}</p>;
  const listBox = { maxHeight: 'min(60vh, 520px)', overflowY: 'auto' };

  // Audit trail: PENDING → ACCEPTED → FILLED, with the price seen at each stage. Mock, deterministic per row.
  function auditFor(t, k) {
    const base = 9 * 3600 + 45 * 60 + ((k * 2671) % 21000);
    const at = (ms) => { const s = base + Math.floor(ms / 1000); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0') + (h >= 12 ? ' PM' : ' AM'); };
    if (t.kind === 'cash') {
      const v = (t.reason === 'DEPOSIT' ? '+' : '-') + money(t.value);
      return [['PENDING', at(0), v], ['ACCEPTED', at(11), v], ['FILLED', at(24), v]];
    }
    const drift = (((k * 37) % 9) - 4) / 1000;
    const p0 = t.price * (1 - drift), p1 = t.price * (1 - drift / 2);
    return [['PENDING', at(0), money(p0)], ['ACCEPTED', at(12), money(p1)], ['FILLED', at(34), money(t.price)]];
  }

  function AuditTrail({ t, k, date }) {
    const events = auditFor(t, k);
    return (
      <div style={{ padding: '4px 8px 14px 36px', animation: 'ts-fade-in 150ms ease-out both' }}>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {events.map(([stage, time, price], i) => {
            const last = i === events.length - 1;
            return (
              <li key={stage} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '14px auto minmax(0,1fr) auto', alignItems: 'center', columnGap: 16, padding: '5px 0' }}>
                {!last ? <span aria-hidden="true" style={{ position: 'absolute', left: 6, top: '50%', height: '100%', width: 1, background: 'var(--border)' }} /> : null}
                <span aria-hidden="true" style={{ position: 'relative', marginLeft: 2, width: 9, height: 9, borderRadius: 9999, background: last ? 'var(--color-gain)' : 'var(--primary)', boxShadow: '0 0 0 3px var(--card)' }} />
                <span style={{ minWidth: 76, fontSize: 13, fontWeight: 500, letterSpacing: '0.02em' }}>{stage}</span>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }} className="tabular-nums">{date} · {time}</span>
                <span style={{ fontSize: 13, textAlign: 'right' }} className="tabular-nums">{price}</span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  // Full transaction history: type filter, search, sortable columns, expandable audit trail.
  function AllTransactionsDialog({ onClose, openOrder }) {
    const [kind, setKind] = React.useState('All');
    const [q, setQ] = React.useState('');
    const [sort, setSort] = React.useState({ key: 'date', dir: 'desc' });
    const [open, setOpen] = React.useState(null);
    const COLS = '20px minmax(0,1fr) minmax(0,.9fr) minmax(0,.9fr) minmax(0,.7fr) minmax(0,.9fr) minmax(0,1fr)';
    const rows = TRANSACTIONS.map((t, idx) => ({ ...t, idx, label: t.kind === 'cash' ? 'Cash' : t.symbol, type: t.kind === 'cash' ? (t.reason === 'DEPOSIT' ? 'deposit' : 'withdrawal') : t.side, amount: t.kind === 'cash' ? (t.reason === 'DEPOSIT' ? t.value : -t.value) : t.shares * t.price }))
      .filter((t) => (kind === 'All' || (kind === 'Trades' ? t.kind === 'trade' : t.kind === 'cash')) && (!q || t.label.toLowerCase().includes(q.toLowerCase())));
    const list = sorted(rows, sort, (t, k) => (k === 'date' ? dateNum(t.date) : k === 'amount' ? Math.abs(t.amount) : k === 'shares' ? t.shares || 0 : k === 'price' ? t.price || 0 : t[k]));
    const tone = (t) => (t.kind === 'cash' ? (t.reason === 'DEPOSIT' ? 'gain' : 'loss') : t.side === 'buy' ? 'primary' : 'loss');
    const H = (k, l, a) => <Sort k={k} sort={sort} setSort={setSort} align={a}>{l}</Sort>;
    return (
      <Dialog title="Transactions" width={880} closeLabel="Close transactions" onClose={onClose}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <TimeframeToggle value={kind} onChange={setKind} options={['All', 'Trades', 'Cash']} />
          <Input icon="search" placeholder="Filter by symbol" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 220 }} />
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted-foreground)' }} className="tabular-nums">{list.length} transactions</span>
        </div>
        <div style={{ ...head, display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '0 8px 8px' }}>
          <span />{H('date', 'Date')}{H('label', 'Asset')}{H('type', 'Type')}{H('shares', 'Shares', 'right')}{H('price', 'Price', 'right')}{H('amount', 'Value', 'right')}
        </div>
        <div className="ts-scroll" style={listBox}>
          {list.length ? list.map((t) => {
            const isOpen = open === t.idx;
            return (
            <div key={t.idx} style={{ borderBottom: '1px solid var(--border-60)' }}>
            <Row cols={COLS} expanded={isOpen} onClick={() => setOpen(isOpen ? null : t.idx)}>
              <Icon name="chevron-right" size={14} style={{ color: isOpen ? 'var(--primary)' : 'var(--muted-foreground)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms, color 150ms' }} />
              <span style={{ ...cell, color: 'var(--muted-foreground)' }} className="tabular-nums">{t.date}, 2026</span>
              <span style={{ ...cell, fontWeight: 500 }}>{t.label}</span>
              <span><ChangePill tag tone={tone(t)}>{t.type}</ChangePill></span>
              <span style={{ ...cell, textAlign: 'right' }} className="tabular-nums">{t.kind === 'trade' ? t.shares : '—'}</span>
              <span style={{ ...cell, textAlign: 'right' }} className="tabular-nums">{t.kind === 'trade' ? money(t.price) : '—'}</span>
              <span style={{ ...cell, textAlign: 'right' }} className="tabular-nums">{t.kind === 'cash' ? (t.amount >= 0 ? '+' : '-') + money(Math.abs(t.amount)) : money(t.amount)}</span>
            </Row>
            {isOpen ? <AuditTrail t={t} k={t.idx} date={t.date + ', 2026'} /> : null}
            </div>
            );
          }) : <Empty>No transactions match these filters.</Empty>}
        </div>
      </Dialog>
    );
  }

  // All holdings with totals, sortable columns and allocation share.
  function AllAssetsDialog({ onClose, openOrder }) {
    const [sort, setSort] = React.useState({ key: 'value', dir: 'desc' });
    const COLS = 'minmax(0,1.4fr) minmax(0,.9fr) minmax(0,.55fr) minmax(0,.85fr) minmax(0,.85fr) minmax(0,.8fr) minmax(0,.95fr) minmax(0,.95fr) minmax(0,.8fr) minmax(0,.9fr)';
    const rows = Object.entries(POSITIONS).map(([sym, p]) => { const i = find(sym); return { sym, name: i.name, i, shares: p.shares, cost: p.cost, price: i.price, change: i.changePercent, value: p.shares * i.price, gl: p.shares * (i.price - p.cost), glPct: ((i.price - p.cost) / p.cost) * 100 }; });
    const total = rows.reduce((a, r) => a + r.value, 0), totalGl = rows.reduce((a, r) => a + r.gl, 0), totalCost = rows.reduce((a, r) => a + r.shares * r.cost, 0);
    const list = sorted(rows, sort, (r, k) => (k === 'weight' ? r.value : r[k]));
    const H = (k, l, a) => <Sort k={k} sort={sort} setSort={setSort} align={a}>{l}</Sort>;
    return (
      <Dialog title="Assets" width={1120} closeLabel="Close assets" onClose={onClose}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
          {[['Market value', money(total)], ['Cost basis', money(totalCost)], ['Unrealized', (totalGl >= 0 ? '+' : '') + money(totalGl), gl(totalGl).color], ['Positions', rows.length]].map(([k, v, c]) => (
            <div key={k} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{k}</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', color: c }} className="tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        <div style={{ ...head, display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '0 8px 8px' }}>
          {H('sym', 'Asset')}<span style={cell}>Today</span>{H('shares', 'Shares', 'right')}{H('cost', 'Avg Price', 'right')}{H('price', 'Price', 'right')}{H('change', 'Change %', 'right')}{H('value', 'Value', 'right')}{H('gl', 'Value $', 'right')}{H('glPct', 'Return', 'right')}{H('weight', 'Weight', 'right')}
        </div>
        <div className="ts-scroll" style={listBox}>
          {list.map((r) => (
            <Row key={r.sym} cols={COLS} onClick={() => { onClose(); openOrder(r.sym); }}>
              <span style={{ ...cell }}><span style={{ display: 'block', fontWeight: 500 }}>{r.sym}</span><span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)', ...cell }}>{r.name}</span></span>
              <Sparkline points={series(r.sym + 'today', 27, r.price).map((v) => (r.i.change < 0 ? 2 * r.price - v : v))} />
              <span style={{ ...cell, textAlign: 'right' }} className="tabular-nums">{r.shares}</span>
              <span style={{ ...cell, textAlign: 'right' }} className="tabular-nums">{money(r.cost)}</span>
              <span style={{ ...cell, textAlign: 'right' }} className="tabular-nums">{money(r.price)}</span>
              <span style={{ ...cell, textAlign: 'right', ...gl(r.change) }} className="tabular-nums">{pct(r.change)}</span>
              <span style={{ ...cell, textAlign: 'right' }} className="tabular-nums">{money(r.value)}</span>
              <span style={{ ...cell, textAlign: 'right', ...gl(r.gl) }} className="tabular-nums">{(r.gl >= 0 ? '+' : '') + money(r.gl)}</span>
              <span style={{ ...cell, textAlign: 'right', ...gl(r.glPct) }} className="tabular-nums">{pct(r.glPct)}</span>
              <span style={{ ...cell, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }} className="tabular-nums">
                <span style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(255,255,255,.1)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: (r.value / total) * 100 + '%', background: 'var(--primary)' }} /></span>
                {((r.value / total) * 100).toFixed(1)}%
              </span>
            </Row>
          ))}
        </div>
      </Dialog>
    );
  }
  Object.assign(window, { AllTransactionsDialog, AllAssetsDialog });
})();
