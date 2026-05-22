@echo off
chcp 65001 >nul
echo ========================================
echo   Проверка конфигурации ЛитЭра
echo ========================================
echo.

echo [1/5] Проверка Docker...
docker --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Docker установлен
    docker --version
) else (
    echo ❌ Docker не найден! Установите Docker Desktop.
    goto :error
)

echo.
echo [2/5] Проверка Docker Compose...
docker-compose --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Docker Compose установлен
    docker-compose --version
) else (
    echo ❌ Docker Compose не найден!
    goto :error
)

echo.
echo [3/5] Проверка Python...
python --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Python установлен
    python --version
) else (
    echo ⚠️  Python не найден (опционально для запуска фронтенда)
)

echo.
echo [4/5] Проверка структуры проекта...
if exist "backend\docker-compose.yml" (
    echo ✅ backend/docker-compose.yml найден
) else (
    echo ❌ backend/docker-compose.yml не найден!
    goto :error
)

if exist "backend\.env" (
    echo ✅ backend/.env найден
) else (
    echo ❌ backend/.env не найден!
    goto :error
)

if exist "frontend\index.html" (
    echo ✅ frontend/index.html найден
) else (
    echo ❌ frontend/index.html не найден!
    goto :error
)

if exist "frontend\js\api.js" (
    echo ✅ frontend/js/api.js найден
) else (
    echo ❌ frontend/js/api.js не найден!
    goto :error
)

echo.
echo [5/5] Проверка конфигурации API...
findstr /C:"API_BASE_URL = 'http://localhost:8000'" frontend\js\api.js >nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ API URL настроен правильно (http://localhost:8000)
) else (
    echo ⚠️  API URL может быть настроен неправильно
)

echo.
echo ========================================
echo   Результат проверки
echo ========================================
echo ✅ Все проверки пройдены!
echo.
echo Вы можете запустить проект:
echo   1. Запустите start.bat для бэкенда
echo   2. Запустите frontend\start-frontend.bat для фронтенда
echo   3. Откройте http://localhost:5500/log.html
echo ========================================
echo.
pause
exit /b 0

:error
echo.
echo ========================================
echo   ❌ Обнаружены проблемы!
echo ========================================
echo Исправьте ошибки выше и попробуйте снова.
echo.
pause
exit /b 1
