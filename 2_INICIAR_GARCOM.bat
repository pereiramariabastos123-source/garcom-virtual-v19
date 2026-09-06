@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Garcom Virtual V19

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ==========================================================
  echo NODE.JS NAO ENCONTRADO
  echo ==========================================================
  echo.
  echo Instale o Node.js LTS em:
  echo https://nodejs.org/
  echo.
  echo Depois feche esta janela e execute este arquivo novamente.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo.
  echo Primeiro execute: 1_CONFIGURAR_CHAVE.bat
  echo.
  pause
  exit /b 1
)

findstr /C:"OPENAI_API_KEY=cole_sua_chave_aqui" ".env" >nul
if not errorlevel 1 (
  echo.
  echo A chave ainda nao foi colocada no arquivo .env.
  echo Execute primeiro: 1_CONFIGURAR_CHAVE.bat
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo Preparando o Garcom Virtual pela primeira vez...
  echo Isso pode levar alguns instantes.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo Nao foi possivel instalar as dependencias.
    echo Verifique sua internet e tente novamente.
    pause
    exit /b 1
  )
)

echo.
echo Iniciando...
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
call npm start
pause
