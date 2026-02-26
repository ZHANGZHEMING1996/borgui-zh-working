@echo off
REM Minimal fake borg wrapper for Windows development
if "%1"=="--version" (
  echo borg 1.0.0
  exit /b 0
)
REM For other commands, just print a placeholder and return success
echo fake borg received: %*
exit /b 0
