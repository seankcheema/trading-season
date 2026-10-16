#!/usr/bin/env node
/**
 * Converts each Java service's JaCoCo XML report into SonarQube's generic
 * coverage format, written next to it as sonar-coverage.xml:
 *
 *   node infrastructure/jenkins/jacoco-to-sonar-coverage.mjs \
 *     apps/holdings-and-trade-service apps/order-and-sell-service
 *
 * JaCoCo identifies a file only by package and name, and both services use
 * the same packages (app/auth/SecurityConfig.java exists in each). SonarQube's
 * JaCoCo importer resolves such a name to whichever file it finds first, so
 * one service's coverage lands on the other. The generic format takes a full
 * path, which this script builds from the service directory.
 *
 * Classes in packages/trading-java-common are compiled and tested inside every
 * service, so each report holds them. They are one file in the tree, so the
 * script merges what the reports say (a line or branch covered by any service
 * counts as covered) and writes each shared file once, into the first
 * service's output.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';

const SHARED_SOURCE_ROOT = 'packages/trading-java-common/src/main/java';

const services = process.argv.slice(2);
if (services.length === 0) {
  console.error('Usage: jacoco-to-sonar-coverage.mjs <service-dir>...');
  process.exit(1);
}

const attribute = (tag, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

/** Per line: covered, and the best branch counts seen in any report. */
const mergeLine = (lines, number, covered, branches, coveredBranches) => {
  const seen = lines.get(number);
  if (!seen) {
    lines.set(number, { covered, branches, coveredBranches });
    return;
  }
  seen.covered ||= covered;
  seen.branches = Math.max(seen.branches, branches);
  seen.coveredBranches = Math.max(seen.coveredBranches, coveredBranches);
};

const renderFile = (path, lines) => {
  const rows = [...lines.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, { covered, branches, coveredBranches }]) => {
      const branchAttributes =
        branches > 0 ? ` branchesToCover="${branches}" coveredBranches="${coveredBranches}"` : '';
      return `    <lineToCover lineNumber="${number}" covered="${covered}"${branchAttributes}/>`;
    });
  return `  <file path="${path}">\n${rows.join('\n')}\n  </file>`;
};

const shared = new Map();
const outputs = [];

for (const service of services) {
  const serviceDir = service.replaceAll('\\', '/').replace(/\/+$/, '');
  const reportDir = posix.join(serviceDir, 'target/site/jacoco');
  const report = readFileSync(posix.join(reportDir, 'jacoco.xml'), 'utf8');

  const own = new Map();
  // An element with no children is self-closing (an interface has no lines),
  // so each pattern accepts that form instead of reading on into the next one.
  for (const [, packageTag, packageBody = ''] of report.matchAll(
    /<package\b([^>]*?)(?:\/>|>(.*?)<\/package>)/gs,
  )) {
    const packagePath = attribute(packageTag, 'name');
    for (const [, fileTag, fileBody = ''] of packageBody.matchAll(
      /<sourcefile\b([^>]*?)(?:\/>|>(.*?)<\/sourcefile>)/gs,
    )) {
      const name = attribute(fileTag, 'name');
      const ownPath = posix.join(serviceDir, 'src/main/java', packagePath, name);
      const sharedPath = posix.join(SHARED_SOURCE_ROOT, packagePath, name);
      let path;
      let target;
      if (existsSync(ownPath)) {
        path = ownPath;
        target = own;
      } else if (existsSync(sharedPath)) {
        path = sharedPath;
        target = shared;
      } else {
        // Generated sources have no file in the tree for SonarQube to match.
        continue;
      }
      if (!fileBody.includes('<line')) continue;

      const lines = target.get(path) ?? new Map();
      target.set(path, lines);
      for (const [lineTag] of fileBody.matchAll(/<line\b[^>]*\/>/g)) {
        const coveredBranches = Number(attribute(lineTag, 'cb'));
        mergeLine(
          lines,
          Number(attribute(lineTag, 'nr')),
          Number(attribute(lineTag, 'ci')) > 0,
          Number(attribute(lineTag, 'mb')) + coveredBranches,
          coveredBranches,
        );
      }
    }
  }

  if (own.size === 0 && shared.size === 0) {
    console.error(`No source files matched the JaCoCo report in ${reportDir}.`);
    process.exit(1);
  }
  outputs.push({ reportDir, own });
}

outputs.forEach(({ reportDir, own }, index) => {
  const entries = [...own].map(([path, lines]) => renderFile(path, lines));
  if (index === 0) {
    entries.push(...[...shared].map(([path, lines]) => renderFile(path, lines)));
  }
  const output = posix.join(reportDir, 'sonar-coverage.xml');
  writeFileSync(output, `<coverage version="1">\n${entries.join('\n')}\n</coverage>\n`);
  console.log(`${output}: ${entries.length} files`);
});
