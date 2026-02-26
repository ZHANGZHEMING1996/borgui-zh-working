@echo off
REM Minimal fake borg stub for development on Windows
set ARG1=%1
if "%ARG1%"=="--version" (
  echo borg 1.0.0
  exit /b 0
)
if "%ARG1%"=="--help" (
  echo Usage: borg [options] COMMAND
  exit /b 0
)
REM For other commands, print a simple success response
echo {"stub":true}
exit /b 0
