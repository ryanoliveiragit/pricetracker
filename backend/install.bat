@echo off
echo ========================================
echo  Instalando Backend ConstruPrice
echo ========================================
echo.

echo [1/3] Criando ambiente virtual Python...
python -m venv venv
if %errorlevel% neq 0 (
    echo ERRO: Falha ao criar ambiente virtual
    echo Certifique-se de ter Python 3.10+ instalado
    pause
    exit /b 1
)
echo Ambiente virtual criado!
echo.

echo [2/3] Ativando ambiente virtual...
call venv\Scripts\activate.bat
echo.

echo [3/3] Instalando dependencias (pode demorar alguns minutos)...
pip install --upgrade pip
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar dependencias
    pause
    exit /b 1
)
echo.

echo ========================================
echo  Instalacao Concluida!
echo ========================================
echo.
echo Para iniciar o backend, execute:
echo   .\start.bat
echo.
echo Ou manualmente:
echo   .\venv\Scripts\activate
echo   python main.py
echo.
pause
