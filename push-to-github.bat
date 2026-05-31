@echo off
echo ===================================================
echo  Pushing Sabara Project to GitHub
echo ===================================================
echo.

:: Check if git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in your PATH.
    echo Please install Git from https://git-scm.com/ and try again.
    pause
    exit /b
)

:: Initialize git repository if not already done
if not exist .git (
    echo Initializing Git repository...
    git init
) else (
    echo Git repository already initialized.
)

:: Ensure origin is set to correct remote URL
echo Setting remote origin to https://github.com/SUMAN721467/Sabara.git...
git remote remove origin >nul 2>nul
git remote add origin https://github.com/SUMAN721467/Sabara.git

:: Stage files
echo Staging files...
git add .

:: Commit files
echo Committing files...
git commit -m "Initial commit"

:: Set branch name to main
echo Setting branch to main...
git branch -M main

:: Push to remote
echo.
echo Pushing to GitHub (Authentication prompt may appear)...
git push -u origin main

echo.
if %errorlevel% equ 0 (
    echo ===================================================
    echo  SUCCESS: Project successfully pushed to GitHub!
    echo ===================================================
) else (
    echo ===================================================
    echo  FAILED: Something went wrong while pushing.
    echo  Please check the error output above.
    echo ===================================================
)
echo.
pause
