# Shared UI components

Reusable Angular components built with SpartanNG and Tailwind CSS. This is local source inside client-ui, not a separate installed package: it's compiled directly into client-ui's TypeScript program through the `@shared/ui-components/*` and `@spartan-ng/helm/*` path mappings in [tsconfig.json](../tsconfig.json). It has no `package.json` or dependencies of its own; it's built with whatever client-ui has installed.

Consumers import from an exported subpath, for example:

```ts
import { HlmCardImports } from '@shared/ui-components/card';
```

Implementations live under [src/lib](src/lib/). Preserve accessible semantics and component variants when extending them. Verify changes with the [client UI](../README.md) build and relevant tests; there is no standalone test command for this directory on its own.
