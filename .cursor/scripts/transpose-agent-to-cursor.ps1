#Requires -Version 5.1
<#
.SYNOPSIS
  Transpõe a estrutura .agent (rules, skills, workflows) para o padrão Cursor (.cursor/rules, .cursor/skills, .cursor/commands).
.PARAMETER AgentPath
  Caminho para a pasta .agent ou para uma pasta que contenha subpastas rules, skills e workflows.
.PARAMETER CursorRoot
  Raiz do projeto onde está .cursor (default: diretório atual).
.EXAMPLE
  .\transpose-agent-to-cursor.ps1 -AgentPath "C:\repos\agent-boilerplate\.agent"
#>
param(
    [Parameter(Mandatory = $true)]
    [string] $AgentPath,

    [Parameter(Mandatory = $false)]
    [string] $CursorRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
$AgentPath = $AgentPath.TrimEnd('\', '/')
if (-not (Test-Path -LiteralPath $AgentPath)) {
    Write-Error "Caminho não encontrado: $AgentPath"
}

# Resolve paths: support both .agent and raw folder with rules/skills/workflows
$rulesSrc   = Join-Path $AgentPath "rules"
$skillsSrc  = Join-Path $AgentPath "skills"
$workflowsSrc = Join-Path $AgentPath "workflows"

$cursorDir  = Join-Path $CursorRoot ".cursor"
$rulesDest  = Join-Path $cursorDir "rules"
$skillsDest = Join-Path $cursorDir "skills"
$commandsDest = Join-Path $cursorDir "commands"

foreach ($d in $rulesDest, $skillsDest, $commandsDest) {
    if (-not (Test-Path -LiteralPath $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
        Write-Host "Criado: $d"
    }
}

function Get-FirstHeading {
    param([string] $content)
    if ($content -match '(?m)^#\s+(.+)$') { return $Matches[1].Trim() }
    return $null
}

function Get-ExistingFrontmatter {
    param([string] $content)
    if ($content -match '(?s)^---\r?\n(.*?)\r?\n---') { return $Matches[1] }
    return $null
}

# ---- Rules: .md -> .mdc com frontmatter ----
if (Test-Path -LiteralPath $rulesSrc) {
    $ruleFiles = Get-ChildItem -Path $rulesSrc -Filter "*.md" -File -ErrorAction SilentlyContinue
    foreach ($f in $ruleFiles) {
        $content = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8
        $firstHeading = Get-FirstHeading $content
        $desc = if ($firstHeading) { $firstHeading } else { $f.BaseName -replace '^\d+-', '' }
        $body = $content
        $existing = Get-ExistingFrontmatter $content
        if ($existing -and $existing -match "description:\s*(.+)") {
            $desc = $Matches[1].Trim().Trim('"').Trim("'")
        }
        if ($existing) {
            $body = $content -replace '(?s)^---\r?\n.*?\r?\n---\r?\n', ''
        }
        $safeName = $f.BaseName -replace '^\d+-', '' -replace '[^a-zA-Z0-9_-]', '-'
        $outPath = Join-Path $rulesDest ($safeName + ".mdc")
        $mdc = @"
---
description: "$($desc -replace '"','\"')"
alwaysApply: false
---

$body
"@
        Set-Content -LiteralPath $outPath -Value $mdc -Encoding UTF8 -NoNewline
        Write-Host "Rule: $($f.Name) -> $outPath"
    }
} else {
    Write-Host "Pasta rules não encontrada: $rulesSrc"
}

# ---- Skills: copiar pasta e garantir SKILL.md com frontmatter ----
if (Test-Path -LiteralPath $skillsSrc) {
    $skillDirs = Get-ChildItem -Path $skillsSrc -Directory -ErrorAction SilentlyContinue
    foreach ($d in $skillDirs) {
        $destSkill = Join-Path $skillsDest $d.Name
        if (-not (Test-Path -LiteralPath $destSkill)) {
            New-Item -ItemType Directory -Path $destSkill -Force | Out-Null
        }
        $mainMd = $null
        Get-ChildItem -Path $d.FullName -Filter "*.md" -File -ErrorAction SilentlyContinue | ForEach-Object {
            if ($_.Name -eq "SKILL.md" -or $_.Name -eq "skill.md") { $mainMd = $_; return }
            if (-not $mainMd) { $mainMd = $_ }
        }
        if ($mainMd) {
            $content = Get-Content -LiteralPath $mainMd.FullName -Raw -Encoding UTF8
            $existing = Get-ExistingFrontmatter $content
            $name = $d.Name
            $desc = Get-FirstHeading $content; if (-not $desc) { $desc = "Skill $name. Use when relevant." }
            if ($existing -match "name:\s*(.+)") { $name = $Matches[1].Trim().Trim('"').Trim("'") }
            if ($existing -match "description:\s*(.+)") { $desc = $Matches[1].Trim().Trim('"').Trim("'") }
            $body = $content
            if ($existing) { $body = $content -replace '(?s)^---\r?\n.*?\r?\n---\r?\n', '' }
            $skillMdc = @"
---
name: $name
description: "$($desc -replace '"','\"')"
---

$body
"@
            Set-Content -LiteralPath (Join-Path $destSkill "SKILL.md") -Value $skillMdc -Encoding UTF8 -NoNewline
            Write-Host "Skill: $($d.Name) -> $destSkill\SKILL.md"
        }
        Get-ChildItem -Path $d.FullName -Recurse -File | ForEach-Object {
            if ($mainMd -and $_.FullName -eq $mainMd.FullName) { return }
            $rel = $_.FullName.Substring($d.FullName.Length).TrimStart('\', '/')
            $target = Join-Path $destSkill $rel
            $targetDir = Split-Path -Parent $target
            if (-not (Test-Path -LiteralPath $targetDir)) {
                New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
            }
            Copy-Item -LiteralPath $_.FullName -Destination $target -Force
            Write-Host "  + $rel"
        }
    }
} else {
    Write-Host "Pasta skills não encontrada: $skillsSrc"
}

# ---- Workflows -> commands ----
if (Test-Path -LiteralPath $workflowsSrc) {
    $workflowFiles = Get-ChildItem -Path $workflowsSrc -Filter "*.md" -File -ErrorAction SilentlyContinue
    foreach ($f in $workflowFiles) {
        $content = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8
        $firstHeading = Get-FirstHeading $content
        $desc = if ($firstHeading) { $firstHeading } else { $f.BaseName }
        $body = $content
        $existing = Get-ExistingFrontmatter $content
        if ($existing -and $existing -match "description:\s*(.+)") {
            $desc = $Matches[1].Trim().Trim('"').Trim("'")
        }
        if ($existing) {
            $body = $content -replace '(?s)^---\r?\n.*?\r?\n---\r?\n', ''
        }
        $safeName = $f.BaseName -replace '[^a-zA-Z0-9_-]', '-'
        $outPath = Join-Path $commandsDest ($safeName + ".md")
        $cmd = @"
---
description: "$($desc -replace '"','\"')"
---

$body
"@
        Set-Content -LiteralPath $outPath -Value $cmd -Encoding UTF8 -NoNewline
        Write-Host "Workflow: $($f.Name) -> $outPath"
    }
} else {
    Write-Host "Pasta workflows não encontrada: $workflowsSrc"
}

Write-Host "Transposição concluída. Revise .cursor/rules, .cursor/skills e .cursor/commands."
