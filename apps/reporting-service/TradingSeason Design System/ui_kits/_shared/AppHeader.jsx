(() => {
  const { HeaderDropdown, MenuItem, Icon, Button } = window.TradingSeasonDesignSystem_86c3eb;
  const { ACCOUNTS, money } = window.TSData;

  function AppHeader({ accountId = 1, onAccount, onSettings, onSignOut, onLogo, left, hideLogo, clock = 'Sep 14, 2026 · 3:45 PM CT' }) {
    const acct = ACCOUNTS.find((a) => a.id === accountId) || ACCOUNTS[0];
    return (
      <header style={{ display: 'flex', minHeight: 64, flexShrink: 0, alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {hideLogo ? null : (
            <button type="button" onClick={onLogo} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 0, padding: 0, cursor: onLogo ? 'pointer' : 'default' }}>
              <img src="../../assets/2b-waves.svg" alt="" style={{ width: 32, height: 32 }} />
              <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.025em' }}>TradingSeason</span>
            </button>
          )}
          {left}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <HeaderDropdown icon="calendar-clock" label={clock} ariaLabel="Change simulated market time" panelStyle={{ padding: 12 }}>
            {(close) => (
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }} className="tabular-nums">{clock}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>Range: Jan 2 – Sep 14, 2026</p>
                <label style={{ display: 'block', marginTop: 12, color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Simulated time</label>
                <input type="datetime-local" defaultValue="2026-09-14T15:45" style={{ marginTop: 8, height: 36, width: '100%', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', padding: '0 12px', fontSize: 14, colorScheme: 'dark' }} />
                <Button size="lg" fullWidth style={{ marginTop: 12 }} onClick={close}>Apply time</Button>
              </div>
            )}
          </HeaderDropdown>
          <HeaderDropdown icon="briefcase-business" label={acct.name} ariaLabel="Select account">
            {(close) => (
              <div role="menu">
                {ACCOUNTS.map((a) => (
                  <MenuItem key={a.id} onClick={() => { onAccount && onAccount(a.id); close(); }}
                    trailing={a.id === accountId ? <Icon name="check" color="var(--primary)" /> : null}>
                    <span style={{ display: 'block' }}>{a.name}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }} className="tabular-nums">Portfolio {money(a.id === 1 ? 7604.68 : 21380.4)}</span>
                  </MenuItem>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                <MenuItem tone="primary" icon="plus" onClick={close}>New account</MenuItem>
              </div>
            )}
          </HeaderDropdown>
          <HeaderDropdown trigger="SC" ariaLabel="Open profile menu">
            {(close) => (
              <div role="menu">
                <MenuItem icon="settings" onClick={() => { close(); onSettings && onSettings(); }}>Settings</MenuItem>
                <MenuItem icon="log-out" tone="danger" onClick={() => { close(); onSignOut && onSignOut(); }}>Log out</MenuItem>
              </div>
            )}
          </HeaderDropdown>
        </div>
      </header>
    );
  }
  window.AppHeader = AppHeader;
})();
