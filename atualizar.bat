@echo off
title Klipper Audio Hub - Atualizador Automático Windows
echo ==========================================================
echo           KLIPPER AUDIO HUB - ATUALIZADOR AUTOMÁTICO
echo ==========================================================
echo.
echo Este script irá baixar a versão mais recente diretamente do seu
echo repositório do GitHub, atualizar dependências e recompilar o aplicativo.
echo.

:: Verifica se o Git está instalado
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ALERTA] Git não foi encontrado no seu Windows!
    echo Para que a atualização automática funcione, você precisa instalar o Git:
    echo ----^> https://git-scm.com/download/win
    echo.
    echo Alternativa Manual: Faca o download do ZIP novo no seu GitHub,
    echo extraia no mesmo local substituindo os arquivos e use o 'rodar-no-windows.bat'.
    echo.
    pause
    exit /b
)

:: Verifica se é um repositório git ativo
if not exist .git (
    echo [ERR] Esta pasta não parece ser um clone do Git (falta a pasta .git).
    echo Certifique-se de que fez um 'git clone' do seu repositório do GitHub
    echo ao invés de apenas baixar um arquivo .zip bruto.
    echo.
    pause
    exit /b
)

echo [1/3] Baixando novidades do GitHub (git pull)...
echo.
call git pull origin main
if %errorlevel% neq 0 (
    echo.
    echo [ALERTA] Tem alterações locais não salvas ou falha na conexão.
    echo Tentando forçar o pull para garantir sincronia...
    call git pull
)

echo.
echo [2/3] Atualizando pacotes de dependência (npm install)...
echo.
call npm install

echo.
echo [3/3] Recompilando o código de produção do dashboard...
echo.
call npm run build

echo.
echo ==========================================================
echo SUCESSO! O aplicativo foi atualizado para a última versão!
echo Dê dois cliques em 'rodar-no-windows.bat' para iniciar de novo.
echo ==========================================================
echo.
pause
