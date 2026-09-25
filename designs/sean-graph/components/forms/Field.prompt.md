Label + control + helper/error stack for every form input.

```jsx
<Field label="Email" htmlFor="email" error={bad && 'Enter a valid email address.'}>
  <Input id="email" icon="mail" radius={5} placeholder="you@example.com" />
</Field>
<Field label="Password" htmlFor="pw">
  <Input id="pw" icon="lock" reveal radius={5} />
  <FieldChecklist items={[{ label: 'At least 8 characters', met: true }, { label: 'At least 1 number', met: false }]} />
</Field>
```

Errors are full sentences ending with a period, telling the user what to enter.
