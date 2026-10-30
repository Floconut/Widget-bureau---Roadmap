# Installe les dépendances et crée les raccourcis Bureau + menu Démarrer du widget Roadmap.
# Usage : clic droit > Exécuter avec PowerShell (ou : powershell -ExecutionPolicy Bypass -File installer.ps1)
$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot
$exe = Join-Path $dir 'node_modules\electron\dist\electron.exe'

if (-not (Test-Path $exe)) {
  Write-Host 'Installation d''Electron...'
  Push-Location $dir
  npm install
  node node_modules\electron\install.js
  Pop-Location
}

$shell = New-Object -ComObject WScript.Shell
$targets = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Roadmap.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Programs')) 'Roadmap.lnk')
)
foreach ($lnk in $targets) {
  $s = $shell.CreateShortcut($lnk)
  $s.TargetPath = $exe
  $s.Arguments = "`"$dir`""
  $s.WorkingDirectory = $dir
  $s.IconLocation = (Join-Path $dir 'assets\icon.ico') + ',0'
  $s.Description = 'Roadmap Widget'
  $s.Save()
  Write-Host "Raccourci créé : $lnk"
}
Write-Host 'Terminé ! Double-clique sur « Roadmap » sur ton Bureau.'
