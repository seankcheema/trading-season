(() => {
  const { Button } = window.TradingSeasonDesignSystem_86c3eb;
  function MobileLanding({ go }) {
    return (
      <div style={{ position: 'relative', display: 'flex', minHeight: '100%', flexDirection: 'column', overflow: 'hidden', padding: '0 20px', background: 'var(--background)' }}>
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '70%', pointerEvents: 'none', background: 'var(--texture-hairlines)', WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, #000 20%, transparent 75%)', maskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, #000 20%, transparent 75%)' }} />
        <header style={{ position: 'relative', display: 'flex', height: 72, alignItems: 'center', gap: 10 }}>
          <img src="../../assets/2b-waves.svg" alt="" style={{ width: 40, height: 40 }} />
          <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em' }}>TradingSeason</span>
        </header>
        <section style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 56, textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 52, lineHeight: 1, fontWeight: 600, letterSpacing: '-0.025em' }}>Ride the market.</h1>
          <p style={{ margin: '20px 0 0', maxWidth: 320, fontSize: 16, color: 'var(--muted-foreground)', textWrap: 'balance' }}>Live prices, instant trades, smarter portfolios. Stay ahead of the market.</p>
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
            <Button size="cta" fullWidth onClick={() => go('register')}>Get started</Button>
            <Button size="cta" variant="outline" radius={5} fullWidth style={{ fontWeight: 400, background: 'var(--background)', borderColor: 'var(--border)' }} onClick={() => go('login')}>Sign in</Button>
          </div>
        </section>
        <LandingGraph height="34%" bleed={20} />
      </div>
    );
  }
  window.MobileLanding = MobileLanding;
})();
