ShuYi 电话模式 Demo 说明
============================

目录：D:\桌面\ShuYi\phone_test

  app.py            FastAPI WebSocket 中继（注入 X-Api-Key 后转接火山全双工 3.0）
  index.html        前端通话遮罩 + 波形 + 字幕 + 音频播放（AudioWorklet 采 PCM16）
  test_connect.py   连通性测试（只测 session.create -> session.created，不耗音频）
  requirements.txt

协议（以官方文档 2549778 为准，全双工 Seeduplex 3.0）
----------------------------------------------------
  - URL    : wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue
  - 鉴权    : 请求头 X-Api-Key（新版控制台 API Key）
  - model  : 1.2.6.1（固定值）
  - 纯 JSON 文本帧，音频 Base64 编码内嵌于事件的 audio / delta 字段
  - 输入    : PCM16 / 16000Hz / 单声道 / int16 小端序，20ms 一包（640 字节）
  - 输出    : OGG-Opus（Base64 在 response.output_audio.delta 的 delta 字段）

启动
----
  cd D:\桌面\ShuYi\phone_test

  # 设置火山 API Key（环境变量，不要写进代码 / 提交进 git）
  $env:VOLC_DUPLEX_API_KEY = "你的火山 X-Api-Key"

  # 缺依赖才装（主项目环境里 fastapi/uvicorn/websockets 一般已有）
  D:\桌面\python\python.exe -m pip install -r requirements.txt

  D:\桌面\python\python.exe app.py

  浏览器访问 http://127.0.0.1:8765/

测试顺序（不要先测网页电话）
----------------------------
  Test 1 — 连通性（不耗音频，先确认协议和鉴权正确）：
      $env:VOLC_DUPLEX_API_KEY = "你的火山 X-Api-Key"
      D:\桌面\python\python.exe test_connect.py
      期望打印 "session.created received -> 联通成功，协议正确"

  Test 2 — 网页电话：
      打开 http://127.0.0.1:8765/ -> 点「🎧 开始通话」-> 允许麦克风 -> 说话

  点按钮后会立即弹出通话遮罩并显示状态机：
      请求麦克风… -> 连接语音服务… -> 会话初始化中… -> 会话已就绪，请开始说话…

  你在下方看到灰色气泡「您：…」是 ASR 识别结果，
  棕色气泡「访谈员：…」是 AI 回复文本，同时自动播放 AI 语音。

约束来源
--------
  app.py 里 INTERVIEW_RULES 提炼自 ShuYi 主项目 app/prompts/interview_planner.py
  同一套原则（不问卷、不臆造情感、顺着讲述者节奏），并在 session.create 的
  instructions 注入林美珍 1945·山东临沂 作为当前讲述者。

排错
----
  1. 后端控制台会打印所有上行/下行事件（[Volc↑]/[Volc↓]/[Browser↑]），先看那里。
  2. 网页底部红色错误条会显示失败原因。
  3. 常见错误：
     - 未设 VOLC_DUPLEX_API_KEY -> 直接报"后端未配置…"
     - 鉴权失败 -> error 事件里带 4xx 码，去火山控制台核对 API Key
     - 音色不合法 -> error 里出现 InvalidSpeaker，把 DEFAULT_VOICE 换成有效音色
     - 说话没字幕 -> 确认麦克风权限，且后端日志有 [Browser↑] input_audio_buffer.append
