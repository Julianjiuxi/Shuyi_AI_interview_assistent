"""火山引擎端到端实时语音（全双工 3.0）联通测试。

只验证：
1. 能否用 X-Api-Key 建立 WebSocket；
2. 发送 session.create 后能否收到 session.created；
3. 收到的错误信息。

不发送真实音频，不消耗实际通话时长。
"""
import asyncio
import json
import os
import uuid

import websockets

API_KEY = os.getenv("VOLC_DUPLEX_API_KEY", "")
URL = "wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue"
MODEL = "1.2.6.1"
VOICE = "zh_male_yunzhou_jupiter_bigtts"


def session_create():
    return {
        "type": "session.create",
        "session": {
            "id": str(uuid.uuid4()),
            "model": MODEL,
            "instructions": "你是口述历史访谈员，请简短地问候并邀请对方开始回忆。",
            "audio": {
                "input": {"format": {"type": "speech_opus", "rate": 16000}},
                "output": {"format": {"type": "ogg_opus", "rate": 24000}},
            },
            "voice": VOICE,
        },
    }


async def main():
    print(f"[1] connecting to {URL}")
    try:
        async with websockets.connect(
            URL,
            additional_headers={"X-Api-Key": API_KEY},
            open_timeout=15,
        ) as ws:
            print("[1] connected OK")
            await ws.send(json.dumps(session_create(), ensure_ascii=False))
            print("[2] session.create sent, waiting for reply (10s)...")
            deadline = asyncio.get_event_loop().time() + 10
            got_created = False
            while asyncio.get_event_loop().time() < deadline:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=deadline - asyncio.get_event_loop().time())
                except asyncio.TimeoutError:
                    break
                if isinstance(msg, bytes):
                    print(f"    <- binary {len(msg)} bytes")
                    continue
                print(f"    <- {msg[:500]}")
                try:
                    obj = json.loads(msg)
                    t = obj.get("type", "")
                    if "created" in t or "session" in t:
                        got_created = True
                    if "error" in t:
                        print("[3] ERROR EVENT: ", json.dumps(obj, ensure_ascii=False))
                        return 1
                except json.JSONDecodeError:
                    pass
            if got_created:
                print("[3] OK: session.created received -> API 联通成功")
                return 0
            print("[3] WARN: 连接成功但未收到 session.created（可能需检查 model/voice 参数）")
            return 2
    except Exception as e:
        print(f"[3] CONNECT FAILED: {type(e).__name__}: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
