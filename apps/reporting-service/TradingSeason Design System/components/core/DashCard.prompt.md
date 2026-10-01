Bordered near-black panel for every dashboard region; use `variant="net-worth"` once per screen for the hero balance.

```jsx
<DashCard>
  <div style={{ display: 'flex', justifyContent: 'space-between' }}><h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Assets</h2><DashLink>View all</DashLink></div>
</DashCard>
<DashCard variant="net-worth"><DashLabel>Net Worth</DashLabel>…</DashCard>
```
