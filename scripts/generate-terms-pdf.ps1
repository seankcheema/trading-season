param(
    [string]$SourcePath = (Join-Path $PSScriptRoot '..\docs\reference\terms-and-conditions.md'),
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\docs\reference\terms-and-conditions.pdf')
)

$ErrorActionPreference = 'Stop'

$source = (Resolve-Path $SourcePath).Path

$outputDirectory = Split-Path $OutputPath -Parent
if (-not (Test-Path $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$outputPdf = Join-Path (Resolve-Path $outputDirectory).Path (Split-Path $OutputPath -Leaf)
$tempHtml = Join-Path (Split-Path $outputPdf -Parent) '.terms-and-conditions.print.html'
$stagedPdf = Join-Path (Split-Path $outputPdf -Parent) '.terms-and-conditions.generated.pdf'
$browserLog = Join-Path (Split-Path $outputPdf -Parent) '.terms-and-conditions.browser.log'

$browserPath = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $browserPath) {
    throw 'Chrome or Edge is required to generate the PDF, but neither browser was found in the expected install paths.'
}

function Convert-Inline([string]$text) {
    $encoded = [System.Net.WebUtility]::HtmlEncode($text)
    return [regex]::Replace($encoded, '`([^`]+)`', '<code>$1</code>')
}

$lines = Get-Content $source
$htmlParts = New-Object 'System.Collections.Generic.List[string]'
$quoteLines = New-Object 'System.Collections.Generic.List[string]'
$inList = $false

function Flush-Quote {
    if ($script:quoteLines.Count -gt 0) {
        $content = ($script:quoteLines | ForEach-Object { "<p>$(Convert-Inline $_)</p>" }) -join "`n"
        $script:htmlParts.Add("<aside class='callout'>$content</aside>")
        $script:quoteLines.Clear()
    }
}

foreach ($rawLine in $lines) {
    $line = $rawLine.TrimEnd()

    if ([string]::IsNullOrWhiteSpace($line)) {
        if ($inList) {
            $htmlParts.Add('</ul>')
            $inList = $false
        }
        Flush-Quote
        continue
    }

    if ($line.StartsWith('> ')) {
        if ($inList) {
            $htmlParts.Add('</ul>')
            $inList = $false
        }
        $quoteLines.Add($line.Substring(2))
        continue
    }

    Flush-Quote

    if ($line.StartsWith('# ')) {
        if ($inList) {
            $htmlParts.Add('</ul>')
            $inList = $false
        }
        $htmlParts.Add("<h1>$(Convert-Inline $line.Substring(2))</h1>")
        continue
    }

    if ($line.StartsWith('## ')) {
        if ($inList) {
            $htmlParts.Add('</ul>')
            $inList = $false
        }
        $htmlParts.Add("<h2>$(Convert-Inline $line.Substring(3))</h2>")
        continue
    }

    if ($line.StartsWith('- ')) {
        if (-not $inList) {
            $htmlParts.Add('<ul>')
            $inList = $true
        }
        $htmlParts.Add("<li>$(Convert-Inline $line.Substring(2))</li>")
        continue
    }

    if ($inList) {
        $htmlParts.Add('</ul>')
        $inList = $false
    }

    $htmlParts.Add("<p>$(Convert-Inline $line)</p>")
}

if ($inList) {
    $htmlParts.Add('</ul>')
}

Flush-Quote

$body = $htmlParts -join "`n"
$html = @"
<!doctype html>
<html lang='en'>
<head>
  <meta charset='utf-8'>
  <title>TradingSeason Platform Terms and Conditions</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 18mm 22mm 18mm;
    }
    :root {
      --ink: #16202a;
      --muted: #475569;
      --rule: #cbd5e1;
      --panel: #f8fafc;
      --accent: #123a63;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      color: var(--ink);
      line-height: 1.45;
      font-size: 11pt;
      background: white;
    }
    .document {
      border-top: 6px solid var(--accent);
      padding-top: 12mm;
    }
    h1 {
      margin: 0 0 10mm;
      font-size: 22pt;
      line-height: 1.15;
      letter-spacing: 0.01em;
    }
    h2 {
      margin: 9mm 0 3mm;
      font-size: 13pt;
      color: var(--accent);
      border-bottom: 1px solid var(--rule);
      padding-bottom: 2mm;
      page-break-after: avoid;
    }
    p {
      margin: 0 0 4mm;
      text-align: justify;
    }
    ul {
      margin: 0 0 5mm 6mm;
      padding-left: 6mm;
    }
    li {
      margin: 0 0 2mm;
    }
    aside.callout {
      margin: 0 0 8mm;
      padding: 4mm 4.5mm;
      border: 1px solid var(--rule);
      background: var(--panel);
      border-radius: 4px;
    }
    aside.callout p:last-child {
      margin-bottom: 0;
    }
    code {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 0.95em;
      background: #eef2f7;
      padding: 0.15em 0.35em;
      border-radius: 3px;
    }
    .footer {
      margin-top: 10mm;
      padding-top: 4mm;
      border-top: 1px solid var(--rule);
      color: var(--muted);
      font-size: 9pt;
    }
  </style>
</head>
<body>
  <main class='document'>
    $body
    <p class='footer'>Prepared from the canonical TradingSeason reference document.</p>
  </main>
</body>
</html>
"@

Set-Content -Path $tempHtml -Value $html -Encoding UTF8

if (Test-Path $stagedPdf) {
    Remove-Item $stagedPdf -Force
}

$fileUrl = ([System.Uri](Resolve-Path $tempHtml).Path).AbsoluteUri

if (Test-Path $browserLog) {
  Remove-Item $browserLog -Force
}

$browserProcess = Start-Process -FilePath $browserPath `
  -ArgumentList @(
    '--headless=new',
    '--disable-gpu',
    '--allow-file-access-from-files',
    '--no-pdf-header-footer',
    "--print-to-pdf=$stagedPdf",
    $fileUrl
  ) `
  -NoNewWindow `
  -Wait `
  -PassThru `
  -RedirectStandardError $browserLog

$browserOutput = if (Test-Path $browserLog) { Get-Content $browserLog -Raw } else { '' }

if (-not (Test-Path $stagedPdf)) {
    throw "The browser command completed without creating a fresh PDF. Browser output: $browserOutput"
}

Move-Item -Path $stagedPdf -Destination $outputPdf -Force
Remove-Item $tempHtml -ErrorAction SilentlyContinue
Remove-Item $browserLog -ErrorAction SilentlyContinue

Get-Item $outputPdf | Select-Object FullName, Length, LastWriteTime