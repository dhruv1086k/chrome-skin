@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul && (py -3 install.py %* & goto :end)
where python >nul 2>nul && (python install.py %* & goto :end)
echo Python 3 was not found. Install it from https://www.python.org/downloads/ (tick "Add python.exe to PATH") and run this again.
:end
pause
