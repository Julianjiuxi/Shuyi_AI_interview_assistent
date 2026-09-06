'use client';

import { useEffect, useRef, useState } from 'react';
import { PhoneOff } from 'lucide-react';

type Bubble = { id: number; role: 'me' | 'ai'; text: string; provisional?: boolean };

export type VoiceCallOverlayProps = {
  open: boolean;
  projectId: number | null;
  subjectName?: string;
  apiBase: string;
  onClose: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const TTS_COOLDOWN_MS = 1200;

/* AudioWorklet：48k -> 16k 重采样 + Int16，每 20ms（320 samples）出一包 PCM16。 */
const WORKLET_CODE = `
class PCM16Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._outRate = 16000;
    this._ratio = sampleRate / this._outRate;
    this._acc = new Float32Array(0);
    this._chunk = new Int16Array(320);
    this._chunkPos = 0;
  }
  _resample(samples) {
    const merged = new Float32Array(this._acc.length + samples.length);
    merged.set(this._acc, 0);
    merged.set(samples, this._acc.length);
    const outLen = Math.floor(merged.length / this._ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const pos = i * this._ratio;
      const i0 = Math.floor(pos);
      const i1 = Math.min(i0 + 1, merged.length - 1);
      const frac = pos - i0;
      out[i] = merged[i0] * (1 - frac) + merged[i1] * frac;
    }
    const consumed = Math.floor(outLen * this._ratio);
    this._acc = merged.slice(consumed);
    return out;
  }
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const resampled = this._resample(input[0]);
      for (let i = 0; i < resampled.length; i++) {
        let v = Math.max(-1, Math.min(1, resampled[i]));
        this._chunk[this._chunkPos++] = v < 0 ? v * 0x8000 : v * 0x7fff;
        if (this._chunkPos === 320) {
          const pcm = this._chunk.slice().buffer;
          this.port.postMessage(pcm, [pcm]);
          this._chunkPos = 0;
          this._chunk = new Int16Array(320);
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm16-processor', PCM16Processor);
`;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function collapseReps(text: string): string {
  return String(text)
    .replace(/([\u4e00-\u9fa5A-Za-z0-9，。！？、,.!?；：;:]{2,16})\1{3,}/g, '$1')
    .replace(/([\u4e00-\u9fa5A-Za-z0-9])\1{5,}/g, '$1$1$1');
}

function containsOpusHead(bytes: Uint8Array): boolean {
  const needle = [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64]; // "OpusHead"
  const limit = Math.min(bytes.length - 8, 256);
  for (let i = 0; i <= limit; i++) {
    let ok = true;
    for (let j = 0; j < 8; j++) {
      if (bytes[i + j] !== needle[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

export function VoiceCallOverlay({ open, projectId, subjectName, apiBase, onClose, t }: VoiceCallOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [timer, setTimer] = useState('00:00');
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const timerIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTsRef = useRef(0);

  const provisionalUserTextRef = useRef('');
  const provisionalAiTextRef = useRef('');
  const ttsActiveRef = useRef(false);
  const ttsCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTtsChunksRef = useRef<Uint8Array[]>([]);
  const audioQueueRef = useRef<Blob[]>([]);
  const playingRef = useRef(false);
  const micHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || !projectId) return;

    let disposed = false;

    // 重置 UI
    setBubbles([]);
    setStatus(t('chat.call.requestMic'));
    setError('');
    setTimer('00:00');

    const fitCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const startTimer = () => {
      startTsRef.current = Date.now();
      setTimer('00:00');
      if (timerIdRef.current) clearInterval(timerIdRef.current);
      timerIdRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startTsRef.current) / 1000);
        const m = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        setTimer(`${m}:${ss}`);
      }, 500);
    };

    const stopTimer = () => {
      if (timerIdRef.current) { clearInterval(timerIdRef.current); timerIdRef.current = null; }
    };

    const drawWave = () => {
      const analyser = analyserRef.current;
      const canvas = canvasRef.current;
      if (!analyser || !canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      const bars = 48;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, w, h);
      const step = Math.floor(data.length / bars);
      const barW = (w / bars) * 0.55;
      const gap = (w / bars) * 0.45;
      for (let i = 0; i < bars; i++) {
        const v = (data[i * step] || 0) / 255;
        const bh = Math.max(4, v * h * 0.9);
        const x = i * (barW + gap) + gap / 2;
        const y = (h - bh) / 2;
        const grad = ctx.createLinearGradient(0, y, 0, y + bh);
        grad.addColorStop(0, '#c8753c');
        grad.addColorStop(1, '#a4522d');
        ctx.fillStyle = grad;
        ctx.beginPath();
        const r = barW / 2;
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + barW, y, x + barW, y + h, r);
        ctx.arcTo(x + barW, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + barW, y, r);
        ctx.closePath();
        ctx.fill();
      }
      rafIdRef.current = requestAnimationFrame(drawWave);
    };

    const updateUserBubble = (text: string) => {
      setBubbles((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'me' && last.provisional) {
          return [...prev.slice(0, -1), { ...last, text }];
        }
        return [...prev, { id: Date.now(), role: 'me', text, provisional: true }];
      });
    };

    const finalizeUserBubble = (raw: string) => {
      const cleaned = collapseReps(raw);
      setBubbles((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'me' && last.provisional) {
          if (!cleaned.trim()) return prev.slice(0, -1);
          return [...prev.slice(0, -1), { ...last, text: cleaned, provisional: false }];
        }
        if (cleaned.trim()) return [...prev, { id: Date.now(), role: 'me', text: cleaned }];
        return prev;
      });
    };

    const updateAiBubble = (delta: string) => {
      setBubbles((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'ai' && last.provisional) {
          return [...prev.slice(0, -1), { ...last, text: last.text + delta }];
        }
        return [...prev, { id: Date.now(), role: 'ai', text: delta, provisional: true }];
      });
    };

    const finalizeAiBubble = () => {
      setBubbles((prev) => prev.map((b) => (b.provisional ? { ...b, provisional: false } : b)));
    };

    const setTtsActive = (v: boolean) => {
      ttsActiveRef.current = v;
      if (ttsCooldownTimerRef.current) { clearTimeout(ttsCooldownTimerRef.current); ttsCooldownTimerRef.current = null; }
      if (!v) {
        ttsCooldownTimerRef.current = setTimeout(() => { ttsActiveRef.current = false; }, TTS_COOLDOWN_MS);
      }
    };

    const pumpAudio = async () => {
      if (playingRef.current) return;
      while (audioQueueRef.current.length) {
        const blob = audioQueueRef.current.shift()!;
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        playingRef.current = true;
        setTtsActive(true);
        await new Promise<void>((res) => {
          audio.onended = () => res();
          audio.onerror = () => { URL.revokeObjectURL(url); res(); };
          audio.play().catch(() => res());
        });
        URL.revokeObjectURL(url);
        playingRef.current = false;
      }
      setTtsActive(false);
    };

    const flushTts = async () => {
      if (!currentTtsChunksRef.current.length) return;
      const chunks = currentTtsChunksRef.current;
      currentTtsChunksRef.current = [];

      let headCount = 0;
      for (const c of chunks) if (containsOpusHead(c)) headCount++;
      const allFull = headCount > 0 && headCount >= chunks.length - 1;

      if (allFull) {
        for (const c of chunks) audioQueueRef.current.push(new Blob([c], { type: 'audio/ogg; codecs=opus' }));
      } else {
        const total = chunks.reduce((s, c) => s + c.length, 0);
        const merged = new Uint8Array(total);
        let pos = 0;
        for (const c of chunks) { merged.set(c, pos); pos += c.length; }
        audioQueueRef.current.push(new Blob([merged], { type: 'audio/ogg; codecs=opus' }));
      }
      await pumpAudio();
    };

    const handleDownEvent = async (obj: any) => {
      const type = obj?.type || '';
      if (type === 'conversation.item.input_audio_transcription.delta') {
        if (ttsActiveRef.current) return;
        const d = obj.delta || obj.text || '';
        if (d) { provisionalUserTextRef.current = d; updateUserBubble(d); }
        return;
      }
      if (type === 'conversation.item.input_audio_transcription.completed') {
        if (ttsActiveRef.current) return;
        const d = obj.delta || obj.text || '';
        if (d) provisionalUserTextRef.current = d;
        if (provisionalUserTextRef.current) finalizeUserBubble(provisionalUserTextRef.current);
        return;
      }
      if (type === 'response.output_text.delta') {
        const d = obj.delta || obj.text || '';
        if (d) { provisionalAiTextRef.current += d; updateAiBubble(d); }
        return;
      }
      if (type === 'response.output_text.done') {
        if (provisionalAiTextRef.current) finalizeAiBubble();
        return;
      }
      if (type === 'response.output_audio.delta') {
        const d = obj.delta || obj.audio || '';
        if (d) currentTtsChunksRef.current.push(base64ToBytes(d));
        return;
      }
      if (type === 'response.output_audio.done') {
        await flushTts();
        return;
      }
      if (type === 'session.created') { setStatus(t('chat.call.ready')); return; }
      if (type === 'error') {
        setError('服务端错误：' + (obj.detail || obj.message || JSON.stringify(obj)));
        setStatus('出错');
        return;
      }
      if (type === 'response.done') {
        await flushTts();
        return;
      }
      const text = obj.delta || obj.text || obj.content;
      if (typeof text === 'string' && text) { provisionalAiTextRef.current += text; updateAiBubble(text); }
    };

    const sendJson = (obj: unknown) => {
      if (wsRef.current && wsRef.current.readyState === 1) {
        wsRef.current.send(JSON.stringify(obj));
      }
    };

    const cleanup = () => {
      try { if (wsRef.current) wsRef.current.close(); } catch { /* ignore */ }
      wsRef.current = null;
      if (workletNodeRef.current) { try { workletNodeRef.current.port.onmessage = null; workletNodeRef.current.disconnect(); } catch { /* ignore */ } }
      workletNodeRef.current = null;
      if (analyserRef.current) { try { analyserRef.current.disconnect(); } catch { /* ignore */ } }
      analyserRef.current = null;
      if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach((tr) => tr.stop()); mediaStreamRef.current = null; }
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch { /* ignore */ } audioCtxRef.current = null; }
      stopTimer();
      if (micHintTimerRef.current) { clearTimeout(micHintTimerRef.current); micHintTimerRef.current = null; }
      if (ttsCooldownTimerRef.current) { clearTimeout(ttsCooldownTimerRef.current); ttsCooldownTimerRef.current = null; }
      audioQueueRef.current = [];
      currentTtsChunksRef.current = [];
      provisionalUserTextRef.current = '';
      provisionalAiTextRef.current = '';
      playingRef.current = false;
    };

    const start = async () => {
      setStatus(t('chat.call.requestMic'));
      setError('');

      // 5 秒后若仍在等待授权，给用户明确提示
      if (micHintTimerRef.current) clearTimeout(micHintTimerRef.current);
      micHintTimerRef.current = setTimeout(() => {
        if (!mediaStreamRef.current && !disposed) {
          setStatus('仍在等麦克风授权…');
          setError('请在浏览器地址栏左侧的小弹窗里点击「允许」使用麦克风，或检查系统输入设备。若已拒绝请点击地址栏锁图标重新授权后刷新页面。');
        }
      }, 5000);

      const HOST_IS_LOCAL = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) || window.location.protocol === 'https:';
      if (!HOST_IS_LOCAL) {
        cleanup();
        setError('当前域名不受信。请用 http://127.0.0.1:8000 或 https 访问（getUserMedia 仅在安全上下文可用）。');
        setStatus('失败');
        return;
      }
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        cleanup();
        setError('当前浏览器不支持 getUserMedia 接口。请用最新版 Chrome / Edge。');
        setStatus('失败');
        return;
      }

      // 1. 麦克风
      let micTimer: ReturnType<typeof setTimeout> | null = null;
      try {
        const micPromise = navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const timeoutPromise = new Promise<MediaStream>((_, rej) => {
          micTimer = setTimeout(() => rej(new Error('麦克风请求超时超过 25s 未获得授权')), 25000);
        });
        mediaStreamRef.current = await Promise.race([micPromise, timeoutPromise]);
        if (micTimer) clearTimeout(micTimer);
        if (micHintTimerRef.current) { clearTimeout(micHintTimerRef.current); micHintTimerRef.current = null; }
        setError('');
      } catch (e: any) {
        if (micTimer) clearTimeout(micTimer);
        if (micHintTimerRef.current) { clearTimeout(micHintTimerRef.current); micHintTimerRef.current = null; }
        const name = (e && e.name) || '';
        const msg = (e && e.message) || String(e);
        let friendly = '无法获取麦克风：' + msg;
        if (/NotAllowed|PermissionDenied/.test(name)) {
          friendly = '麦克风权限被拒绝。请点击浏览器地址栏左侧的"锁"或"麦克风"图标，把本站改成"允许"，然后刷新页面。';
        } else if (/NotFound|DevicesNotFound|Overconstrained/.test(name)) {
          friendly = '系统找不到可用的麦克风输入设备。请先在系统设置里检查麦克风是否插好并已启用。';
        } else if (/NotReadable|TrackStart/.test(name)) {
          friendly = '麦克风被其他应用占用（比如系统录音机、视频会议等），请关掉后再试。';
        }
        setError(friendly);
        setStatus('失败');
        cleanup();
        return;
      }

      // 2. AudioContext + AudioWorklet + Analyser
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AC();
        const audioCtx = audioCtxRef.current;
        const src = audioCtx.createMediaStreamSource(mediaStreamRef.current);

        analyserRef.current = audioCtx.createAnalyser();
        analyserRef.current.fftSize = 512;
        src.connect(analyserRef.current);

        const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(blob);
        setStatus(t('chat.call.initAudio'));
        await audioCtx.audioWorklet.addModule(workletUrl);
        workletNodeRef.current = new AudioWorkletNode(audioCtx, 'pcm16-processor');
        src.connect(workletNodeRef.current);
        workletNodeRef.current.port.onmessage = (e) => {
          const pcm16 = new Uint8Array(e.data as ArrayBuffer);
          const b64 = bytesToBase64(pcm16);
          sendJson({ type: 'input_audio_buffer.append', audio: b64 });
        };
      } catch (e: any) {
        cleanup();
        setError('音频初始化失败：' + ((e && e.message) || String(e)));
        setStatus('失败');
        return;
      }

      // 3. 连接本地中继
      setStatus(t('chat.call.connect'));
      const wsBase = apiBase.replace(/^http/, 'ws').replace(/\/$/, '');
      const wsUrl = `${wsBase}/api/ws/call/${projectId}`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;
      } catch (e: any) {
        cleanup();
        setError('建立 WebSocket 失败：' + ((e && e.message) || String(e)));
        setStatus('失败');
        return;
      }

      ws.addEventListener('open', () => {
        if (disposed) return;
        setStatus(t('chat.call.init'));
        startTimer();
        fitCanvas();
        rafIdRef.current = requestAnimationFrame(drawWave);
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      });

      ws.addEventListener('message', (ev) => {
        if (typeof ev.data !== 'string') return;
        let obj: any;
        try { obj = JSON.parse(ev.data); } catch { return; }
        handleDownEvent(obj).catch((err) => console.error('[handleDownEvent]', err));
      });

      ws.addEventListener('close', () => {
        if (!disposed) setStatus('连接已关闭');
      });

      ws.addEventListener('error', () => {
        if (!disposed) {
          setError('WebSocket 发生错误（后端未启动或网络问题）。');
          setStatus('失败');
        }
      });
    };

    // 挂载后让 canvas 有尺寸
    const fitTimer = setTimeout(fitCanvas, 30);
    start();

    return () => {
      disposed = true;
      clearTimeout(fitTimer);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [bubbles]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#f5ecdd]/[0.92] px-6 py-8 backdrop-blur-md md:py-12">
      <div className="text-center">
        <div className="text-sm tracking-[0.2em] text-[#7a614f]">{t('chat.call.title')}</div>
        {subjectName ? <div className="mt-3 text-xl font-medium text-[#3f2d22]">{subjectName}</div> : null}
        <div className="mt-1.5 tabular-nums text-[#7a614f]">{timer}</div>
        <div className="mt-2 text-xs tracking-wide text-[#a78365]/85">{t('chat.call.headphone')}</div>
      </div>

      <canvas ref={canvasRef} className="block h-[150px] w-full max-w-[560px]" />

      <div ref={transcriptRef} className="flex max-h-[34vh] w-full max-w-[720px] flex-col gap-2.5 overflow-auto px-1">
        {bubbles.map((b) => (
          <div
            key={b.id}
            className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 break-words ${
              b.role === 'me'
                ? 'self-end rounded-br-md bg-[#f2dfc2] text-[#5b3f2a]'
                : 'self-start rounded-bl-md border border-[#e7d6b8] bg-white text-[#3f2d22]'
            } ${b.provisional ? 'opacity-70' : ''}`}
          >
            <b>{b.role === 'me' ? '您：' : '访谈员：'}</b> {b.text || '(…)'}
          </div>
        ))}
      </div>

      <div className="flex w-full flex-col items-center gap-3">
        <div className="min-h-[18px] text-[13px] text-[#7a614f]">{status}</div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-full bg-[#b33a3a] px-7 py-4 text-base text-white shadow-[0_6px_18px_rgba(179,58,58,0.25)] hover:bg-[#9f3030]"
        >
          <PhoneOff size={16} /> {t('chat.call.hangup')}
        </button>
        <div className="min-h-[18px] w-full max-w-[720px] text-center text-[13px] text-[#b33a3a]">{error}</div>
      </div>
    </div>
  );
}
