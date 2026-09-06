@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Garcom Virtual V19
set "NODEDIR=%~dp0node-v24.20.0-win-x64"
set "PATH=%NODEDIR%;%PATH%"
if not exist "%NODEDIR%\node.exe" (echo Node portatil nao encontrado.&pause&exit /b 1)
if not exist ".env" (echo Arquivo .env nao encontrado.&pause&exit /b 1)
if not exist "node_modules\express" (
 call "%NODEDIR%\npm.cmd" install
 if errorlevel 1 (echo Falha ao instalar componentes.&pause&exit /b 1)
)
echo Garcom Virtual V19: http://127.0.0.1:3000
"%NODEDIR%\node.exe" server-local.js
pause
