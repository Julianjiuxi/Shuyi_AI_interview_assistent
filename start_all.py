#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
ShuYi 一键启动：同时拉起后端(FastAPI/uvicorn:8000) 与 前端(standalone:3000)。

SQLite 数据库随后端自动加载，无需单独进程，因此这一步就完成了
「前后端 + 数据库」的整体启动。按 Ctrl+C 可同时关闭前后端。

用法:
    python start_all.py            # 干净启动（后端不热重载，推荐联调用）
    python start_all.py --reload   # 后端开发模式（改后端代码自动重载）

说明:
    - 前端是 standalone 构建，没有热更新；改了前端代码需先 `cd frontend && npm run build` 再启动。
    - 首次使用需保证已生成 frontend/dist/standalone/server.js。
"""

import os
import subprocess
import sys
import threading
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT, "frontend")
SERVER_JS = os.path.join(FRONTEND_DIR, "dist", "standalone", "server.js")

# 本机已知可用的 Node 与 Python 环境（据实调整）
NODE_EXE = r"C:\Program Files\nodejs\node.exe"
FALLBACK_PYTHON = r"D:\桌面\python\python.exe"


def pick_python():
    """优先使用能 import fastapi/uvicorn 的解释器。"""
    candidates = []
    for c in (sys.executable, FALLBACK_PYTHON):
        if c and c not in candidates:
            candidates.append(c)
    for c in candidates:
        try:
            r = subprocess.run(
                [c, "-c", "import fastapi, uvicorn"],
                capture_output=True, text=True, timeout=30,
            )
            if r.returncode == 0:
                return c
        except Exception:
            continue
    return None


def stream(proc, name, pipe):
    for line in iter(pipe.readline, ""):
        sys.stdout.write("[%s] %s" % (name, line))
        sys.stdout.flush()


def main():
    reload_backend = "--reload" in sys.argv

    if not os.path.exists(NODE_EXE):
        print("[error] 找不到 Node 可执行文件: %s" % NODE_EXE)
        sys.exit(1)
    if not os.path.exists(SERVER_JS):
        print("[error] 找不到前端构建产物: %s" % SERVER_JS)
        print("        请先执行:  cd frontend  &&  npm run build")
        sys.exit(1)

    python = pick_python()
    if not python:
        print("[error] 找不到包含 fastapi/uvicorn 的 Python 环境。")
        print("        已尝试: %s / %s" % (sys.executable, FALLBACK_PYTHON))
        sys.exit(1)

    env = os.environ.copy()
    env["SITES_LOCAL_AUTH"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"] = "1"
    env["PATH"] = os.path.dirname(NODE_EXE) + os.pathsep + env.get("PATH", "")

    procs = []

    backend_cmd = [python, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"]
    if reload_backend:
        backend_cmd.append("--reload")

    def spawn(cmd, cwd, name):
        p = subprocess.Popen(
            cmd,
            cwd=cwd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        procs.append(p)
        threading.Thread(target=stream, args=(p, name, p.stdout), daemon=True).start()
        print("[%s] 已启动 (pid=%s)" % (name, p.pid))
        return p

    try:
        backend = spawn(backend_cmd, ROOT, "backend")
        print("[backend] 接口: http://127.0.0.1:8000  (python=%s)" % python)

        frontend = spawn([NODE_EXE, SERVER_JS], FRONTEND_DIR, "frontend")
        print("[frontend] 页面: http://localhost:3000")

        print("\n>>> ShuYi 前后端已就绪。浏览器打开 http://localhost:3000")
        print(">>> 按 Ctrl+C 同时关闭前后端。\n")

        while True:
            time.sleep(0.5)
            for p in list(procs):
                code = p.poll()
                if code is not None:
                    name = "backend" if p is backend else "frontend"
                    print("[%s] 进程已退出 (code=%s)" % (name, code))
                    procs.remove(p)
            if not procs:
                print("\n前后端均已退出。")
                break

    except KeyboardInterrupt:
        print("\n正在关闭前后端...")
    finally:
        for p in procs:
            if p.poll() is None:
                try:
                    p.terminate()
                except Exception:
                    pass
        deadline = time.time() + 8
        for p in procs:
            remaining = deadline - time.time()
            if remaining <= 0:
                break
            try:
                p.wait(timeout=remaining)
            except subprocess.TimeoutExpired:
                try:
                    p.kill()
                except Exception:
                    pass
        print("已全部关闭。")


if __name__ == "__main__":
    main()
