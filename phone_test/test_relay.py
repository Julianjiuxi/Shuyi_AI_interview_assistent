"""端到端测试：浏览器 -> 本中继(8765) -> 火山。

验证中继能正确转接并回传 session.created（即浏览器点"开始通话"后第一件应发生的事）。
"""
import asyncio
import json

import websockets


async def main():
    url = "ws://127.0.0.1:8765/ws/call"
    print(f"[1] connecting to relay {url}")
    try:
        async with websockets.connect(url, open_timeout=10) as ws:
            print("[1] relay connected OK")
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
                print(f"    <- {msg[:400]}")
                try:
                    obj = json.loads(msg)
                    if "created" in obj.get("type", ""):
                        got_created = True
                    if obj.get("type") == "error":
                        print("[3] RELAY ERROR:", json.dumps(obj, ensure_ascii=False))
                        return 1
                except json.JSONDecodeError:
                    pass
            if got_created:
                print("[3] OK: 中继成功转接火山并收到 session.created")
                return 0
            print("[3] WARN: 中继连上了，但没收到 session.created")
            return 2
    except Exception as e:
        print(f"[3] RELAY CONNECT FAILED: {type(e).__name__}: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
