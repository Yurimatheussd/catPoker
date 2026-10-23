@echo off
setlocal
cd /d "%~dp0"

rem Acha a proxima versao livre, comecando pela v5
set N=5
:procura
if exist "catPoker-discloud_v%N%.zip" (
    set /a N+=1
    goto procura
)

set ZIP=catPoker-discloud_v%N%.zip
echo Gerando %ZIP%...

powershell -NoProfile -Command "Compress-Archive -Path 'public','server.js','package.json','package-lock.json','discloud.config','README.md' -DestinationPath '%ZIP%'"
if errorlevel 1 (
    echo Falha ao gerar o zip.
    pause
    exit /b 1
)

echo Pronto: %ZIP%
pause
