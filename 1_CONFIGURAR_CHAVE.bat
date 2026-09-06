@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".env" copy ".env.example" ".env" >nul
echo.
echo ==========================================================
echo CONFIGURAR A CHAVE DA OPENAI
echo ==========================================================
echo.
echo O Bloco de Notas vai abrir.
echo Apague "cole_sua_chave_aqui" e cole SUA chave depois de:
echo OPENAI_API_KEY=
echo.
echo NAO envie essa chave para ninguem.
echo Depois salve com CTRL+S e feche o Bloco de Notas.
echo.
pause
notepad ".env"
