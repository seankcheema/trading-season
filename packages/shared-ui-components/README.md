# Shared UI components

Reusable Angular components built with SpartanNG and Tailwind CSS. The package exports TypeScript source through @shared/ui-components subpaths; the [package manifest](package.json) defines the public surface.

Install from repository root with npm ci. Consumers import from an exported subpath, for example:

```ts
import { HlmCardImports } from '@shared/ui-components/card';
```

Implementations live under [src/lib](src/lib/). Preserve accessible semantics and component variants when extending them. Verify changes with the consuming [business UI](../../apps/business-logic-ui/README.md) build and relevant tests; consult actual package scripts before assuming a standalone library test command exists.
