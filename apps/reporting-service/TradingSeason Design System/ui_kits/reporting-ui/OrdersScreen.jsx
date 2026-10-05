(() => {
  const { DashCard, DashLabel, Input, Select, Button, Icon, Dialog, ChangePill } = window.TradingSeasonDesignSystem_86c3eb;
  const { money } = window.TSData;
  const { USERS, ORDERS, AUDIT } = window.TSReport;

  const OCOLS = '0.7fr 1fr 1.3fr 0.9fr 0.7fr 0.6fr 0.5fr 0.9fr 0.9fr';

  function AuditTimeline({ order }) {
    const events = AUDIT[order.id] || [['ORDER_RECEIVED', order.time], ['VALIDATED', order.time], ['FILLED', order.time]];
    return (
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {events.map(([e, t], k) => {
          const bad = /FAIL|REJECT/.test(e), done = /FILLED|UPDATED/.test(e);
          const c = bad ? 'var(--color-loss)' : done ? 'var(--color-gain)' : 'var(--primary)';
          return (
            <li key={k} style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: 12, paddingBottom: k < events.length - 1 ? 14 : 0, position: 'relative' }}>
              {k < events.length - 1 ? <span style={{ position: 'absolute', left: 7, top: 14, bottom: 0, width: 1, background: 'var(--border)' }} /> : null}
              <span style={{ marginTop: 4, width: 9, height: 9, marginLeft: 3, borderRadius: 9999, background: c, boxShadow: '0 0 0 3px var(--card)' }} />
              <span><span style={{ display: 'block', fontSize: 13, fontWeight: 500, letterSpacing: '0.02em' }}>{e}</span><span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }} className="tabular-nums">{t}</span></span>
            </li>
          );
        })}
      </ol>
    );
  }

  function OrderRow({ o, onClick, showUser = true }) {
    return (
      <RowButton onClick={onClick} style={{ display: 'grid', gridTemplateColumns: OCOLS, gap: 8, alignItems: 'center', padding: '10px 8px', fontSize: 14, whiteSpace: 'nowrap' }}>
        <span className="tabular-nums" style={{ color: 'var(--muted-foreground)' }}>#{o.id}</span>
        <span className="tabular-nums">{o.time}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{showUser ? o.user : o.account}<span style={{ color: 'var(--muted-foreground)' }}>{showUser ? ' · ' + o.account : ''}</span></span>
        <span style={{ fontWeight: 500 }}>{o.symbol}</span>
        <span><ChangePill tag tone={o.side === 'buy' ? 'primary' : 'loss'}>{o.side}</ChangePill></span>
        <span style={{ textAlign: 'right' }} className="tabular-nums">{o.qty}</span>
        <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>{o.type}</span>
        <span style={{ textAlign: 'right' }} className="tabular-nums">{o.price ? money(o.price) : '—'}</span>
        <span style={{ textAlign: 'right' }}><StatusPill status={o.status} /></span>
      </RowButton>
    );
  }

  const ORDER_SORT = (o, k) => (k === 'time' || k === 'id' ? o.id : k === 'price' ? o.price || 0 : k === 'value' ? (o.price || 0) * o.qty : o[k]);
  function OrderTable({ orders, onOpen, showUser, sort: sortProp, setSort: setSortProp }) {
    const [own, setOwn] = React.useState({ key: 'time', dir: 'desc' });
    const sort = sortProp || own, setSort = setSortProp || setOwn;
    const rows = sortRows(orders, sort, ORDER_SORT);
    const H = (k, label, align) => <SortHead k={k} sort={sort} setSort={setSort} align={align}>{label}</SortHead>;
    return (
      <div className="ts-scroll" style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        <div style={{ minWidth: 880 }}>
          <div style={{ ...tableHead, display: 'grid', gridTemplateColumns: OCOLS, gap: 8, padding: '0 8px 8px', position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}>
            {H('id', 'Order')}{H('time', 'Time')}{showUser ? H('user', 'Customer') : H('account', 'Account')}{H('symbol', 'Asset')}{H('side', 'Side')}{H('qty', 'Qty', 'right')}<span>Type</span>{H('price', 'Fill price', 'right')}{H('status', 'Status', 'right')}
          </div>
          {rows.map((o) => <OrderRow key={o.id} o={o} showUser={showUser} onClick={() => onOpen(o)} />)}
        </div>
      </div>
    );
  }

  const STATUS_NOTE = { FILLED: 'Executed at the locked quote; holdings and cash posted.', PENDING: 'Validated and waiting for a market quote.', REJECTED: 'Failed validation; no fill, cash or holdings were posted.', CANCELLED: 'Cancelled before execution; nothing was posted.' };
  const USER_EMAIL = (name) => ((window.TSReport.USERS.find((u) => u.name === name) || {}).email || '—');

  function Section({ title, right, children, style }) {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, ...style }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}><DashLabel as="h3">{title}</DashLabel>{right}</div>
        {children}
      </div>
    );
  }
  function KV({ rows, cols = 2 }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + cols + ', minmax(0,1fr))', rowGap: 12, columnGap: 16, fontSize: 14 }}>
        {rows.filter(Boolean).map(([k, v, tone]) => (
          <div key={k} style={{ minWidth: 0 }}><div style={{ color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{k}</div><div style={{ marginTop: 4, color: tone, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="tabular-nums">{v}</div></div>
        ))}
      </div>
    );
  }

  function OrderDetail({ order, onClose }) {
    const inst = window.TSData.find(order.symbol);
    const filled = order.status === 'FILLED';
    const quote = order.price || inst.price;
    const spread = Math.max(0.01, quote * 0.0004);
    const bid = quote - spread / 2, ask = quote + spread / 2;
    const value = order.qty * quote;
    const buy = order.side === 'buy';
    const cashBefore = { 'Sean Cheema': 6086.91, 'Priya Natarajan': 5499.67, 'Marcus Lee': 12040.1 }[order.user] || 5000;
    const cashAfter = filled ? cashBefore + (buy ? -value : value) : cashBefore;
    const heldBefore = { AAPL: 0, NVDA: 25, MSFT: 0, SPY: 0, GOOGL: 12, META: 0, TSLA: 0, AMZN: 10 }[order.symbol] || 0;
    const heldAfter = filled ? heldBefore + (buy ? order.qty : -order.qty) : heldBefore;
    const fillId = 88000 + (order.id % 1000);
    const copy = (t) => { try { navigator.clipboard.writeText(t); } catch (e) {} };
    return (
      <Dialog title={'Order #' + order.id} width={960} closeLabel="Close order detail" onClose={onClose}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <InstrumentTile symbol={order.symbol} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', textTransform: 'capitalize' }}>{order.side} {order.qty} {order.symbol}</span>
              <StatusPill status={order.status} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{inst.name} · {order.type.toLowerCase()} order · Sep 14, 2026 {order.time} CT</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{filled ? (buy ? 'Cost' : 'Proceeds') : 'Est. value'}</div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums">{money(value)}</div>
          </div>
        </div>
        <p role="status" style={{ margin: '0 0 16px', padding: '8px 12px', borderRadius: 5, fontSize: 14, background: order.status === 'REJECTED' ? 'var(--loss-10)' : 'var(--muted)', color: order.status === 'REJECTED' ? 'var(--color-loss)' : 'var(--foreground)' }}>
          {order.reason ? 'Rejected: ' + order.reason + '. ' : ''}{STATUS_NOTE[order.status]}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            <Section title="Customer">
              <KV cols={3} rows={[['Name', order.user], ['Email', USER_EMAIL(order.user)], ['Account', order.account]]} />
            </Section>
            <Section title="Execution">
              <KV cols={3} rows={[
                ['Quantity', order.qty], ['Fill price', order.price ? money(order.price) : '—'], ['Fill ID', filled ? '#' + fillId : '—'],
                ['Bid at submit', money(bid), 'var(--color-gain)'], ['Ask at submit', money(ask), 'var(--color-loss)'], ['Spread', money(spread, 3)],
                ['Market price now', money(inst.price)], ['Slippage', filled ? money(0) : '—'], ['Session', '#12 · replay'],
              ]} />
            </Section>
            <Section title="Ledger impact" right={filled ? null : <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Nothing posted</span>}>
              <KV cols={3} rows={[
                ['Cash before', money(cashBefore)], ['Cash change', filled ? (buy ? '-' : '+') + money(value) : '—', filled ? (buy ? 'var(--color-loss)' : 'var(--color-gain)') : undefined], ['Cash after', money(cashAfter)],
                [order.symbol + ' before', heldBefore + ' sh'], ['Holding change', filled ? (buy ? '+' : '-') + order.qty + ' sh' : '—'], [order.symbol + ' after', heldAfter + ' sh'],
              ]} />
            </Section>
            <Section title="References">
              <KV cols={2} rows={[['Client reference', order.ref], ['Order type', order.type], ['Cash transaction', filled ? '#' + (fillId + 4100) : '—'], ['Holding movement', filled ? '#' + (fillId + 7300) : '—']]} />
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <Button variant="outline" size="sm" icon="copy" onClick={() => copy(order.ref)}>Copy reference</Button>
                <Button variant="outline" size="sm" icon="copy" onClick={() => copy(String(order.id))}>Copy order ID</Button>
              </div>
            </Section>
          </div>
          <Section title="Audit trail" right={<span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>audit_trail</span>} style={{ alignSelf: 'start' }}>
            <AuditTimeline order={order} />
          </Section>
        </div>
      </Dialog>
    );
  }
  function InstrumentTile({ symbol }) {
    return <div aria-hidden="true" style={{ width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'var(--primary-15)', color: 'var(--primary)', fontSize: 12, fontWeight: 600 }}>{symbol.slice(0, 4)}</div>;
  }

  const uniq = (k) => Array.from(new Set(ORDERS.map((o) => o[k]))).sort();
  const ALL = (label) => ({ value: 'ALL', label });
  const EMPTY = { q: '', status: 'ALL', side: 'ALL', symbol: 'ALL', user: 'ALL', fill: 'ALL' };

  function OrdersScreen() {
    const [f, setF] = React.useState(EMPTY);
    const [sort, setSort] = React.useState({ key: 'time', dir: 'desc' });
    const [open, setOpen] = React.useState(null);
    const set = (k) => (v) => setF({ ...f, [k]: v });
    const active = Object.keys(EMPTY).some((k) => f[k] !== EMPTY[k]);
    const list = ORDERS.filter((o) => (f.status === 'ALL' || o.status === f.status) && (f.side === 'ALL' || o.side === f.side) && (f.symbol === 'ALL' || o.symbol === f.symbol) && (f.user === 'ALL' || o.user === f.user)
      && (f.fill === 'ALL' || (f.fill === 'priced' ? !!o.price : !o.price)) && (!f.q || (o.user + o.symbol + o.id + o.ref).toLowerCase().includes(f.q.toLowerCase())));
    const csv = () => downloadCsv('orders', [['Order', (o) => o.id], ['Time', (o) => o.time], ['Customer', (o) => o.user], ['Account', (o) => o.account], ['Asset', (o) => o.symbol], ['Side', (o) => o.side], ['Qty', (o) => o.qty], ['Type', (o) => o.type], ['Fill price', (o) => o.price || ''], ['Status', (o) => o.status], ['Client reference', (o) => o.ref]], sortRows(list, sort, ORDER_SORT));
    return (
      <div style={screenRoot}>
        <PageHeader title="Orders" sub="All accounts · simulation session #12" right={<ExportMenu onCsv={csv} />} />
        <DashCard style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div data-print-hide="true" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 240px', maxWidth: 300 }}>
              <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Search</span>
              <Input icon="search" placeholder="Customer, symbol, order # or ref" value={f.q} onChange={(e) => set('q')(e.target.value)} />
            </div>
            <FilterSelect label="Status" value={f.status} onChange={set('status')} width={140} options={[ALL('All statuses'), 'FILLED', 'PENDING', 'REJECTED', 'CANCELLED']} />
            <FilterSelect label="Side" value={f.side} onChange={set('side')} width={110} options={[ALL('Buy & sell'), { value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]} />
            <FilterSelect label="Asset" value={f.symbol} onChange={set('symbol')} width={120} options={[ALL('All assets')].concat(uniq('symbol'))} />
            <FilterSelect label="Customer" value={f.user} onChange={set('user')} width={170} options={[ALL('All customers')].concat(uniq('user'))} />
            <FilterSelect label="Fill" value={f.fill} onChange={set('fill')} width={130} options={[ALL('Any'), { value: 'priced', label: 'Has fill price' }, { value: 'unfilled', label: 'No fill yet' }]} />
            {active ? <Button variant="ghost" icon="x" onClick={() => setF(EMPTY)}>Clear filters</Button> : null}
            <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 12, color: 'var(--muted-foreground)' }} className="tabular-nums">{list.length} of {ORDERS.length} orders</span>
          </div>
          {list.length ? <OrderTable orders={list} onOpen={setOpen} showUser sort={sort} setSort={setSort} /> : <p style={{ margin: 0, padding: '24px 8px', textAlign: 'center', fontSize: 14, color: 'var(--muted-foreground)' }}>No orders match these filters.</p>}
        </DashCard>
        {open ? <OrderDetail order={open} onClose={() => setOpen(null)} /> : null}
      </div>
    );
  }
  Object.assign(window, { OrdersScreen, OrderTable, OrderDetail, AuditTimeline });
})();
