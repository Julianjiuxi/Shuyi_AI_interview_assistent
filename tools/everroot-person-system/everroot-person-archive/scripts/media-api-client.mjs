import { writeFile } from 'node:fs/promises';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.base_resp?.status_code > 0) {
    throw new Error(body?.error?.message || body?.base_resp?.status_msg || `HTTP ${response.status}`);
  }
  return body;
}

export async function draftArchiveText({ confirmedFacts, uncertainMemories = [], preservedQuotes = [], forbiddenInventions = [], outputShape }) {
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const result = await jsonRequest(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${required('DEEPSEEK_API_KEY')}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      response_format: { type: 'json_object' },
      temperature: 0.55,
      messages: [
        {
          role: 'system',
          content: 'You are a careful family archivist. Return valid JSON. Use only approved facts for biographical claims. Mark uncertainty explicitly and never reconstruct withheld or private content.',
        },
        {
          role: 'user',
          content: JSON.stringify({ confirmedFacts, uncertainMemories, preservedQuotes, forbiddenInventions, outputShape }),
        },
      ],
    }),
  });
  const content = result?.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek returned no archive text');
  return JSON.parse(content);
}

export async function designMiniMaxVoice({ description, previewText }) {
  const baseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com';
  return jsonRequest(`${baseUrl}/v1/voice_design`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${required('MINIMAX_API_KEY')}` },
    body: JSON.stringify({ prompt: description, preview_text: previewText, aigc_watermark: false }),
  });
}

export async function synthesizeMiniMaxSpeech({ text, voiceId, language = 'Chinese', outputPath, speed = 0.96 }) {
  const baseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com';
  const result = await jsonRequest(`${baseUrl}/v1/t2a_v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${required('MINIMAX_API_KEY')}` },
    body: JSON.stringify({
      model: process.env.MINIMAX_SPEECH_MODEL || 'speech-2.8-hd',
      text,
      stream: false,
      voice_setting: { voice_id: voiceId, speed, vol: 1, pitch: 0, emotion: 'calm' },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
      language_boost: language,
      subtitle_enable: false,
    }),
  });
  if (!result?.data?.audio) throw new Error('MiniMax returned no speech audio');
  if (outputPath) await writeFile(outputPath, Buffer.from(result.data.audio, 'hex'));
  return result;
}

export async function submitMiniMaxVideoShot({ prompt, duration = 10, referenceVideoUrls = [] }) {
  const baseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com';
  return jsonRequest(`${baseUrl}/v2/video_generation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${required('MINIMAX_API_KEY')}` },
    body: JSON.stringify({
      model: process.env.MINIMAX_H3_MODEL || 'MiniMax-H3',
      content: [
        { type: 'text', text: prompt },
        ...referenceVideoUrls.map((url) => ({ type: 'video_url', video_url: { url }, role: 'reference_video' })),
      ],
      resolution: '768P',
      duration,
      ratio: '16:9',
      aigc_watermark: false,
    }),
  });
}

export async function queryMiniMaxVideoShot(taskId) {
  const baseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com';
  return jsonRequest(`${baseUrl}/v2/query/video_generation/${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${required('MINIMAX_API_KEY')}` },
  });
}
