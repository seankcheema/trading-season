// Node 22+ ships its own Web Storage globals. Vitest leaves them in place because they
// already exist on the Node global, and unless Node was started with --localstorage-file
// they are unusable: Node 26 (the Jenkins agent) resolves them to undefined, and Node 22/24
// with --experimental-webstorage throw on access. Either way every spec that touches
// localStorage fails. Vitest also aliases `window` to the same global, so the jsdom storage
// has to come from a separate jsdom window with a non-opaque origin.
// @ts-ignore jsdom is a transitive dependency of @angular/build and may ship without types
import { JSDOM } from 'jsdom';

const storageNames = ['localStorage', 'sessionStorage'] as const;

function nodeStorageIsUsable(name: (typeof storageNames)[number]): boolean {
  try {
    return Boolean(globalThis[name]);
  } catch {
    return false;
  }
}

const missing = storageNames.filter((name) => !nodeStorageIsUsable(name));
if (missing.length > 0) {
  const storageWindow = new JSDOM('', { url: 'http://localhost' }).window;
  for (const name of missing) {
    Object.defineProperty(globalThis, name, {
      value: storageWindow[name],
      configurable: true,
      writable: true,
    });
  }
}
