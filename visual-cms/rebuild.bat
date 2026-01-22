@echo off
cd /d "%~dp0"
docker-compose down
docker-compose build --no-cache
docker-compose up -d
echo Done!
pause
