Header control that opens a small panel — account switcher, simulated market clock, profile menu.

```jsx
<HeaderDropdown icon="briefcase-business" label="Growth" ariaLabel="Select account">
  <MenuItem trailing={<Icon name="check" color="var(--primary)" />}>Growth</MenuItem>
  <MenuItem tone="primary" icon="plus">New account</MenuItem>
</HeaderDropdown>
<HeaderDropdown trigger="SC" ariaLabel="Open profile menu">
  <MenuItem icon="settings">Settings</MenuItem>
  <MenuItem icon="log-out" tone="danger">Log out</MenuItem>
</HeaderDropdown>
```
