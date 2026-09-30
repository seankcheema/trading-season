(() => {
  const { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Field, FieldChecklist, Input, NativeSelect, Button } = window.TradingSeasonDesignSystem_86c3eb;

  function AuthShell({ children }) {
    return (
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', background: 'var(--background)' }}>
        <img src="../../assets/2b-waves-lockup-reversed.svg" alt="TradingSeason" style={{ position: 'fixed', top: 0, left: 0, zIndex: 10, height: 144, width: 'auto' }} />
        {children}
      </div>
    );
  }
  const FooterLink = ({ q, link, onClick }) => (
    <p style={{ margin: 0, fontSize: 14, color: 'var(--muted-foreground)' }}>{q} <a href="#" onClick={(e) => { e.preventDefault(); onClick(); }} style={{ fontWeight: 500 }}>{link}</a></p>
  );

  function Login({ go, timedOut }) {
    const [email, setEmail] = React.useState('');
    const [touched, setTouched] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const bad = touched && !/^\S+@\S+\.\S+$/.test(email);
    const submit = (e) => { e.preventDefault(); setTouched(true); if (!/^\S+@\S+\.\S+$/.test(email)) return; setLoading(true); setTimeout(() => go('dashboard'), 700); };
    return (
      <AuthShell>
        <Card radius={10} style={{ width: '100%', maxWidth: 384 }}>
          <CardHeader align="center"><CardTitle as="h1" style={{ fontSize: 20 }}>Welcome back</CardTitle><CardDescription>Sign in to your Trading Season account</CardDescription></CardHeader>
          <CardContent>
            {timedOut ? <p role="status" style={{ margin: '0 0 20px', padding: '8px 12px', borderRadius: 5, background: 'var(--muted)', fontSize: 14 }}>You were signed out after a period of inactivity. Sign in again to continue.</p> : null}
            <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Field label="Email" htmlFor="email" error={bad && 'Enter a valid email address.'}>
                <Input id="email" icon="mail" type="email" radius={5} placeholder="you@example.com" value={email} invalid={bad} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} />
              </Field>
              <Field label="Password" htmlFor="password"><Input id="password" icon="lock" reveal radius={5} placeholder="••••••••" defaultValue="season2026!" /></Field>
              <Button type="submit" icon="log-in" radius={5} fullWidth loading={loading} style={{ marginTop: 4, opacity: loading ? 0.7 : 1 }}>{loading ? 'Signing in...' : 'Sign in'}</Button>
            </form>
          </CardContent>
          <CardFooter style={{ justifyContent: 'center' }}><FooterLink q="Don't have an account?" link="Create one" onClick={() => go('register')} /></CardFooter>
        </Card>
      </AuthShell>
    );
  }

  function Register({ go }) {
    const [pw, setPw] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const two = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
    return (
      <AuthShell>
        <Card radius={10} style={{ width: '100%', maxWidth: 448 }}>
          <CardHeader align="center"><CardTitle as="h1" style={{ fontSize: 20 }}>Create an account</CardTitle><CardDescription>Join Trading Season to get started</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); setLoading(true); setTimeout(() => go('dashboard'), 700); }} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={two}>
                <Field label="First name" htmlFor="fn"><Input id="fn" radius={5} placeholder="Jane" /></Field>
                <Field label="Middle name" htmlFor="mn"><Input id="mn" radius={5} placeholder="Optional" /></Field>
              </div>
              <Field label="Last name" htmlFor="ln"><Input id="ln" radius={5} placeholder="Doe" /></Field>
              <Field label="Email" htmlFor="em"><Input id="em" icon="mail" type="email" radius={5} placeholder="you@example.com" /></Field>
              <div style={two}>
                <Field label="Date of birth" htmlFor="dob"><Input id="dob" type="date" radius={5} inputStyle={{ colorScheme: 'dark' }} /></Field>
                <Field label="SSN" htmlFor="ssn"><Input id="ssn" reveal radius={5} placeholder="XXX-XX-XXXX" maxLength={11} inputStyle={{ paddingLeft: 10 }} /></Field>
              </div>
              <Field label="Address" htmlFor="addr"><Input id="addr" icon="map-pin" radius={5} placeholder="123 Main St, Springfield" /></Field>
              <Field label="Trader level" htmlFor="lvl"><NativeSelect id="lvl" radius={5} options={['Beginner', 'Intermediate', 'Advanced']} /></Field>
              <Field label="Available funds" htmlFor="funds">
                <Input id="funds" icon="dollar-sign" type="number" radius={5} placeholder="5000" />
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>This is just a starting point, not a commitment — you can deposit or withdraw later. A minimum of $5,000 is required to open an account.</p>
              </Field>
              <Field label="Password" htmlFor="pw">
                <Input id="pw" icon="lock" reveal radius={5} placeholder="••••••••" value={pw} onChange={(e) => setPw(e.target.value)} />
                <FieldChecklist items={[{ label: 'At least 8 characters', met: pw.length >= 8 }, { label: 'At least 1 number', met: /\d/.test(pw) }, { label: 'At least 1 special character', met: /[^\w\s]/.test(pw) }]} />
              </Field>
              <Field label="Confirm password" htmlFor="pw2"><Input id="pw2" icon="lock" reveal radius={5} placeholder="••••••••" /></Field>
              <Button type="submit" icon="user-plus" radius={5} fullWidth loading={loading} style={{ marginTop: 4, opacity: loading ? 0.7 : 1 }}>{loading ? 'Creating account...' : 'Create account'}</Button>
            </form>
          </CardContent>
          <CardFooter style={{ justifyContent: 'center' }}><FooterLink q="Already have an account?" link="Sign in" onClick={() => go('login')} /></CardFooter>
        </Card>
      </AuthShell>
    );
  }
  Object.assign(window, { Login, Register });
})();
