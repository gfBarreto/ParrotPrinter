@echo off
title ParrotPrinter - Inicialização Automática com o Windows
cls
echo ==========================================================
echo         PARROT PRINTER - INICIAR COM O WINDOWS
echo ==========================================================
echo.
echo Este script configura o ParrotPrinter para iniciar de forma
echo automatica e invisivel (em segundo plano) sempre que voce
echo ligar o computador e fizer login no Windows.
echo.
echo Escolha uma opcao:
echo [1] ATIVAR inicializacao automatica em segundo plano
echo [2] DESATIVAR inicializacao automatica
echo [3] Sair
echo.
set /p opcao="Digite a opcao desejada (1, 2 ou 3) e pressione Enter: "

if "%opcao%"=="1" goto instalar
if "%opcao%"=="2" goto remover
if "%opcao%"=="3" goto fim
goto opcao_invalida

:instalar
echo.
echo ==========================================================
echo CONFIGURANDO INICIALIZACAO AUTOMATICA...
echo ==========================================================
echo.

:: Caminho do arquivo oculto local
set "VBS_FILE=%~dp0rodar-oculto.vbs"

if not exist "%VBS_FILE%" (
    echo [ERRO] O arquivo "rodar-oculto.vbs" nao foi encontrado na pasta atual!
    echo Certifique-se de que extraiu todos os arquivos do ZIP corretamente.
    echo.
    pause
    exit /b
)

:: Criar atalho na pasta de Inicializar do Windows
echo Criando atalho em segundo plano na pasta Startup do Windows...
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ParrotPrinter.lnk'); $Shortcut.TargetPath = '%VBS_FILE%'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Save()"

if %errorlevel% equ 0 (
    echo.
    echo ==========================================================
    echo SUCESSO! O ParrotPrinter agora iniciara com o Windows!
    echo.
    echo O que acontecera agora?
    echo - Toda vez que ligar o Windows, o monitor de audio iniciara
    echo   silenciosamente em segundo plano.
    echo - Avisos de voz, bips e sons funcionarao localmente de forma autonoma.
    echo.
    echo IMPORTANTE: Se voce mover ou renomear esta pasta "ParrotPrinter",
    echo voce precisara executar este script [Opcao 1] novamente
    echo para atualizar o atalho da inicializacao!
    echo ==========================================================
) else (
    echo [ERRO] Falha ao criar o atalho automatico usando PowerShell.
)
echo.
pause
goto fim

:remover
echo.
echo ==========================================================
echo DESATIVANDO INICIALIZACAO AUTOMATICA...
echo ==========================================================
echo.

set "LINK_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ParrotPrinter.lnk"

if exist "%LINK_PATH%" (
    del /f /q "%LINK_PATH%"
    echo Atalho de inicializacao automatica removido com sucesso!
    echo O ParrotPrinter nao iniciara mais sozinho com o Windows.
) else (
    echo Nenhum registro de inicializacao automatica foi detectado para remocao.
)
echo.
pause
goto fim

:opcao_invalida
echo.
echo Opcao invalida. Reiniciando menu...
timeout /t 2 >nul
goto :EOF

:fim
exit /b
