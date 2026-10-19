Signed change badge next to a price, or a tiny side tag in transaction rows.

```jsx
<ChangePill value={5.2} />                           // +5.20% green
<ChangePill tone="gain">+$15.65 (+5.20%)</ChangePill>
<ChangePill tag tone="primary">buy</ChangePill>
<ChangePill tag tone="loss">sell</ChangePill>
```

Buy is cyan (primary), not green; green is reserved for price gains and deposits.
