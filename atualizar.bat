@echo off
title Klipper Audio Hub - Atualizador Automático Windows
echo ==========================================================
echo           KLIPPER AUDIO HUB - ATUALIZADOR AUTOMÁTICO
echo ==========================================================
echo.
echo Este script ira baixar a versao mais recente diretamente do seu
echo repositorio do GitHub, atualizar dependencias e recompilar o aplicativo.
echo.

:: Verifica se o Git esta instalado
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ALERTA] Git nao foi encontrado no seu Windows!
    echo Para que a atualizacao automatica funcione, voce precisa instalar o Git:
    echo ----^> https://git-scm.com/download/win
    echo.
    echo Alternativa Manual: Faca o download do ZIP novo no seu GitHub,
    echo extraia no mesmo local substituindo os arquivos e use o rodar-no-windows.bat.
    echo.
    pause
    exit /b
)

:: Verifica se eh um repositorio git ativo
if not exist .git (
    echo [ERR] Esta pasta nao parece ser um clone do Git - falta a pasta .git.
    echo Certifique-se de que fez um 'git clone' do seu repositorio do GitHub
    echo ao inves de apenas baixar um arquivo ZIP bruto.
    echo.
    pause
    exit /b
)

echo [1/3] Preparando pasta e baixando novidades do GitHub (git pull)...
echo.

:: Remove package-lock.json para evitar o erro de arquivos nao rastreados (ele sera recriado pelo npm install)
if exist package-lock.json (
    echo [Info] Removendo arquivo package-lock.json temporario para evitar conflitos...
    del /f /q package-lock.json
)

call git pull origin main
if %errorlevel% neq 0 (
    echo.
    echo [ALERTA] Diferenca ou conflito detectado no Git. 
    echo Tentando resetar arquivos rastreados modificados localmente para garantir a atualizacao...
    call git reset --hard HEAD
    call git pull origin main
)

echo.
echo [2/3] Atualizando pacotes de dependencia (npm install)...
echo.
call npm install

echo.
echo [3/3] Recompilando o codigo de producao do dashboard...
echo.
call npm run build

echo.
echo ==========================================================
echo SUCESSO! O aplicativo foi atualizado para a ultima versao!
echo De dois cliques em 'rodar-no-windows.bat' para iniciar de novo.
echo ==========================================================
echo.
pause
