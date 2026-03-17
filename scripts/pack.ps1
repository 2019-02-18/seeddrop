# SeedDrop 打包脚本 — 排除开发/敏感文件后生成 zip

$projectRoot = Split-Path $PSScriptRoot -Parent
$pkgJson = Get-Content (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$version = $pkgJson.version
$outputName = "seeddrop-v$version.zip"
$outputPath = Join-Path $projectRoot $outputName

$excludeDirs = @('node_modules', '.cursor', '.git', 'docs', 'dist')
$excludeFiles = @('accounts.json', 'interaction-log.jsonl', 'performance-stats.json', 'package-lock.json', '.DS_Store', 'Thumbs.db')
$excludeGlobs = @('feedback-history-*.json', '*.zip')

Write-Host "[pack] Project: $projectRoot"
Write-Host "[pack] Version: $version"
Write-Host "[pack] Output:  $outputName"
Write-Host ""

$tempDir = Join-Path $env:TEMP "seeddrop-pack-$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    $items = Get-ChildItem -Path $projectRoot -Recurse -Force -ErrorAction SilentlyContinue | Where-Object {
        $rel = $_.FullName.Substring($projectRoot.Length + 1)
        $skip = $false

        foreach ($d in $excludeDirs) {
            if ($rel -like "$d\*" -or $rel -eq $d) { $skip = $true; break }
        }
        if (-not $skip) {
            foreach ($f in $excludeFiles) {
                if ($_.Name -eq $f) { $skip = $true; break }
            }
        }
        if (-not $skip) {
            foreach ($g in $excludeGlobs) {
                if ($_.Name -like $g) { $skip = $true; break }
            }
        }

        -not $skip
    }

    $fileCount = 0
    foreach ($item in $items) {
        $rel = $item.FullName.Substring($projectRoot.Length + 1)
        $destPath = Join-Path $tempDir $rel

        if ($item.PSIsContainer) {
            New-Item -ItemType Directory -Path $destPath -Force | Out-Null
        } else {
            $parentDir = Split-Path $destPath -Parent
            if (-not (Test-Path $parentDir)) {
                New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
            }
            Copy-Item $item.FullName $destPath -Force
            $fileCount++
        }
    }

    if (Test-Path $outputPath) { Remove-Item $outputPath -Force }

    # Use tar (built-in on Windows 10+) instead of Compress-Archive
    Push-Location $tempDir
    tar -a -cf $outputPath *
    Pop-Location

    $sizeKB = [math]::Round((Get-Item $outputPath).Length / 1024)
    Write-Host ""
    Write-Host "[pack] Done!"
    Write-Host "[pack] Files included: $fileCount"
    Write-Host "[pack] Output: $outputPath"
    Write-Host "[pack] Size: ${sizeKB} KB"
    Write-Host ""
    Write-Host "[pack] Excluded:"
    Write-Host "  Dirs:  $($excludeDirs -join ', ')"
    Write-Host "  Files: $($excludeFiles -join ', ')"
    Write-Host "  Globs: $($excludeGlobs -join ', ')"

} finally {
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
