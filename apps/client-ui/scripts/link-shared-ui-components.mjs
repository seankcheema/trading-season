// packages/shared-ui-components ships raw TS source, included directly in
// this app's TypeScript program via tsconfig paths (see tsconfig.json and
// tsconfig.app.json) rather than through its compiled package exports. Its
// files still bare-import @angular/core, @angular/cdk/overlay, clsx, and
// tailwind-merge, which Node/esbuild resolve by walking up from each file's
// real location. That package has no node_modules of its own and sits
// outside this project's directory tree, so without this link those lookups
// fail once there is no hoisted root node_modules above it.
//
// This creates packages/shared-ui-components/node_modules as a link to this
// project's own node_modules, so those imports resolve to the exact same
// installed copies this app uses -- not a second, duplicate install, which
// would risk two live Angular instances in one bundle. Re-run via `npm
// install` (postinstall) whenever this app's node_modules changes.
import { symlinkSync, lstatSync, realpathSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const target = resolve(scriptDir, '..', 'node_modules');
const sharedDir = resolve(scriptDir, '..', '..', '..', 'packages', 'shared-ui-components');
const linkPath = join(sharedDir, 'node_modules');

if (!existsSync(sharedDir)) {
  console.error(`link-shared-ui-components: ${sharedDir} does not exist.`);
  process.exit(1);
}

if (existsSync(linkPath) || lstatSync(linkPath, { throwIfNoEntry: false })) {
  const stat = lstatSync(linkPath);
  const alreadyLinked = stat.isSymbolicLink() && realpathSync(linkPath) === realpathSync(target);
  if (alreadyLinked) {
    process.exit(0);
  }
  rmSync(linkPath, { recursive: true, force: true });
}

// Relative, not absolute: CI mounts this repository into a container at a
// different path than where it was installed (see the Jenkinsfile
// End-to-End Tests stage), and an absolute target would point nowhere once
// remounted. Node resolves a relative target for a Windows junction too.
symlinkSync(relative(sharedDir, target), linkPath, process.platform === 'win32' ? 'junction' : 'dir');
