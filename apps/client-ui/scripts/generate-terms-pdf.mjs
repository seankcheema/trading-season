// Writes the platform terms to a PDF for circulation outside the application.
//
// The wording comes from src/app/dashboard/terms/terms-content.ts, the same source the terms
// dialog renders, so the PDF cannot say anything the application does not. Run it again
// whenever that file changes:
//
//   npm --prefix apps/client-ui run terms:pdf
//
// The output path may be given as an argument; it defaults to docs/terms-and-conditions.pdf at
// the repository root. Printing uses the Chromium that Playwright installs for the e2e suite.
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../src/app/dashboard/terms/terms-content.ts');
const output = resolve(process.argv[2] ?? resolve(here, '../../../docs/terms-and-conditions.pdf'));

const { TERMS_VERSION, TERMS_SECTIONS } = await loadTerms(source);

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(render(TERMS_VERSION, TERMS_SECTIONS), { waitUntil: 'load' });
  await mkdir(dirname(output), { recursive: true });
  await page.pdf({
    path: output,
    format: 'A4',
    margin: { top: '18mm', right: '20mm', bottom: '18mm', left: '20mm' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;padding:0 20mm;font:8pt Arial,sans-serif;color:#666;display:flex;justify-content:space-between"><span>TradingSeason Terms and Conditions, version ${escapeHtml(TERMS_VERSION)}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
  });
} finally {
  await browser.close();
}
console.log(`Wrote version ${TERMS_VERSION} of the terms to ${output}`);

// The file is plain TypeScript with no imports, so compiling it in memory is enough to read it.
async function loadTerms(path) {
  const compiled = ts.transpileModule(await readFile(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}

function render(version, sections) {
  const body = sections
    .map(
      (section) =>
        `<section><h2>${escapeHtml(section.title)}</h2>${section.paragraphs
          .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
          .join('')}</section>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>TradingSeason Platform Terms and Conditions</title>
    <style>
      body { font: 10.5pt/1.45 Georgia, 'Times New Roman', serif; color: #111; margin: 0; }
      h1 { font: 700 20pt/1.2 Arial, Helvetica, sans-serif; margin: 0 0 4pt; }
      h2 { font: 700 12pt/1.3 Arial, Helvetica, sans-serif; margin: 13pt 0 4pt; }
      p { margin: 0 0 7pt; }
      .version { font: 10pt Arial, Helvetica, sans-serif; color: #444; margin: 0 0 14pt; }
      .note { border-top: 1px solid #bbb; margin-top: 14pt; padding-top: 8pt; font-size: 9pt; color: #444; }
      section { break-inside: avoid; }
    </style>
  </head>
  <body>
    <h1>TradingSeason Platform Terms and Conditions</h1>
    <p class="version">Version ${escapeHtml(version)}</p>
    ${body}
    <p class="note">
      These are the terms a user accepts in the TradingSeason dashboard. This document is product
      documentation, not legal advice.
    </p>
  </body>
</html>`;
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
