@echo off
chcp 65001 >nul
echo ========================================
echo   Запуск фронтенда ЛитЭра
echo ========================================
echo.

echo Проверка доступности бэкенда...
curl -s http://localhost:8000/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Бэкенд не запущен!
    echo Сначала запустите start.bat из корневой папки проекта.
    echo.
    pause
    exit /b 1
)

echo ✅ Бэкенд доступен!
echo.
echo Запуск HTTP сервера на порту 5500...
echo.
echo ========================================
echo   Фронтенд доступен:
echo ========================================
echo   🌐 Вход/Регистрация: http://localhost:5500/log.html
echo   📚 Главная страница:  http://localhost:5500/index.html
echo   📖 Полки:            http://localhost:5500/shelves.html
echo ========================================
echo.
echo Для остановки нажмите Ctrl+C
echo.

python -m http.server 5500
