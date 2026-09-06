"""诊断脚本：确认火山 Seeduplex 的 output_audio.delta 每个分片的真实形态。

目标：搞清楚每个 delta 的 base64 解码后是「完整 OGG 文件（含 OpusHead）」还是
「流式切片（只有第一片含头，后续是 continuation page）」。这决定了前端该怎么拼接。

用法：
  $env:VOLC_DUPLEX_API_KEY = "你的火山 X-Api-Key"
  python test_audio_inspect.py
"""
import asyncio
import base64
import json
import os
import struct
import uuid

import websockets

API_KEY = os.getenv("VOLC_DUPLEX_API_KEY", "")
URL = "wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue"
MODEL = "1.2.6.1"
VOICE = os.getenv("VOLC_DUPLEX_VOICE", "zh_male_yunzhou_jupiter_bigtts")

# 生成 16k / mono / PCM16 的 2 秒正弦波（足够触发端到端模型识别到"有人说话"）
def make_pcm_sine(seconds: float = 2.0, rate: int = 16000, freq: float = 220.0) -> bytes:
    import math
    n = int(rate * seconds)
    out = bytearray()
    for i in range(n):
        v = int(32767 * 0.3 * math.sin(2 * math.pi * freq * i / rate))
        out += struct.pack("<h", v)
    return bytes(out)


def session_create(sid: str) -> dict:
    return {
        "type": "session.create",
        "session": {
            "id": sid,
            "model": MODEL,
            "instructions": "你是口述历史访谈员，请简短地问候并邀请对方开始回忆。",
            "audio": {
                "input": {"format": {"type": "pcm", "rate": 16000}},
                "output": {"format": {"type": "ogg_opus", "rate": 24000}},
            },
            "voice": VOICE,
        },
    }


def describe_ogg(b: bytes) -> str:
    head = b[:4]
    magic = "OggS" if head == b"OggS" else repr(head)
    has_opushead = b"OpusHead" in b[:200]
    has_opustags = b"OpusTags" in b[:200]
    return f"len={len(b)} magic={magic} OpusHead={has_opushead} OpusTags={has_opustags}"


async def main():
    if not API_KEY:
        print("[FAIL] 未设置 VOLC_DUPLEX_API_KEY")
        return 1

    sid = str(uuid.uuid4())
    print("[1] connecting...")
    async with websockets.connect(URL, additional_headers={"X-Api-Key": API_KEY}, open_timeout=15) as ws:
        print("[1] connected")
        await ws.send(json.dumps(session_create(sid), ensure_ascii=False))
        print("[2] session.create sent")

        # 等 session.created
        created = False
        for _ in range(50):
            msg = await asyncio.wait_for(ws.recv(), timeout=10)
            if isinstance(msg, bytes):
                print("    <- binary", len(msg))
                continue
            obj = json.loads(msg)
            print(f"    <- {msg[:200]}")
            if obj.get("type") == "session.created":
                created = True
                break
            if obj.get("type") == "error":
                print("ERROR:", json.dumps(obj, ensure_ascii=False))
                return 1

        if not created:
            print("[3] 未收到 session.created")
            return 2

        # 发送一段 PCM 音频触发模型回复
        pcm = make_pcm_sine()
        b64 = base64.b64encode(pcm).decode()
        print(f"[4] 发送 {len(pcm)} 字节 PCM (base64 {len(b64)} chars) 触发回复...")
        # 每 20ms = 640 字节 一包
        chunk = 640
        for i in range(0, len(pcm), chunk):
            part = pcm[i:i + chunk]
            evt = {"type": "input_audio_buffer.append", "audio": base64.b64encode(part).decode()}
            await ws.send(json.dumps(evt, ensure_ascii=False))
        await ws.send(json.dumps({"type": "input_audio_buffer.commit"}, ensure_ascii=False))
        print("[4] input_audio_buffer.commit 已发送")

        # 收集 15 秒内的下行事件，重点分析 output_audio.delta
        print("[5] 开始收集下行事件 (15s)...")
        chunks = []
        deadline = asyncio.get_event_loop().time() + 15
        while asyncio.get_event_loop().time() < deadline:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=deadline - asyncio.get_event_loop().time())
            except asyncio.TimeoutError:
                break
            if isinstance(msg, bytes):
                print("    <- binary", len(msg))
                continue
            obj = json.loads(msg)
            t = obj.get("type", "")
            if t == "response.output_audio.delta":
                d = obj.get("delta") or obj.get("audio") or ""
                raw = base64.b64decode(d)
                chunks.append(raw)
                print(f"    <- output_audio.delta [{describe_ogg(raw)}]")
            elif t in ("response.output_audio.done", "response.output_text.done", "response.done", "error"):
                print(f"    <- {t}")
                if t == "response.done":
                    break
            else:
                # 其它事件打印前 160 字
                print(f"    <- {t}: {msg[:160]}")

        print(f"\n[6] 共收到 {len(chunks)} 个 output_audio.delta 分片")
        for i, c in enumerate(chunks):
            print(f"    chunk[{i}] {describe_ogg(c)}")

        if chunks:
            merged = b"".join(chunks)
            out = f"audio_inspect_{sid[:8]}.ogg"
            with open(out, "wb") as f:
                f.write(merged)
            print(f"[7] 已合并写出 {out} (共 {len(merged)} 字节)，可用播放器/ffprobe 检查是否完整可播")
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
