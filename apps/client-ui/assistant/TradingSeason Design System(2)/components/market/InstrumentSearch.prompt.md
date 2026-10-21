Search box that finds instruments by symbol or name and opens a trade.

```jsx
<InstrumentSearch instruments={INSTRUMENTS} onSelect={(i) => openOrder(i)} />

// Dashboard entry point: clear purpose, shortcut, suggestions, Trade button
<InstrumentSearch size="lg" placeholder="Search a stock to buy or sell" shortcut action={{ label: 'Trade' }}
  suggestions={[{ label: 'Trending', icon: 'flame', items: trending }, { label: 'Your watch list', icon: 'star', items: watched }, { label: 'Recently viewed', icon: 'history', items: recent }]}
  instruments={INSTRUMENTS} onSelect={(i) => openOrder(i.symbol)} />
```

Empty result copy: `No instruments match "xyz"`. Empty suggestion groups are hidden.
