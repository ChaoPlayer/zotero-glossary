# Build the Zotero Glossary addon into an installable .xpi (a zip with
# manifest.json at the root). Run from the project directory:
#   powershell -ExecutionPolicy Bypass -File .\build.ps1
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$xpi  = Join-Path $root "zotero-glossary.xpi"
$tmp  = Join-Path $env:TEMP ("zotero-glossary-build-" + [guid]::NewGuid().ToString("N"))

if (Test-Path $xpi) { Remove-Item $xpi -Force }

New-Item -ItemType Directory -Path $tmp | Out-Null
try {
    # Copy everything except scripts, VCS dirs, test probes and built XPI files.
    $excludeNames = @("build.ps1", ".git", ".gitignore", "test-min", "test-min-bss")
    Get-ChildItem $root -Force | Where-Object {
        $_.Name -notin $excludeNames -and $_.Extension -ne ".xpi"
    } | ForEach-Object {
        Copy-Item $_.FullName -Destination $tmp -Recurse -Force
    }

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    # Build the zip entry-by-entry with FORWARD slashes in entry names.
    # ZipFile.CreateFromDirectory emits backslashes on Windows, which the
    # WebExtension loader cannot resolve (manifest.json references use "/").
    $zipFs = [System.IO.Compression.ZipFile]::Open($xpi, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        Get-ChildItem $tmp -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($tmp.Length).TrimStart('\', '/')
            $rel = $rel.Replace('\', '/')
            $entry = $zipFs.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
            $in = $_.OpenRead()
            try {
                $out = $entry.Open()
                try { $in.CopyTo($out) } finally { $out.Dispose() }
            } finally { $in.Dispose() }
        }
    } finally {
        $zipFs.Dispose()
    }

    Write-Host "OK: $xpi" -ForegroundColor Green
    Write-Host "Install in Zotero 7: Tools -> Add-ons -> gear -> Install Add-on From File..."
} finally {
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
}
