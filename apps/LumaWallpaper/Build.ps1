$ErrorActionPreference = 'Stop'
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$compiler = Join-Path $framework 'csc.exe'
$references = @('System.dll', 'System.Core.dll', 'System.Xml.dll', 'System.Drawing.dll', 'System.Windows.Forms.dll', 'System.Xaml.dll') | ForEach-Object { '/reference:' + (Join-Path $framework $_) }
$references += @('WindowsBase.dll', 'PresentationCore.dll', 'PresentationFramework.dll') | ForEach-Object { '/reference:' + (Join-Path $framework ('WPF\' + $_)) }
& $compiler /nologo /target:winexe /platform:x64 /optimize+ ('/out:' + (Join-Path $PSScriptRoot 'Luma.exe')) ('/win32manifest:' + (Join-Path $PSScriptRoot 'app.manifest')) @references (Join-Path $PSScriptRoot 'Luma.cs') (Join-Path $PSScriptRoot 'NeonScenes.cs') (Join-Path $PSScriptRoot 'LivingScenes.cs') (Join-Path $PSScriptRoot 'MazeGame.cs')
if ($LASTEXITCODE -ne 0) { throw 'Compilation failed.' }
Write-Output 'Built Luma.exe. Requires Windows x64 and .NET Framework 4.8.'
