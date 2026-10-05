(() => {
  const { Button } = window.TradingSeasonDesignSystem_86c3eb;

  // Decorative stock graph from landing.component.html (fixed path instead of generated series).
  function LandingGraph() {
    const d = 'M0 330 C90 322 150 300 220 306 S340 262 420 272 S540 236 610 250 S720 196 800 206 S930 150 1000 164 S1110 110 1180 98';
    const ghost = 'M0 350 C120 344 200 330 300 318 S460 300 560 286 S760 262 880 240 S1060 214 1180 190 S1350 170 1440 160';
    return (
      <div aria-hidden="true" style={{ position: 'relative', marginTop: 'auto', height: '45vh', minHeight: 240, marginLeft: -32, marginRight: -32 }}>
        <svg viewBox="0 0 1440 420" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', WebkitMaskImage: 'linear-gradient(to right, transparent, #000 25%), linear-gradient(to bottom, #000 75%, transparent)', WebkitMaskComposite: 'source-in', maskImage: 'linear-gradient(to right, transparent, #000 25%), linear-gradient(to bottom, #000 75%, transparent)', maskComposite: 'intersect', animation: 'ts-reveal 1.6s cubic-bezier(0.65,0,0.35,1) both' }}>
          <defs>
            <linearGradient id="lg-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#00bbff" stopOpacity="0.28" /><stop offset="1" stopColor="#00bbff" stopOpacity="0" /></linearGradient>
            <linearGradient id="lg-line" gradientUnits="userSpaceOnUse" x1="0" x2="1440" y1="0" y2="0"><stop offset="0" stopColor="#c6e8f5" /><stop offset="0.45" stopColor="#58c9f4" /><stop offset="0.82" stopColor="#00bbff" /></linearGradient>
            <linearGradient id="lg-fade" gradientUnits="userSpaceOnUse" x1="940" x2="1180" y1="0" y2="0"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
            <mask id="lg-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="420"><rect width="1440" height="420" fill="url(#lg-fade)" /></mask>
            <filter id="lg-glow" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
          </defs>
          {[70, 140, 210, 280, 350].map((y) => <line key={y} x1="0" x2="1440" y1={y} y2={y} stroke="#eefaff" strokeOpacity="0.06" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />)}
          <path d={ghost} fill="none" stroke="#58c9f4" strokeOpacity="0.22" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d={d + ' L1180 420 L0 420 Z'} fill="url(#lg-area)" mask="url(#lg-mask)" />
          <path d={d} fill="none" stroke="#00bbff" strokeOpacity="0.5" strokeWidth="6" strokeLinejoin="round" filter="url(#lg-glow)" />
          <path d={d} fill="none" stroke="url(#lg-line)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span style={{ position: 'absolute', left: (1180 / 1440) * 100 + '%', top: (98 / 420) * 100 + '%', width: 12, height: 12, transform: 'translate(-50%,-50%)', animation: 'ts-dot-in 0.5s ease-out 1.3s both' }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--primary)', animation: 'ts-pulse 2.4s ease-out infinite' }} />
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 0 4px var(--background)' }} />
        </span>
      </div>
    );
  }

  function Landing({ go }) {
    return (
      <div style={{ position: 'relative', display: 'flex', minHeight: '100vh', flexDirection: 'column', overflow: 'hidden', padding: '0 32px', background: 'var(--background)' }}>
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '70vh', pointerEvents: 'none', background: 'var(--texture-hairlines)', WebkitMaskImage: 'radial-gradient(ellipse 60% 80% at 50% 30%, #000 20%, transparent 75%)', maskImage: 'radial-gradient(ellipse 60% 80% at 50% 30%, #000 20%, transparent 75%)' }} />
        <header style={{ position: 'relative', margin: '0 auto', display: 'flex', height: 112, width: '100%', maxWidth: 1152, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="../../assets/2b-waves.svg" alt="" style={{ width: 56, height: 56 }} />
            <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em' }}>TradingSeason</span>
          </span>
        </header>
        <main style={{ position: 'relative', display: 'flex', flex: 1, flexDirection: 'column' }}>
          <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 8px 0', textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 96, lineHeight: 1, fontWeight: 600, letterSpacing: '-0.025em' }}>Ride the market.</h1>
            <p style={{ margin: '24px 0 0', maxWidth: 576, fontSize: 18, color: 'var(--muted-foreground)', textWrap: 'balance' }}>Live prices, instant trades, smarter portfolios. Stay ahead of the market.</p>
            <div style={{ marginTop: 40, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
              <Button size="cta" onClick={() => go('register')}>Get started</Button>
              <Button size="cta" variant="outline" radius={5} style={{ fontWeight: 400, background: 'var(--background)', borderColor: 'var(--border)' }} onClick={() => go('login')}>Sign in</Button>
            </div>
          </section>
          <LandingGraph />
        </main>
      </div>
    );
  }
  window.Landing = Landing;
})();
