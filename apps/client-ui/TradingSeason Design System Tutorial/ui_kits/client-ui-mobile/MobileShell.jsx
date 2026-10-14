(() => {
  const { Icon, ChangePill, Sparkline, DashLink } = window.TradingSeasonDesignSystem_86c3eb;
  const { POSITIONS, ACCOUNTS, series, money, pct, find } = window.TSData;
  const CASH = 4820.55;

  const holdingsOf = () => Object.entries(POSITIONS).map(([sym, p]) => { const i = find(sym); return { i, ...p, value: p.shares * i.price, gl: p.shares * (i.price - p.cost) }; });
  const todaySeries = (i) => series(i.symbol + 'today', 27, i.price).map((v) => (i.change < 0 ? 2 * i.price - v : v));

  // Touch-friendly row/button: muted wash while pressed or hovered.
  function Pressable({ children, onClick, style, label }) {
    const [on, setOn] = React.useState(false);
    return (
      <button type="button" aria-label={label} onClick={onClick} onPointerEnter={() => setOn(true)} onPointerLeave={() => setOn(false)} onPointerDown={() => setOn(true)} onPointerUp={() => setOn(false)}
        style={{ border: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer', transition: 'background 150ms', background: on ? 'var(--muted)' : 'transparent', WebkitTapHighlightColor: 'transparent', ...style }}>{children}</button>
    );
  }
  const IconBtn = ({ icon, label, onClick }) => (
    <Pressable label={label} onClick={onClick} style={{ width: 44, height: 44, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}><Icon name={icon} size={20} /></Pressable>
  );

  function TopBar({ accountId, onAccount, onSearch, onProfile }) {
    const acct = ACCOUNTS.find((a) => a.id === accountId) || ACCOUNTS[0];
    return (
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, height: 56, flexShrink: 0, padding: '0 8px 0 16px', background: 'rgba(14,14,14,.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderBottom: '1px solid var(--border-60)', zIndex: 5 }}>
        <img src="../../assets/2b-waves.svg" alt="TradingSeason" style={{ width: 28, height: 28 }} />
        <Pressable onClick={onAccount} label="Select account" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 10px 0 12px', borderRadius: 9999, border: '1px solid var(--border)', fontSize: 14, fontWeight: 500 }}>
          <Icon name="briefcase-business" size={14} style={{ color: 'var(--muted-foreground)' }} />{acct.name}<Icon name="chevron-down" size={14} style={{ color: 'var(--muted-foreground)' }} />
        </Pressable>
        <div style={{ flex: 1 }} />
        <IconBtn icon="search" label="Search instruments" onClick={onSearch} />
        <Pressable onClick={onProfile} label="Open account" style={{ width: 36, height: 36, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-15)' }}>SC</Pressable>
      </header>
    );
  }

  const TABS = [['home', 'Home', 'house'], ['assets', 'Assets', 'chart-pie'], ['activity', 'Activity', 'arrow-right-left'], ['account', 'Account', 'user-round']];
  function TabBar({ tab, setTab }) {
    return (
      <nav aria-label="Primary" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', flexShrink: 0, height: 64, paddingBottom: 'env(safe-area-inset-bottom)', background: 'var(--card)', borderTop: '1px solid var(--border)', zIndex: 5 }}>
        {TABS.map(([k, label, icon]) => {
          const on = tab === k;
          return (
            <button key={k} type="button" aria-current={on ? 'page' : undefined} onClick={() => setTab(k)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, border: 0, background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 500, color: on ? 'var(--primary)' : 'var(--muted-foreground)', transition: 'color 150ms', WebkitTapHighlightColor: 'transparent' }}>
              <Icon name={icon} size={20} />{label}
            </button>
          );
        })}
      </nav>
    );
  }

  // Mobile adaptation of the dialog: bottom sheet with grab handle, same bordered header.
  function BottomSheet({ title, onClose, children, tall }) {
    React.useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onClose]);
    const { CloseButton } = window.TradingSeasonDesignSystem_86c3eb;
    return (
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', background: 'var(--scrim)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', animation: 'ts-fade-in 150ms ease-out both' }}>
        <section role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', flexDirection: 'column', width: '100%', height: tall ? '92%' : undefined, maxHeight: '92%', background: 'var(--card)', borderTop: '1px solid var(--border)', borderRadius: '16px 16px 0 0', boxShadow: 'var(--shadow-dialog)', animation: 'ts-sheet-in 260ms cubic-bezier(0.16,1,0.3,1) both' }}>
          <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 9999, background: 'var(--foreground-10)', margin: '8px auto 0' }} />
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '4px 12px 8px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h2>
            <CloseButton onClick={onClose} />
          </header>
          <div className="ts-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px calc(20px + env(safe-area-inset-bottom))' }}>{children}</div>
        </section>
      </div>
    );
  }

  const SectionHead = ({ title, action, onAction }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h2>
      {action ? <DashLink onClick={onAction} style={{ minHeight: 32 }}>{action}</DashLink> : null}
    </div>
  );

  function AssetRow({ h, onClick, last }) {
    const i = h.i;
    return (
      <Pressable onClick={onClick} label={'Trade ' + i.symbol} style={{ display: 'grid', gridTemplateColumns: '36px minmax(0,1fr) 56px auto', alignItems: 'center', gap: 12, width: 'calc(100% + 16px)', margin: '0 -8px', minHeight: 60, padding: '8px', borderRadius: 10, borderBottom: last ? 0 : '1px solid var(--border-60)' }}>
        <InstrumentBadge symbol={i.symbol} size={36} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{i.symbol}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} className="tabular-nums">{h.shares != null ? h.shares + ' shares' : i.name}</span>
        </span>
        <Sparkline points={todaySeries(i)} />
        <span style={{ textAlign: 'right' }} className="tabular-nums">
          <span style={{ display: 'block', fontSize: 14 }}>{money(h.value != null ? h.value : i.price)}</span>
          <span style={{ display: 'block', fontSize: 12, color: i.changePercent >= 0 ? 'var(--color-gain)' : 'var(--color-loss)' }}>{pct(i.changePercent)}</span>
        </span>
      </Pressable>
    );
  }

  function TxRow({ t, last }) {
    const cashT = t.kind === 'cash', dep = t.reason === 'DEPOSIT';
    return (
      <li style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 56, padding: '8px 0', fontSize: 14, borderBottom: last ? 0 : '1px solid var(--border-60)' }}>
        <span style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 500 }}>{cashT ? 'Cash' : t.symbol}</span>
          <ChangePill tag tone={cashT ? (dep ? 'gain' : 'loss') : t.side === 'buy' ? 'primary' : 'loss'} style={{ marginLeft: 8 }}>{cashT ? (dep ? 'deposit' : 'withdrawal') : t.side}</ChangePill>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }}>{t.date}</span>
        </span>
        <span style={{ flexShrink: 0, textAlign: 'right' }} className="tabular-nums">
          <span style={{ display: 'block' }}>{cashT ? (dep ? '+' : '-') + money(t.value) : money(t.shares * t.price)}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }}>{cashT ? 'Cash transfer' : t.shares + ' @ ' + money(t.price)}</span>
        </span>
      </li>
    );
  }

  Object.assign(window, { MobileKit: { CASH, holdingsOf, todaySeries }, Pressable, TopBar, TabBar, BottomSheet, SectionHead, AssetRow, TxRow });
})();
