$ErrorActionPreference='Continue'
Set-Location 'c:\Users\Haitham\Desktop\e-liquid-sales-management-system'
$env:Path='C:\Users\Haitham\Downloads\node-v22.22.2-win-x64;' + $env:Path
$log="$env:TEMP\m3.txt"
Remove-Item $log -ErrorAction SilentlyContinue
"=== TSC ===" | Out-File $log -Encoding utf8
& '.\node_modules\.bin\tsc.cmd' --noEmit 2>&1 | Out-File -Append $log -Encoding utf8
"TSC_EXIT=$LASTEXITCODE" | Out-File -Append $log -Encoding utf8
"=== LINT ===" | Out-File -Append $log -Encoding utf8
& '.\node_modules\.bin\eslint.cmd' src --quiet 2>&1 | Out-File -Append $log -Encoding utf8
"LINT_EXIT=$LASTEXITCODE" | Out-File -Append $log -Encoding utf8
"=== BUILD ===" | Out-File -Append $log -Encoding utf8
& '.\node_modules\.bin\next.cmd' build 2>&1 | Out-File -Append $log -Encoding utf8
"BUILD_EXIT=$LASTEXITCODE" | Out-File -Append $log -Encoding utf8
'M3_DONE' | Out-File -Append $log -Encoding utf8
