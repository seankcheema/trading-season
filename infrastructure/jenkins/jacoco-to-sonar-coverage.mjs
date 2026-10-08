#!/usr/bin/env node
/**
 * Converts each Java service's JaCoCo XML report into SonarQube's generic
 * coverage format, written next to it as sonar-coverage.xml:
 *
 *   node infrastructure/jenkins/jacoco-to-sonar-coverage.mjs \
 *     apps/holdings-and-trade-service apps/order-and-sell-service
 *
 * JaCoCo identifies a file only by package and name, and both services use
 * the same packages (app/auth/AuthService.java exists in each). SonarQube's
 * JaCoCo importer resolves such a name to whichever file it finds first, so
 * one service's coverage lands on the other. The generic format takes a full
 * path, which this script builds from the service directory.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';

const services = process.argv.slice(2);
if (services.length === 0) {
  console.error('Usage: jacoco-to-sonar-coverage.mjs <service-dir>...');
  process.exit(1);
}

const attribute = (tag, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

for (const service of services) {
  const serviceDir = service.replaceAll('\\', '/').replace(/\/+$/, '');
  const reportDir = posix.join(serviceDir, 'target/site/jacoco');
  const report = readFileSync(posix.join(reportDir, 'jacoco.xml'), 'utf8');

  const files = [];
  // An element with no children is self-closing (an interface has no lines),
  // so each pattern accepts that form instead of reading on into the next one.
  for (const [, packageTag, packageBody = ''] of report.matchAll(
    /<package\b([^>]*?)(?:\/>|>(.*?)<\/package>)/gs,
  )) {
    const packagePath = attribute(packageTag, 'name');
    for (const [, fileTag, fileBody = ''] of packageBody.matchAll(
      /<sourcefile\b([^>]*?)(?:\/>|>(.*?)<\/sourcefile>)/gs,
    )) {
      const path = posix.join(serviceDir, 'src/main/java', packagePath, attribute(fileTag, 'name'));
      // Generated sources have no file in the tree for SonarQube to match.
      if (!existsSync(path)) continue;
      if (!fileBody.includes('<line')) continue;

      const lines = [];
      for (const [lineTag] of fileBody.matchAll(/<line\b[^>]*\/>/g)) {
        const number = attribute(lineTag, 'nr');
        const covered = Number(attribute(lineTag, 'ci')) > 0;
        const coveredBranches = Number(attribute(lineTag, 'cb'));
        const branches = Number(attribute(lineTag, 'mb')) + coveredBranches;
        const branchAttributes =
          branches > 0 ? ` branchesToCover="${branches}" coveredBranches="${coveredBranches}"` : '';
        lines.push(
          `    <lineToCover lineNumber="${number}" covered="${covered}"${branchAttributes}/>`,
        );
      }
      files.push(`  <file path="${path}">\n${lines.join('\n')}\n  </file>`);
    }
  }

  if (files.length === 0) {
    console.error(`No source files matched the JaCoCo report in ${reportDir}.`);
    process.exit(1);
  }
  const output = posix.join(reportDir, 'sonar-coverage.xml');
  writeFileSync(output, `<coverage version="1">\n${files.join('\n')}\n</coverage>\n`);
  console.log(`${output}: ${files.length} files`);
}
