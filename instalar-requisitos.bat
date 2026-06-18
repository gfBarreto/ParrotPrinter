@echo off
title ParrotPrinter - Instalador de Prerrequisitos
echo ==========================================================
echo             PARROT PRINTER - INSTALADOR DE REQUISITOS
echo ==========================================================
echo.
echo Este script ira verificar e guiar voce na instalacao do:
echo 1. NodeJS (necessario para rodar o servidor no computador)
echo 2. Git (necessario para atualizar automaticamente com o seu GitHub)
echo.

:: 1. Verifica Node.js
echo [1/3] Verificando se o NodeJS esta instalado...
node --version >nul 2>&1
if %errorlevel% equ 0 goto node_installed

echo.
echo [AVISO] NodeJS nao encontrado!
echo Tentando instalar o NodeJS automaticamente via Windows Package Manager (winget)...
winget --version >nul 2>&1
if %errorlevel% neq 0 goto node_manual_download

echo Comando winget detectado! Instalando NodeJS LTS...
winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
if %errorlevel% equ 0 (
    echo.
    echo [SUCESSO] NodeJS instalado! Por favor, feche e abra novamente este script para aplicar as novas variaveis de ambiente.
    pause
    exit /b
)

:node_manual_download
echo.
echo Nao foi possivel instalar automaticamente.
echo Por favor, faca o download manual e instale atraves do link:
echo --^> https://nodejs.org/
echo.
set /p "dummy=[Pressione ENTER para abrir a pagina do NodeJS no seu navegador...]"
start https://nodejs.org/
pause
exit /b

:node_installed
echo NodeJS ja esta instalado. Versao:
node --version
echo.

:: 2. Verifica Git
echo [2/3] Verificando se o Git esta instalado...
git --version >nul 2>&1
if %errorlevel% equ 0 goto git_installed

echo.
echo [AVISO] Git nao encontrado!
echo Tentando instalar o Git automaticamente via Windows Package Manager (winget)...
winget --version >nul 2>&1
if %errorlevel% neq 0 goto git_manual_download

echo Comando winget detectado! Instalando Git...
winget install Git.Git --silent --accept-package-agreements --accept-source-agreements
if %errorlevel% equ 0 (
    echo.
    echo [SUCESSO] Git instalado! Por favor, feche e abra novamente este script para aplicar as novas variaveis de ambiente.
    pause
    exit /b
)

:git_manual_download
echo.
echo Nao foi possivel instalar automaticamente.
echo Por favor, faca o download manual e instale atraves do link:
echo --^> https://git-scm.com/download/win
echo.
set /p "dummy=[Pressione ENTER para abrir a pagina do Git no seu navegador...]"
start https://git-scm.com/download/win
pause
exit /b

:git_installed
echo Git ja esta instalado. Versao:
git --version
echo.

:: 3. Instalar dependencias
echo [3/3] Instalando dependencias do projeto (npm install)...
echo.
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao rodar npm install. Verifique sua conexao de rede ou permissoes da pasta.
) else (
    echo.
    echo Dependencias locais instaladas com sucesso!
)
echo.
echo ==========================================================
echo SUCESSO! Todos os prerrequisitos do ParrotPrinter estao OK!
echo.
echo Como clonar seu projeto do GitHub para o computador local:
echo 1. Abra o Terminal do Windows (Prompt de Comando) na pasta de destino:
echo    ^> git clone https://github.com/SEU-USUARIO/nome-do-seu-repositorio.git
echo 2. Entre na pasta clonada.
echo 3. Com isso, os scripts "atualizar.bat" e o botao de Atualizacao do navegador
echo    funcionarao perfeitamente, sincronizando direto com o seu GitHub!
echo ==========================================================
echo.
pause
