(() => {
  const { DashCard, DashLabel, ChangePill, TimeframeToggle, PriceChart, Field, Input, NativeSelect, Button, Icon, MenuItem } = window.TradingSeasonDesignSystem_86c3eb;
  const { INSTRUMENTS, ACCOUNTS, series, LABELS, COUNTS, money, pct, find } = window.TSData;
  const { CASH } = window.MobileKit;

  function OrderSheet({ symbol, onClose }) {
    const [tf, setTf] = React.useState('1D');
    const i = find(symbol);
    return (
      <BottomSheet title="New Order" tall onClose={onClose}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <InstrumentBadge symbol={i.symbol} />
          <div style={{ minWidth: 0, flex: 1 }}><p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 18, lineHeight: 1.25, fontWeight: 600 }}>{i.symbol}<WatchlistStar symbol={i.symbol} size={40} /></p><p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>{i.name}</p></div>
        </div>
        <p style={{ margin: '12px 0 0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 10 }}>
          <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums">{money(i.price)}</span>
          <ChangePill tone={i.change >= 0 ? 'gain' : 'loss'}>{(i.change >= 0 ? '+' : '') + money(i.change) + ' (' + pct(i.changePercent) + ')'}</ChangePill>
        </p>
        <PriceChart points={series(i.symbol + tf, COUNTS[tf], i.price)} labels={[LABELS[tf][0], LABELS[tf][2], LABELS[tf][4]]} height={170} style={{ marginTop: 4, gridTemplateColumns: 'minmax(0,1fr) 3.5rem' }} />
        <TimeframeToggle value={tf} onChange={setTf} style={{ marginTop: 12, width: '100%', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }} />
        <div style={{ margin: '20px -20px 0', borderTop: '1px solid var(--border)', padding: '20px 20px 0' }}>
          <OrderTicket key={symbol} instrument={i} onSubmit={onClose} />
        </div>
      </BottomSheet>
    );
  }

  function CashSheet({ mode, onClose }) {
    const dep = mode === 'deposit';
    const [amt, setAmt] = React.useState('');
    const [touched, setTouched] = React.useState(false);
    const v = Number(amt);
    const err = !amt || v <= 0 ? 'Enter an amount greater than $0.' : !dep && v > CASH ? "That's more than your available cash." : '';
    return (
      <BottomSheet title={dep ? 'Deposit funds' : 'Withdraw funds'} onClose={onClose}>
        <form noValidate onSubmit={(e) => { e.preventDefault(); setTouched(true); if (!err) onClose(); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Amount" htmlFor="m-cash" error={touched && err} description={<span className="tabular-nums">Available cash: {money(CASH)}</span>}>
            <Input id="m-cash" icon="dollar-sign" type="number" inputMode="decimal" placeholder="0.00" radius={5} height={44} value={amt} onChange={(e) => setAmt(e.target.value)} invalid={touched && !!err} inputStyle={{ fontSize: 16 }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Button variant="outline" radius={5} style={{ height: 44 }} onClick={onClose}>Cancel</Button>
            <Button type="submit" radius={5} style={{ height: 44 }}>{dep ? 'Deposit' : 'Withdraw'}</Button>
          </div>
        </form>
      </BottomSheet>
    );
  }

  function SearchSheet({ onClose, openOrder }) {
    const [q, setQ] = React.useState('');
    const watched = window.TSData.useWatchlist();
    const t = q.trim().toLowerCase();
    const list = INSTRUMENTS.filter((i) => i.symbol.toLowerCase().includes(t) || i.name.toLowerCase().includes(t));
    const go = (s) => { onClose(); window.TSData.recent.push(s); openOrder(s); };
    const groups = t ? [] : window.TSData.searchSuggestions(watched).filter((g) => g.items.length);
    return (
      <BottomSheet title="Trade" tall onClose={onClose}>
        <Input icon="search" type="search" autoFocus placeholder="Search a stock to buy or sell" height={44} radius={12} value={q} onChange={(e) => setQ(e.target.value)} inputStyle={{ fontSize: 16, background: 'var(--background)' }} />
        {t ? (
          <>
            <DashLabel as="p" style={{ margin: '20px 0 4px' }}>Results</DashLabel>
            {list.length ? list.map((i, k) => <AssetRow key={i.symbol} h={{ i }} last={k === list.length - 1} onClick={() => go(i.symbol)} />)
              : <p style={{ margin: 0, padding: '16px 0', fontSize: 14, color: 'var(--muted-foreground)' }}>No instruments match "{q}"</p>}
          </>
        ) : groups.map((g) => (
          <div key={g.label}>
            <DashLabel as="p" style={{ margin: '20px 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name={g.icon} size={12} />{g.label}</DashLabel>
            {g.items.map((i, k) => <AssetRow key={i.symbol} h={{ i }} last={k === g.items.length - 1} onClick={() => go(i.symbol)} />)}
          </div>
        ))}
      </BottomSheet>
    );
  }

  function AccountSheet({ accountId, onPick, onClose }) {
    return (
      <BottomSheet title="Accounts" onClose={onClose}>
        <div role="menu" style={{ margin: '-8px -12px 0' }}>
          {ACCOUNTS.map((a) => (
            <MenuItem key={a.id} style={{ minHeight: 56 }} onClick={() => { onPick(a.id); onClose(); }} trailing={a.id === accountId ? <Icon name="check" color="var(--primary)" /> : null}>
              <span style={{ display: 'block' }}>{a.name}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }} className="tabular-nums">Portfolio {money(a.id === 1 ? 7604.68 : 21380.4)}</span>
            </MenuItem>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
          <MenuItem tone="primary" icon="plus" style={{ minHeight: 48 }} onClick={onClose}>New account</MenuItem>
        </div>
      </BottomSheet>
    );
  }

  function MobileAccount({ accountId, onPick, onSignOut }) {
    return (
      <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <DashCard padding={16} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 48, height: 48, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-15)', color: 'var(--primary)', fontSize: 16, fontWeight: 600 }}>SC</span>
          <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>Sean Cheema</span><span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }}>sean@example.com · Advanced</span></span>
        </DashCard>
        <DashCard padding={8}>
          <DashLabel as="p" style={{ margin: '8px 8px 4px' }}>Accounts</DashLabel>
          {ACCOUNTS.map((a) => (
            <MenuItem key={a.id} style={{ minHeight: 56 }} onClick={() => onPick(a.id)} trailing={a.id === accountId ? <Icon name="check" color="var(--primary)" /> : null}>
              <span style={{ display: 'block' }}>{a.name}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }} className="tabular-nums">Portfolio {money(a.id === 1 ? 7604.68 : 21380.4)}</span>
            </MenuItem>
          ))}
          <MenuItem tone="primary" icon="plus" style={{ minHeight: 48 }}>New account</MenuItem>
        </DashCard>
        <DashCard padding={16}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Security</h3>
          <p style={{ margin: '2px 0 16px', fontSize: 14, color: 'var(--muted-foreground)' }}>Control how long you stay signed in on this browser.</p>
          <Field label="Sign out after inactivity" htmlFor="m-idle" description="You will be signed out automatically when there is no mouse, keyboard or touch input for this long. Changes apply immediately.">
            <NativeSelect id="m-idle" radius={5} value="15" style={{ height: 44 }} options={[{ value: '5', label: '5 minutes' }, { value: '15', label: '15 minutes (default)' }, { value: '30', label: '30 minutes' }, { value: '60', label: '60 minutes' }]} />
          </Field>
        </DashCard>
        <DashCard padding={8}><MenuItem icon="log-out" tone="danger" style={{ minHeight: 48 }} onClick={onSignOut}>Log out</MenuItem></DashCard>
      </div>
    );
  }
  Object.assign(window, { OrderSheet, CashSheet, SearchSheet, AccountSheet, MobileAccount });
})();
