(() => {
  const { DashCard, DashLabel, Input, Button, Icon, ChangePill } = window.TradingSeasonDesignSystem_86c3eb;
  const { money } = window.TSData;
  const { USERS, ORDERS } = window.TSReport;

  const UCOLS = '1.6fr 0.8fr 0.6fr 1fr 1fr 0.8fr 0.8fr';

  const lastMin = (u) => { const m = /(\d+):(\d+) (AM|PM)/.exec(u.last); return m ? ((+m[1] % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + +m[2] : -1; };
  const USER_SORT = (u, k) => (k === 'last' ? lastMin(u) : k === 'total' ? u.cash + u.portfolio : u[k]);
  const EMPTY = { q: '', status: 'ALL', role: 'ALL', level: 'ALL', risk: 'ALL' };
  const ALL = (label) => ({ value: 'ALL', label });

  function CustomersScreen({ openCustomer }) {
    const [f, setF] = React.useState(EMPTY);
    const [sort, setSort] = React.useState({ key: 'last', dir: 'desc' });
    const set = (k) => (v) => setF({ ...f, [k]: v });
    const active = Object.keys(EMPTY).some((k) => f[k] !== EMPTY[k]);
    const filtered = USERS.filter((u) => (f.status === 'ALL' || u.status === f.status) && (f.role === 'ALL' || u.role === f.role) && (f.level === 'ALL' || u.level === f.level)
      && (f.risk === 'ALL' || (f.risk === 'failed' ? u.failed > 0 : f.risk === 'nocash' ? u.cash === 0 : u.accounts === 0))
      && (!f.q || (u.name + u.email + u.id).toLowerCase().includes(f.q.toLowerCase())));
    const list = sortRows(filtered, sort, USER_SORT);
    const H = (k, label, align) => <SortHead k={k} sort={sort} setSort={setSort} align={align}>{label}</SortHead>;
    const csv = () => downloadCsv('customers', [['User ID', (u) => u.id], ['Name', (u) => u.name], ['Email', (u) => u.email], ['Role', (u) => u.role], ['Status', (u) => u.status], ['Trader level', (u) => u.level], ['Accounts', (u) => u.accounts], ['Cash', (u) => u.cash], ['Portfolio', (u) => u.portfolio], ['Failed sign-ins', (u) => u.failed], ['Last active', (u) => u.last]], list);
    return (
      <div style={screenRoot}>
        <PageHeader title="Customers" sub="Look up a trader to review activity and resolve support requests" right={<ExportMenu onCsv={csv} />} />
        <DashCard style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div data-print-hide="true" style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 240px', maxWidth: 320 }}>
              <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Search</span>
              <Input icon="search" placeholder="Name, email or user ID" value={f.q} onChange={(e) => set('q')(e.target.value)} />
            </div>
            <FilterSelect label="Status" value={f.status} onChange={set('status')} width={140} options={[ALL('All statuses'), 'ACTIVE', 'LOCKED', 'SUSPENDED']} />
            <FilterSelect label="Role" value={f.role} onChange={set('role')} width={120} options={[ALL('All roles'), 'TRADER', 'ADMIN']} />
            <FilterSelect label="Trader level" value={f.level} onChange={set('level')} width={150} options={[ALL('All levels'), 'Beginner', 'Intermediate', 'Advanced']} />
            <FilterSelect label="Flags" value={f.risk} onChange={set('risk')} width={170} options={[ALL('No flag filter'), { value: 'failed', label: 'Failed sign-ins' }, { value: 'nocash', label: 'No cash' }, { value: 'noacct', label: 'No accounts' }]} />
            {active ? <Button variant="ghost" icon="x" onClick={() => setF(EMPTY)}>Clear filters</Button> : null}
            <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 12, color: 'var(--muted-foreground)' }} className="tabular-nums">{list.length} of {USERS.length} customers</span>
          </div>
          <div style={{ ...tableHead, display: 'grid', gridTemplateColumns: UCOLS, gap: 8, padding: '0 8px 8px' }}>
            {H('name', 'Customer')}{H('status', 'Status')}{H('accounts', 'Accounts', 'right')}{H('cash', 'Cash', 'right')}{H('portfolio', 'Portfolio', 'right')}{H('failed', 'Failed sign-ins', 'right')}{H('last', 'Last active', 'right')}
          </div>
          <div className="ts-scroll" style={scrollList}>
          {list.length ? null : <p style={{ margin: 0, padding: '24px 8px', textAlign: 'center', fontSize: 14, color: 'var(--muted-foreground)' }}>No customers match these filters.</p>}
          {list.map((u) => (
            <RowButton key={u.id} onClick={() => openCustomer(u.id)} style={{ display: 'grid', gridTemplateColumns: UCOLS, gap: 8, alignItems: 'center', padding: '10px 8px', fontSize: 14 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-15)', color: 'var(--primary)', fontSize: 12, fontWeight: 600 }}>{u.initials}</span>
                <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontWeight: 500 }}>{u.name}</span><span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</span></span>
              </span>
              <span><StatusPill status={u.status} /></span>
              <span style={{ textAlign: 'right' }} className="tabular-nums">{u.accounts}</span>
              <span style={{ textAlign: 'right' }} className="tabular-nums">{money(u.cash)}</span>
              <span style={{ textAlign: 'right' }} className="tabular-nums">{money(u.portfolio)}</span>
              <span style={{ textAlign: 'right', color: u.failed >= 3 ? 'var(--color-loss)' : undefined }} className="tabular-nums">{u.failed}</span>
              <span style={{ textAlign: 'right', color: 'var(--muted-foreground)' }} className="tabular-nums">{u.last}</span>
            </RowButton>
          ))}
          </div>
        </DashCard>
      </div>
    );
  }

  function Info({ k, v, tone }) {
    return <div><DashLabel as="div" style={{ fontSize: 11 }}>{k}</DashLabel><div style={{ marginTop: 4, fontSize: 14, color: tone }} className="tabular-nums">{v}</div></div>;
  }

  function CustomerDetail({ userId, back }) {
    const base = USERS.find((u) => u.id === userId) || USERS[0];
    const [u, setU] = React.useState(base);
    const [open, setOpen] = React.useState(null);
    const orders = ORDERS.filter((o) => o.user === u.name);
    const accts = u.name === 'Sean Cheema' ? [['Growth', 7604.68], ['Retirement', 21380.4]] : u.accounts ? [['Primary', u.portfolio]] : [];
    const locked = u.status === 'LOCKED';
    return (
      <div style={screenRoot}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, flexShrink: 0 }}>
          <Button variant="outline" size="icon-lg" icon="chevron-left" aria-label="Back to customers" onClick={back} />
          <span style={{ width: 40, height: 40, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-15)', color: 'var(--primary)', fontSize: 14, fontWeight: 600 }}>{u.initials}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em' }}>{u.name}</h1><StatusPill status={u.status} /></div>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>{u.email} · {u.id} · {u.role.toLowerCase()}</p>
          </div>
          <ExportMenu />
          <Button variant="outline" size="lg" icon="mail">Email customer</Button>
        </header>
        {locked ? (
          <div role="status" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,0,55,.3)', background: 'var(--loss-10)', fontSize: 14 }}>
            <Icon name="lock" size={16} color="var(--color-loss)" />
            <span style={{ flex: 1 }}>Account locked after {u.failed} failed sign-in attempts. Unlocks automatically {u.locked}.</span>
            <Button size="lg" radius={5} icon="lock-open" onClick={() => setU({ ...u, status: 'ACTIVE', failed: 0, locked: null })}>Unlock now</Button>
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: 12, flexShrink: 0 }}>
          <DashCard>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Profile</h2>
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14 }}>
              <Info k="Trader level" v={u.level} /><Info k="Role" v={u.role} />
              <Info k="Last active" v={u.last} /><Info k="Member since" v="Jan 2, 2026" />
            </div>
          </DashCard>
          <DashCard>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Security</h2>
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14 }}>
              <Info k="Account status" v={u.status} tone={locked ? 'var(--color-loss)' : undefined} /><Info k="Failed attempts" v={u.failed} tone={u.failed >= 3 ? 'var(--color-loss)' : undefined} />
              <Info k="Locked until" v={u.locked || '—'} /><Info k="Idle timeout" v="15 minutes" />
            </div>
          </DashCard>
          <DashCard variant="net-worth">
            <DashLabel>Total balance</DashLabel>
            <p style={{ margin: '4px 0 0', fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums">{money(u.cash + u.portfolio, 0)}</p>
            <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, fontSize: 14 }}>
              <li style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(238,250,255,.12)' }}><span style={{ color: 'var(--muted-foreground)' }}>Cash (shared)</span><span className="tabular-nums">{money(u.cash)}</span></li>
              {accts.map(([n, v]) => <li key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(238,250,255,.12)' }}><span style={{ color: 'var(--muted-foreground)' }}>{n}</span><span className="tabular-nums">{money(v)}</span></li>)}
            </ul>
          </DashCard>
        </div>
        <DashCard style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}><h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Orders</h2><span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Select an order to see its audit trail</span></div>
          {orders.length ? <OrderTable orders={orders} onOpen={setOpen} showUser={false} /> : <p style={{ margin: 0, padding: '24px 8px', textAlign: 'center', fontSize: 14, color: 'var(--muted-foreground)' }}>This customer hasn't placed any orders yet.</p>}
        </DashCard>
        {open ? <OrderDetail order={open} onClose={() => setOpen(null)} /> : null}
      </div>
    );
  }
  Object.assign(window, { CustomersScreen, CustomerDetail });
})();
