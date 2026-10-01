Clickable action; cyan primary for the single main action, outline for the alternative, sell for red sell-side submits.

```jsx
<Button icon="log-in" radius={5} fullWidth>Sign in</Button>
<Button variant="outline" radius={5}>Cancel</Button>
<Button size="cta">Get started</Button>
<Button variant="glass" fullWidth>Withdraw</Button>
<Button variant="sell" size="lg" radius={12} fullWidth>Sell 5 AAPL</Button>
```

- Auth forms and dialog footers use `radius={5}`.
- `size="icon"` + `variant="ghost"` + `icon="x"` = dialog close button.
- Text is sentence case, verb-first ("Deposit", "Apply time", "Create account"). Loading label ends in an ellipsis ("Signing in...", "Processing…").
