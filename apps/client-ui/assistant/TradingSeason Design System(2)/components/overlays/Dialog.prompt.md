Modal for short tasks: deposit/withdraw, rename account, settings, new order.

```jsx
<Dialog title="Deposit funds" closeLabel="Close deposit" onClose={close}>
  <Field label="Amount" description="Available cash: $12,400.00"><Input type="number" placeholder="0.00" radius={5} /></Field>
  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
    <Button variant="outline" radius={5} onClick={close}>Cancel</Button><Button radius={5}>Deposit</Button>
  </div>
</Dialog>
```

Titles are Title Case nouns ("New Order", "Settings") or sentence-case verb phrases ("Deposit funds").
