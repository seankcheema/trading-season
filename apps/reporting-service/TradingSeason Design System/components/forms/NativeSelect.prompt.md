Browser-native dropdown styled like Input; preferred over `Select` for simple forms (the product uses it for every form dropdown).

```jsx
<NativeSelect id="traderLevel" radius={5} options={['Beginner', 'Intermediate', 'Advanced']} value={lvl} onChange={setLvl} />
<NativeSelect options={[{ value: '15', label: '15 minutes (default)' }, { value: '30', label: '30 minutes' }]} />
```
