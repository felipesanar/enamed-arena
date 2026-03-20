param (
    [Parameter(Mandatory=$true)]
    [string]$TargetDir
)

if (-not (Test-Path $TargetDir)) {
    Write-Error "O diretório de destino não existe: $TargetDir"
    exit 1
}

$SourceAgentDir = Join-Path $PSScriptRoot ".agent"
$TargetAgentDir = Join-Path $TargetDir ".agent"

Write-Host "Copiando configurações do Antigravity para $TargetAgentDir..."

if (Test-Path $TargetAgentDir) {
    Write-Warning "O diretório .agent já existe no destino. Sobrescrevendo..."
}

Copy-Item -Path $SourceAgentDir -Destination $TargetAgentDir -Recurse -Force

Write-Host "Configuração concluída com sucesso!" -ForegroundColor Green
