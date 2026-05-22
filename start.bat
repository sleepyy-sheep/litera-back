@echo off
chcp 65001 >nul
echo ========================================
echo   ЛитЭра - Книжный трекер
echo ========================================
echo.

echo [1/3] Запуск бэкенда (Docker)...
cd backend
docker-compose up -d

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Ошибка запуска Docker контейнеров!
    echo Убедитесь, что Docker Desktop запущен.
    pause
    exit /b 1
)

echo.
echo ✅ Бэкенд запущен!
echo.
echo [2/3] Ожидание готовности сервисов...
timeout /t 5 /nobreak >nul

echo.
echo [3/3] Проверка здоровья API...
curl -s http://localhost:8000/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ API готов к работе!
) else (
    echo ⚠️  API еще запускается, подождите несколько секунд...
)

echo.
echo ========================================
echo   Сервисы запущены:
echo ========================================
echo   📚 API:           http://localhost:8000
echo   📖 API Docs:      http://localhost:8000/docs
echo   🏥 Health Check:  http://localhost:8000/health
echo   💾 MinIO Console: http://localhost:9001
echo      (логин: minioadmin, пароль: minioadmin123)
echo ========================================
echo.
echo Для запуска фронтенда:
echo   1. Откройте VS Code в папке frontend
echo   2. Установите расширение "Live Server"
echo   3. Правой кнопкой на log.html → Open with Live Server
echo.
echo Или используйте Python:
echo   cd frontend
echo   python -m http.server 5500
echo.
echo Для остановки: stop.bat
echo ========================================
echo.

cd ..
pause
