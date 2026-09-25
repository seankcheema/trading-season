(() => {
  const { Icon, ChangePill } = window.TradingSeasonDesignSystem_86c3eb;

  const NAV = [['activity', 'Activity', 'activity'], ['customers', 'Customers', 'users'], ['orders', 'Orders', 'list-ordered']];

  function NavItem({ on, icon, children, onClick }) {
    const [h, setH] = React.useState(false);
    return (
      <button type="button" onClick={onClick} aria-current={on ? 'page' : undefined} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, height: 36, width: '100%', padding: '0 10px', border: 0, borderRadius: 8, fontSize: 14, fontWeight: on ? 500 : 400, cursor: 'pointer', textAlign: 'left', transition: 'all 150ms',
          background: on ? 'var(--muted)' : h ? 'rgba(26,26,26,.5)' : 'transparent', color: on ? 'var(--foreground)' : h ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
        <Icon name={icon} size={16} style={{ color: on ? 'var(--primary)' : undefined }} />{children}
      </button>
    );
  }

  const STATUS_TONE = { ACTIVE: 'gain', LOCKED: 'loss', SUSPENDED: 'muted', FILLED: 'gain', PENDING: 'primary', REJECTED: 'loss', CANCELLED: 'muted' };
  function StatusPill({ status }) { return <ChangePill tag tone={STATUS_TONE[status] || 'muted'}>{status.toLowerCase()}</ChangePill>; }

  function ReportingShell({ screen, go, children }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '232px minmax(0,1fr)', height: '100vh', background: 'var(--background)' }}>
        <aside data-print-hide="true" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px 16px', background: 'var(--card)', borderRight: '1px solid rgba(238,250,255,.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 64, padding: '0 6px' }}>
            <img src="../../assets/2b-waves.svg" alt="" style={{ width: 28, height: 28 }} />
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}><span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.025em' }}>TradingSeason</span><span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Reporting</span></span>
          </div>
          {NAV.map(([k, label, icon]) => <NavItem key={k} on={screen === k || (screen === 'customer' && k === 'customers')} icon={icon} onClick={() => go(k)}>{label}</NavItem>)}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderTop: '1px solid rgba(238,250,255,.1)' }}>
            <span style={{ width: 32, height: 32, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-15)', color: 'var(--primary)', fontSize: 12, fontWeight: 600 }}>AB</span>
            <span style={{ minWidth: 0, lineHeight: 1.3 }}><span style={{ display: 'block', fontSize: 14 }}>Ada Brooks</span><span style={{ display: 'block', fontSize: 12, color: 'var(--muted-foreground)' }}>Analyst · Admin</span></span>
          </div>
        </aside>
        <div style={{ minWidth: 0, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0 24px 16px' }}>{children}</div>
      </div>
    );
  }

  function PageHeader({ title, sub, right }) {
    return (
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 64, flexWrap: 'wrap' }}>
        <div><h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em' }}>{title}</h1>{sub ? <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>{sub}</p> : null}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>
      </header>
    );
  }
  const tableHead = { color: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: 8 };
  function RowButton({ children, style, onClick }) {
    const [h, setH] = React.useState(false);
    return <button type="button" onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ width: '100%', border: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer', borderRadius: 8, background: h ? 'var(--muted)' : 'transparent', transition: 'background 150ms', ...style }}>{children}</button>;
  }
  const screenRoot = { display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 };
  const scrollList = { flex: 1, minHeight: 0, overflowY: 'auto', WebkitMaskImage: 'linear-gradient(to bottom, #000 calc(100% - 2rem), transparent)' };

  // Clickable column header: label + sort chevron. sort = { key, dir }.
  function SortHead({ k, sort, setSort, align, children }) {
    const on = sort.key === k;
    const [h, setH] = React.useState(false);
    return (
      <button type="button" onClick={() => setSort({ key: k, dir: on && sort.dir === 'desc' ? 'asc' : 'desc' })} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: align === 'right' ? 'flex-end' : 'flex-start', background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: on || h ? 'var(--foreground)' : 'inherit', transition: 'color 150ms' }}>
        {children}
        <Icon name={on ? (sort.dir === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down'} size={12} style={{ opacity: on ? 1 : 0.6, color: on ? 'var(--primary)' : undefined }} />
      </button>
    );
  }
  function sortRows(rows, sort, get) {
    const out = rows.slice().sort((a, b) => { const x = get(a, sort.key), y = get(b, sort.key); return typeof x === 'string' ? x.localeCompare(y) : x - y; });
    return sort.dir === 'desc' ? out.reverse() : out;
  }

  function downloadCsv(name, cols, rows) {
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = [cols.map((c) => esc(c[0])).join(',')].concat(rows.map((r) => cols.map((c) => esc(c[1](r))).join(','))).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = name + '.csv';
    a.click();
  }
  // Export dropdown: CSV of the current (filtered, sorted) rows, or PDF via the print dialog.
  function ExportMenu({ onCsv }) {
    const { HeaderDropdown, MenuItem } = window.TradingSeasonDesignSystem_86c3eb;
    return (
      <HeaderDropdown icon="download" label="Export" width={116} panelWidth={176} ariaLabel="Export this view">
        {(close) => (
          <div role="menu">
            {onCsv ? <MenuItem icon="file-spreadsheet" onClick={() => { close(); onCsv(); }}>Export CSV</MenuItem> : null}
            <MenuItem icon="file-text" onClick={() => { close(); setTimeout(() => window.print(), 50); }}>Export PDF</MenuItem>
          </div>
        )}
      </HeaderDropdown>
    );
  }
  // Filter row control: tiny uppercase caption over a Select.
  function FilterSelect({ label, value, onChange, options, width = 150 }) {
    const { Select } = window.TradingSeasonDesignSystem_86c3eb;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{label}</span>
        <Select value={value} onChange={onChange} width={width} options={options} />
      </div>
    );
  }
  Object.assign(window, { ReportingShell, PageHeader, StatusPill, tableHead, RowButton, screenRoot, scrollList, SortHead, sortRows, downloadCsv, ExportMenu, FilterSelect });
})();
