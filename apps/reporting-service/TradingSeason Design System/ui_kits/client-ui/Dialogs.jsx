(() => {
  const { Dialog, InstrumentSearch, ChangePill, TimeframeToggle, PriceChart, Field, Input, NativeSelect, Button } = window.TradingSeasonDesignSystem_86c3eb;
  const { INSTRUMENTS, series, LABELS, COUNTS, money, find } = window.TSData;

  function OrderDialog({ symbol, onClose, onSubmitted, onExpand }) {
    const [sym, setSym] = React.useState(symbol);
    const [tf, setTf] = React.useState('1D');
    const i = find(sym);
    return (
      <Dialog title="New Order" width={896} padded={false} closeLabel="Close order submission" onClose={onClose}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,1fr)' }}>
          <div style={{ display: 'flex', minWidth: 0, flexDirection: 'column', padding: 20, borderRight: '1px solid var(--border)' }}>
            <InstrumentSearch instruments={INSTRUMENTS} onSelect={(x) => setSym(x.symbol)} />
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <InstrumentBadge symbol={i.symbol} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 18, lineHeight: 1.25, fontWeight: 600 }}>{i.symbol}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>{i.name}</p>
              </div>
              {onExpand ? <Button variant="ghost" size="sm" iconEnd="maximize-2" onClick={() => onExpand(i.symbol)}>Full view</Button> : null}
            </div>
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
              <p style={{ margin: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 12 }}>
                <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em' }} className="tabular-nums">{money(i.price)}</span>
                <ChangePill tone={i.change >= 0 ? 'gain' : 'loss'}>{(i.change >= 0 ? '+' : '') + money(i.change) + ' (' + (i.changePercent >= 0 ? '+' : '') + i.changePercent.toFixed(2) + '%)'}</ChangePill>
              </p>
              <TimeframeToggle value={tf} onChange={setTf} />
            </div>
            <PriceChart points={series(i.symbol + tf, COUNTS[tf], i.price)} labels={LABELS[tf]} height={224} style={{ marginTop: 4 }} />
          </div>
          <OrderTicket instrument={i} style={{ padding: 20 }} onSubmit={(o) => { onSubmitted && onSubmitted(o); onClose(); }} />
        </div>
      </Dialog>
    );
  }

  function CashDialog({ mode, onClose, cash }) {
    const dep = mode === 'deposit';
    const [amt, setAmt] = React.useState('');
    const [touched, setTouched] = React.useState(false);
    const v = Number(amt);
    const err = !amt || v <= 0 ? 'Enter an amount greater than $0.' : !dep && v > cash ? "That's more than your available cash." : '';
    return (
      <Dialog title={dep ? 'Deposit funds' : 'Withdraw funds'} closeLabel={dep ? 'Close deposit' : 'Close withdrawal'} onClose={onClose}>
        <form noValidate onSubmit={(e) => { e.preventDefault(); setTouched(true); if (!err) onClose(); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Amount" htmlFor="cashAmount" error={touched && err} description={<span className="tabular-nums">Available cash: {money(cash)}</span>}>
            <Input id="cashAmount" type="number" placeholder="0.00" radius={5} value={amt} onChange={(e) => setAmt(e.target.value)} invalid={touched && !!err} />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="outline" radius={5} onClick={onClose}>Cancel</Button>
            <Button type="submit" radius={5}>{dep ? 'Deposit' : 'Withdraw'}</Button>
          </div>
        </form>
      </Dialog>
    );
  }

  function SettingsDialog({ onClose }) {
    return (
      <Dialog title="Settings" closeLabel="Close settings" onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Security</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--muted-foreground)' }}>Control how long you stay signed in on this browser.</p>
          </div>
          <Field label="Sign out after inactivity" htmlFor="idle" description="You will be signed out automatically when there is no mouse, keyboard or touch input for this long. Changes apply immediately.">
            <NativeSelect id="idle" radius={5} value="15" options={[{ value: '5', label: '5 minutes' }, { value: '15', label: '15 minutes (default)' }, { value: '30', label: '30 minutes' }, { value: '60', label: '60 minutes' }]} />
          </Field>
        </div>
      </Dialog>
    );
  }
  Object.assign(window, { OrderDialog, CashDialog, SettingsDialog });
})();
