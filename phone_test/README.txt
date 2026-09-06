ShuYi 电话模式 Demo 最小说明
=============================

1. 目录：D:\桌面\ShuYi\phone_test

   - app.py          FastAPI WebSocket 中继（加 Key 后转接到火山全双工 3.0）
   - index.html      前端通话遮罩 + 波形 + 字幕 + 音频播放
   - requirements.txt

2. 启动（Windows，推荐直接用 ShuYi 主项目的同一个 Python 环境，依赖全有）：

   cd D:\桌面\ShuYi\phone_test
   D:\桌面\python\python.exe -m pip install -r requirements.txt   # 缺依赖才装

   # 先设置火山 API Key（环境变量，不要写进代码/提交进 git）
   $env:VOLC_DUPLEX_API_KEY = "你的火山 X-Api-Key"

   D:\桌面\python\python.exe app.py

3. 浏览器访问：http://127.0.0.1:8765/

4. 点绿色「🎧 开始通话」→ 允许麦克风 → 画面中央会出现波形和通话遮罩。
   - 你开口说话，下方字幕区灰色气泡显示「您：…」的 ASR 识别结果；
   - AI 说完一句，棕色气泡显示「访谈员：…」，同时自动播放 TTS 语音；
   - 结束点右下角红色「📞 挂断」。

5. 约束来源：app.py 里 INTERVIEW_RULES 直接提炼自 ShuYi 主项目
   app/prompts/interview_planner.py 同一套原则（不问卷、不臆造情感、
   顺着讲述者节奏交替 承接 / 邀请继续 / 轻轻深挖）。同时在 session.create
   注入了林美珍 1945·山东临沂 作为当前讲述者信息。

6. 如果连接失败/没声音：
   - 先看页面底部红色错误提示。
   - 后端控制台会有日志。火山接口报错通常是：X-Api-Key 没开通「端到端实时语音」
     服务、或配额没启用、或模型资源不可用。
   - 先确保你在火山控制台的「豆包语音 / 端到端实时语音 全双工 3.0」那一栏
     已经开通了后付费并发配额（0并发=完全不可用）。
