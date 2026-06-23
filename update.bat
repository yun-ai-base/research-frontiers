@echo off
chcp 65001 >nul
title 科学突破前沿 — 自动更新工具

echo ============================================
echo   科学突破前沿 — 一键自动更新
echo ============================================
echo.
echo 该脚本将：
echo  1. 从 arXiv 拉取各学科最新论文
echo  2. AI 生成核心突破解读和发散拓展
echo  3. 合并到 data.json
echo  4. 自动提交并推送到 GitHub
echo.
echo 提示：请确保代理已打开（如有需要）
echo.

:: 检查代理
set HTTPS_PROXY=socks5h://127.0.0.1:1080

:: 检查 Python
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 未找到 Python，请先安装 Python 3
    pause
    exit /b
)

:: 切换到脚本目录
cd /d "%~dp0"

echo 📡 正在抓取各学科最新论文...
echo.

:: 逐个学科抓取
for %%f in (物理 天文 生物 计算机) do (
    echo [%%f] 抓取中...
    python scripts/fetch_papers.py --field "%%f" --max-results 2 --output /tmp/%%f.json
)

echo.
echo 🤖 AI 生成点评中...
echo.

:: 检查 API 密钥
if "%DEEPSEEK_API_KEY%"=="" (
    echo ⚠️ 未设置 DEEPSEEK_API_KEY 环境变量
    echo   尝试从 .env 文件读取...
)

:: 遍历抓取结果，逐个生成
for %%f in (物理 天文 生物 计算机) do (
    if exist /tmp/%%f.json (
        python -c "import json; d=json.load(open('/tmp/%%f.json')); [print(i) for i in range(len(d.get('papers',[])))]" > /tmp/%%f_count.txt
        for /f %%i in ('type /tmp/%%f_count.txt') do (
            echo [%%f #%%i] 生成中...
            python scripts/generate_review.py --input "/tmp/%%f.json" --index %%i --output "/tmp/entry_%%f_%%i.json"
            python scripts/merge_entry.py --input "/tmp/entry_%%f_%%i.json"
        )
    )
)

echo.
echo 📤 提交到 GitHub...
echo.

git add data.json
git diff --cached --quiet
if %ERRORLEVEL% NEQ 0 (
    git commit -m "feat: 自动更新 %date%"
    git push
    echo ✅ 已更新并推送到 GitHub！
) else (
    echo ℹ️ 没有新的条目需要提交
)

echo.
echo ============================================
echo   更新完成！
echo   网站将在几分钟后更新
echo   https://yun-ai-base.github.io/research-frontiers/
echo ============================================
pause
