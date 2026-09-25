Framed content block with a centered header and muted footer — the login/register form shell.

```jsx
<Card radius={10} style={{ maxWidth: 384 }}>
  <CardHeader align="center"><CardTitle style={{ fontSize: 20 }}>Welcome back</CardTitle><CardDescription>Sign in to your Trading Season account</CardDescription></CardHeader>
  <CardContent>…form…</CardContent>
  <CardFooter style={{ justifyContent: 'center' }}>…</CardFooter>
</Card>
```

For dashboard panels use `DashCard` instead (1px border, 14px radius, 20px padding).
