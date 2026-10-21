Single-line text entry; pair with `Field` for label + helper/error text.

```jsx
<Input icon="mail" type="email" placeholder="you@example.com" radius={5} />
<Input icon="lock" reveal placeholder="••••••••" radius={5} />
<Input icon="dollar-sign" type="number" placeholder="5000" invalid />
```

Focus = cyan border + 3px cyan/50 ring. Invalid = red border/ring. Placeholders are concrete examples ("Jane", "123 Main St, Springfield", "XXX-XX-XXXX").
