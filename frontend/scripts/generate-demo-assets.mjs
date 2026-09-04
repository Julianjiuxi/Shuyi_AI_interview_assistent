import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const envText = await readFile(resolve(root, '.env.local'), 'utf8');
const env = Object.fromEntries(
  envText.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => {
    const split = line.indexOf('=');
    return [line.slice(0, split), line.slice(split + 1)];
  }),
);

const outputDir = resolve(root, 'public/generated');
const trialDir = resolve(outputDir, 'trials');
const metadataDir = resolve(root, 'work/generated');
await mkdir(outputDir, { recursive: true });
await mkdir(trialDir, { recursive: true });
await mkdir(metadataDir, { recursive: true });

function required(name) {
  if (!env[name]) throw new Error(`${name} is missing from .env.local`);
  return env[name];
}

async function apiJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.base_resp?.status_code > 0) {
    const message = body?.error?.message || body?.base_resp?.status_msg || `HTTP ${response.status}`;
    throw new Error(`${new URL(url).hostname}: ${message}`);
  }
  return body;
}

async function generateCopy() {
  console.log('DeepSeek: generating reviewed archive copy…');
  const source = {
    confirmedFacts: [
      'Lin Meizhen / 林美珍 was born in Suzhou in 1954.',
      'In 1973, aged nineteen, she left Suzhou for factory work in Shanghai. The exact month is not remembered.',
      'She later worked as a textile quality inspector. No dates for job changes or retirement are known.',
      'Her mother placed a green tea tin in her cloth bag. It contained two osmanthus cakes, sewing needles and a folded note.',
      'The note said: “A home is not the place you leave behind. It is the care you continue to carry.”',
      'She married Zhao Guowei. The year and circumstances of their meeting and marriage are unknown.',
      'Their daughter Zhao Lan was born in Shanghai in 1981.',
      'In 1984, the family travelled by crowded train from Shanghai to Suzhou. Lan slept on Meizhen’s shoulder while Guowei stood beside them for six hours because there was only one seat.',
      'Meizhen stored her first factory badge, a photograph of Guowei, Lan’s hospital bracelet and the 1984 train ticket in the tin.',
      'Zhao Guowei died in 2018.',
      'Zhao Lan now works in Shenzhen. Leo studies in Singapore. No move dates are known.',
      'In 2026 Meizhen was living alone in Shanghai and began speaking with a companion AI several evenings each week because the evenings felt lonely.',
      'During a rainy-day conversation, a comment about Guowei bringing laundry in from the balcony led naturally to the green tea tin and the 1984 train memory.',
      'The AI listened and responded during the conversation while recording only approved memories.',
      'Meizhen reviewed the resulting draft, corrected two dates and removed one private passage. The contents of that passage must never be inferred.',
    ],
    preservedQuotes: ['Love is often simply the person who chooses to remain standing.'],
    forbiddenInventions: ['No meeting on a train', 'No Hangzhou journey', 'No marriage year', 'No unlisted birth year', 'No invented factory or retirement dates', 'No invented wording for the removed private passage'],
  };

  const schema = {
    profileSummary: '2 factual paragraphs, detailed and restrained',
    timeline: [{ year: 'string', place: 'string', title: 'string', detail: '2-3 factual sentences', certainty: 'confirmed|uncertain' }],
    storyTitle: 'string', storyDeck: 'string', storyParagraphs: ['6-8 literary English paragraphs'],
    letterTitle: 'string', letterTo: 'Leo', letterParagraphs: ['4-5 intimate English paragraphs'],
    imagePrompts: [{ scene: 1, prompt: 'cinematic 16:9 prompt' }],
    videoPlan: [{ seconds: 10, movement: 'natural motion instruction' }],
  };

  const result = await apiJson(`${env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${required('DEEPSEEK_API_KEY')}` },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: 'You are a careful family archivist and literary editor. Write polished English. Every biographical claim must be directly supported by confirmedFacts. Do not fill narrative gaps with plausible events, dates, places, dialogue or relationships. Mark uncertainty explicitly. Literary quality must come from rhythm, selection and reflection—not fabricated facts. Return only valid JSON matching the requested shape.' },
        { role: 'user', content: `Create a complete family archive package from this approved memory source. The core product is companionship: the memories emerged naturally while an isolated older adult talked with a responsive AI, not during a formal interview.\n\nSOURCE:\n${JSON.stringify(source, null, 2)}\n\nOUTPUT SHAPE:\n${JSON.stringify(schema, null, 2)}\n\nHard constraints: timeline entries may use only the explicitly supplied years 1954, 1973, 1981, 1984, 2018 and 2026. Do not add a year for marriage, work changes, retirement, moves or AI adoption. Do not describe how Meizhen and Guowei met. The 1984 train travelled from Shanghai to Suzhou. Lan was born in 1981. Do not transform Meizhen’s 1973 solo journey into a meeting story. Atmospheric description may be restrained but cannot introduce a new event. For imagePrompts, create exactly two visually consistent scenes with the same fictional 72-year-old Chinese woman, muted teal cardigan, warm New Chinese editorial realism, no text or watermark. For videoPlan, create exactly two 10-second image-to-video movements corresponding to the two images. Avoid melodrama, stereotypes and commercial advertising language.` },
      ],
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      temperature: 0.65,
      max_tokens: 3200,
    }),
  });

  const content = result?.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek returned no content');
  const parsed = JSON.parse(content);
  await writeFile(resolve(metadataDir, 'meizhen-archive-copy.json'), `${JSON.stringify(parsed, null, 2)}\n`);
  console.log(`DeepSeek: success (${result.model || env.DEEPSEEK_MODEL})`);
  return parsed;
}

async function generateImage(copy, sceneIndex = 0) {
  const sceneNumber = sceneIndex + 1;
  console.log(`MiniMax: generating memory scene ${sceneNumber}…`);
  const fallback = sceneIndex === 0
    ? 'A realistic cinematic memory scene of a 72-year-old Chinese woman in a muted teal cardigan sitting beside an apartment window on a rainy afternoon, a small green tea tin on the wooden table.'
    : 'Close-up of the same older woman’s hands opening the green tea tin on a wooden table, revealing a factory badge, one old photograph, a hospital bracelet and a train ticket, with a cup of tea nearby.';
  const basePrompt = copy?.imagePrompts?.[sceneIndex]?.prompt || fallback;
  const mood = sceneIndex === 0
    ? 'Her expression is peaceful, attentive and quietly comforted, with the beginning of a natural smile; she is remembering affection, not grieving.'
    : 'Focus on the hands and four clearly separated keepsakes; keep the person’s face outside the frame so the sequence remains visually consistent.';
  const prompt = `${basePrompt} Bright, softly luminous afternoon exposure with warm ivory light filling the room. ${mood} Refined restrained New Chinese editorial photography, welcoming domestic atmosphere, warm skin tones, tea brown and muted jade palette, subtle film grain, visually natural and emotionally balanced. Avoid gloomy darkness, horror lighting, blue-green color cast, despair, crying, exaggerated ageing, theatrical posing, text, logos and watermark.`;
  const configuredHost = env.MINIMAX_BASE_URL || 'https://api.minimax.cn';
  const hosts = [...new Set([configuredHost, 'https://api.minimax.cn'])];
  let result;
  let lastError;
  for (const host of hosts) {
    try {
      result = await apiJson(`${host}/v1/image_generation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${required('MINIMAX_API_KEY')}` },
        body: JSON.stringify({ model: env.MINIMAX_IMAGE_MODEL || 'image-01', prompt, aspect_ratio: '16:9', response_format: 'url', n: 1, prompt_optimizer: true, aigc_watermark: false }),
      });
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!result) throw lastError;
  const imageUrl = result?.data?.image_urls?.[0];
  if (!imageUrl) throw new Error('MiniMax returned no image URL');
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error(`Could not download generated image: HTTP ${imageResponse.status}`);
  const suffix = String(sceneNumber).padStart(2, '0');
  await writeFile(resolve(outputDir, `osmanthus-memory-scene-${suffix}-v2.png`), Buffer.from(await imageResponse.arrayBuffer()));
  await writeFile(resolve(metadataDir, `minimax-image-source-${suffix}-v2.json`), `${JSON.stringify({ taskId: result.id, imageUrl, prompt }, null, 2)}\n`);
  console.log(`MiniMax: success (${env.MINIMAX_IMAGE_MODEL || 'image-01'})`);
}

async function generateVideo(copy, sceneIndex = 0) {
  const sceneNumber = sceneIndex + 1;
  const suffix = String(sceneNumber).padStart(2, '0');
  const sourcePath = resolve(metadataDir, `minimax-image-source-${suffix}-v2.json`);
  const legacySourcePath = resolve(metadataDir, 'minimax-image-source-v2.json');
  const source = JSON.parse(await readFile(sourcePath, 'utf8').catch(() => readFile(legacySourcePath, 'utf8')));
  const host = env.MINIMAX_BASE_URL || 'https://api.minimaxi.com';
  const movement = copy?.videoPlan?.[sceneIndex]?.movement || 'A slow, natural camera push-in. The woman breathes and gently touches the tin. Rain moves on the window. No sudden motion or facial distortion.';
  console.log(`MiniMax: submitting 10-second video scene ${sceneNumber}…`);
  const task = await apiJson(`${host}/v1/video_generation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${required('MINIMAX_API_KEY')}` },
    body: JSON.stringify({
      model: env.MINIMAX_VIDEO_MODEL || 'MiniMax-Hailuo-2.3-Fast',
      prompt: `${movement} Preserve the original woman, room, clothing, hands and green tea tin. Natural micro-movements only. No morphing, no camera shake, no extra fingers, no text, no subtitles, no watermark.`,
      first_frame_image: source.imageUrl,
      duration: 10,
      resolution: '768P',
    }),
  });
  const taskId = task?.task_id;
  if (!taskId) throw new Error('MiniMax returned no video task ID');
  await writeFile(resolve(metadataDir, `minimax-video-task-${suffix}.json`), `${JSON.stringify({ taskId, status: 'submitted' }, null, 2)}\n`);

  const started = Date.now();
  let status;
  while (Date.now() - started < 15 * 60 * 1000) {
    await new Promise((done) => setTimeout(done, 10_000));
    status = await apiJson(`${host}/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${required('MINIMAX_API_KEY')}` },
    });
    console.log(`MiniMax video ${sceneNumber}: ${status.status}`);
    if (status.status === 'Success') break;
    if (status.status === 'Fail') throw new Error(`MiniMax video failed: ${status.error_message || 'unknown error'}`);
  }
  if (status?.status !== 'Success' || !status.file_id) throw new Error('MiniMax video timed out before completion');
  const file = await apiJson(`${host}/v1/files/retrieve?file_id=${encodeURIComponent(status.file_id)}`, {
    headers: { Authorization: `Bearer ${required('MINIMAX_API_KEY')}` },
  });
  const downloadUrl = file?.file?.download_url;
  if (!downloadUrl) throw new Error('MiniMax returned no video download URL');
  const videoResponse = await fetch(downloadUrl);
  if (!videoResponse.ok) throw new Error(`Could not download generated video: HTTP ${videoResponse.status}`);
  await writeFile(resolve(outputDir, `osmanthus-memory-video-${suffix}.mp4`), Buffer.from(await videoResponse.arrayBuffer()));
  await writeFile(resolve(metadataDir, `minimax-video-task-${suffix}.json`), `${JSON.stringify({ taskId, fileId: status.file_id, status: 'success', movement }, null, 2)}\n`);
  console.log(`MiniMax: video scene ${sceneNumber} downloaded`);
}

async function generateSpeech({ text, voiceId, languageBoost, outputName, speed = 0.92 }) {
  const host = env.MINIMAX_BASE_URL || 'https://api.minimaxi.com';
  console.log(`MiniMax: generating ${outputName}…`);
  const result = await apiJson(`${host}/v1/t2a_v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${required('MINIMAX_API_KEY')}` },
    body: JSON.stringify({
      model: env.MINIMAX_SPEECH_MODEL || 'speech-2.8-hd',
      text,
      stream: false,
      voice_setting: {
        voice_id: voiceId,
        speed,
        vol: 1,
        pitch: 0,
        emotion: 'calm',
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      },
      language_boost: languageBoost,
      subtitle_enable: false,
    }),
  });
  const audioHex = result?.data?.audio;
  if (!audioHex) throw new Error(`MiniMax returned no audio for ${outputName}`);
  await writeFile(resolve(outputDir, outputName), Buffer.from(audioHex, 'hex'));
  return {
    outputName,
    voiceId,
    languageBoost,
    model: env.MINIMAX_SPEECH_MODEL || 'speech-2.8-hd',
    text,
    traceId: result.trace_id,
  };
}

async function generateAudioArchive() {
  const narration = 'Lin Meizhen was born in Suzhou in 1954. Every autumn, her mother dried osmanthus in the family courtyard. At nineteen, Meizhen left for textile work in Shanghai. Her mother packed a green tea tin with two osmanthus cakes, sewing needles, and one sentence about carrying home through care. In Shanghai, Meizhen built a working life and a family with Zhao Guowei. Their daughter Lan was born in 1981. On a crowded journey to Suzhou three years later, Lan slept on her mother\'s shoulder while Guowei stood beside them for six hours. Meizhen kept the ticket. After Guowei died in 2018, the apartment grew quiet. In 2026, evening conversations brought old details back: balcony rain, a factory badge, a hospital bracelet, and the green tin. By telling them aloud, Meizhen turned ordinary objects into a letter for Leo, and loneliness into a path between generations.';
  const letter = '亲爱的乐安：我以前以为，传承是给你留下一件值钱的东西。后来我才明白，真正留下来的，是我们在普通日子里怎样照顾一个人。绿色铁盒里的旧车票，并不因为它去过哪里而重要。我留下它，是因为那趟车上，你妈妈睡在我肩上，你外公在只有一个座位的时候，在我们身边站了六个小时。他没有说什么，可我一直记得。无论你以后走到哪里，都要记住，家不只是在你身后。家也在你愿意为别人停下来、站一会儿、伸出手的那些时刻里。等你回来，我把铁盒打开给你看，我们一起喝茶。爱你的，外婆，美珍。';
  const files = [];
  files.push(await generateSpeech({
    text: narration,
    voiceId: 'Serene_Woman',
    languageBoost: 'English',
    outputName: 'meizhen-life-narration-en.mp3',
  }));
  files.push(await generateSpeech({
    text: letter,
    voiceId: 'Chinese (Mandarin)_Kind-hearted_Elder',
    languageBoost: 'Chinese',
    outputName: 'meizhen-family-letter-zh.mp3',
  }));
  await writeFile(resolve(metadataDir, 'meizhen-audio-source.json'), `${JSON.stringify({ files }, null, 2)}\n`);
  console.log('MiniMax: narration and family-letter reading downloaded');
}

async function designVoice({ name, prompt, previewText }) {
  const host = env.MINIMAX_BASE_URL || 'https://api.minimaxi.com';
  console.log(`MiniMax: designing voice ${name}…`);
  const result = await apiJson(`${host}/v1/voice_design`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${required('MINIMAX_API_KEY')}` },
    body: JSON.stringify({ prompt, preview_text: previewText, aigc_watermark: false }),
  });
  if (!result.trial_audio || !result.voice_id) throw new Error(`MiniMax returned no audition for ${name}`);
  const outputName = `meizhen-elder-voice-${name}.mp3`;
  await writeFile(resolve(trialDir, outputName), Buffer.from(result.trial_audio, 'hex'));
  console.log(`MiniMax: voice ${name} ready`);
  return { name, prompt, previewText, voiceId: result.voice_id, outputName };
}

async function generateVoiceAuditions() {
  const previewText = '乐安，外婆今天又想起那只绿色铁盒了。里面没有什么值钱的东西，可每一件，我都舍不得丢。等你回来，我慢慢讲给你听。';
  const voices = [
    {
      name: 'a-warm',
      prompt: '七十多岁的中国女性，声音温暖慈祥，有自然的年龄感；气息略轻但吐字清楚，语速偏慢，像在安静的夜晚给外孙讲家事。真诚克制，不要播音腔，不要年轻化，不要夸张颤音。',
    },
    {
      name: 'b-storyteller',
      prompt: '七十多岁的江南女性长辈，声线柔和清亮，带岁月感但不虚弱；说话从容，有讲旧事时自然的停顿和淡淡笑意，像苏州家中的外婆讲一段珍藏多年的往事。不要广告感，不要舞台朗诵。',
    },
    {
      name: 'c-intimate',
      prompt: '接近八十岁的中国女性，嗓音偏低、温厚、亲近，呼吸和停顿自然；像独自在家时对远方孙子留下的一段私密语音。情绪平静，有一点思念但不悲情，吐字清楚，绝不夸张。',
    },
  ];
  const results = [];
  for (const voice of voices) results.push(await designVoice({ ...voice, previewText }));
  await writeFile(resolve(metadataDir, 'meizhen-voice-auditions.json'), `${JSON.stringify({ voices: results }, null, 2)}\n`);
}

async function generateH3DramaShot({ name, duration, prompt, referenceVideoUrls = [] }) {
  const configuredHost = env.MINIMAX_H3_BASE_URL || env.MINIMAX_BASE_URL || 'https://api.minimaxi.com';
  const hosts = [...new Set([configuredHost, 'https://api.minimax.cn'])];
  let task;
  let host;
  let lastError;
  console.log(`MiniMax H3: submitting ${name} (${duration}s)…`);
  for (const candidate of hosts) {
    try {
      task = await apiJson(`${candidate}/v2/video_generation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${required('MINIMAX_API_KEY')}` },
        body: JSON.stringify({
          model: env.MINIMAX_H3_MODEL || 'MiniMax-H3',
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
      host = candidate;
      break;
    } catch (error) {
      lastError = error;
      console.log(`MiniMax H3: ${new URL(candidate).hostname} unavailable for this key`);
    }
  }
  if (!task?.task_id || !host) throw lastError || new Error(`MiniMax H3 returned no task ID for ${name}`);
  const taskId = task.task_id;
  await writeFile(resolve(metadataDir, `minimax-h3-${name}.json`), `${JSON.stringify({ taskId, status: 'submitted', host, prompt }, null, 2)}\n`);

  const started = Date.now();
  let result;
  while (Date.now() - started < 20 * 60 * 1000) {
    await new Promise((done) => setTimeout(done, 10_000));
    result = await apiJson(`${host}/v2/query/video_generation/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${required('MINIMAX_API_KEY')}` },
    });
    const status = result?.task?.status;
    console.log(`MiniMax H3 ${name}: ${status}`);
    if (status === 'succeeded') break;
    if (status === 'failed' || status === 'cancelled') throw new Error(`MiniMax H3 ${name} failed: ${result?.task?.error?.message || status}`);
  }
  const downloadUrl = result?.task?.content?.url;
  if (!downloadUrl) throw new Error(`MiniMax H3 ${name} timed out before completion`);
  const videoResponse = await fetch(downloadUrl);
  if (!videoResponse.ok) throw new Error(`Could not download H3 shot ${name}: HTTP ${videoResponse.status}`);
  const outputName = `meizhen-drama-${name}.mp4`;
  await writeFile(resolve(trialDir, outputName), Buffer.from(await videoResponse.arrayBuffer()));
  await writeFile(resolve(metadataDir, `minimax-h3-${name}.json`), `${JSON.stringify({ taskId, status: 'succeeded', host, prompt, outputName, result: result.task }, null, 2)}\n`);
  console.log(`MiniMax H3: ${name} downloaded`);
}

async function h3ResultUrl(name) {
  const saved = JSON.parse(await readFile(resolve(metadataDir, `minimax-h3-${name}.json`), 'utf8'));
  const url = saved?.result?.content?.url;
  if (!url) throw new Error(`No H3 result URL stored for ${name}`);
  return url;
}

async function generateRemainingH3Shot(mode) {
  const sharedStyle = 'A refined warm New Chinese 2.5D animated short drama, hand-painted cinematic animation with natural full-body acting, expressive faces, coherent anatomy and physics, warm ivory light, muted jade green and tea-brown palette, restrained emotion, period-accurate everyday China, fluid 24fps motion. Match the visual language, character design and line work of reference video 1. No text, subtitles, logo, watermark, frozen pose, slideshow movement, facial morphing, extra fingers, melodrama, modern objects or dialogue.';
  const departureReference = await h3ResultUrl('1973-departure');
  if (mode === 'h3-childhood') {
    return generateH3DramaShot({
      name: '1954-childhood', duration: 10, referenceVideoUrls: [departureReference],
      prompt: `${sharedStyle} Suzhou courtyard in the early 1960s. The protagonist is Lin Meizhen from reference video 1 as an eight-year-old child, with the same thoughtful almond eyes and black hair in two short braids, wearing a simple pale teal cotton top. Her mother spreads freshly picked osmanthus blossoms across round bamboo trays. In one continuous scene, Meizhen runs in carrying a small basket, kneels beside her mother, carefully scatters the golden flowers with both hands, sneezes lightly, and they share a warm laugh. Leaves, hanging laundry and loose petals move in the autumn breeze. Begin wide as the child runs across the courtyard, track down as she kneels, end close on their moving hands among the blossoms. Genuine running, kneeling, reaching and laughing, not a static portrait.`,
    });
  }
  if (mode === 'h3-factory') {
    return generateH3DramaShot({
      name: '1970s-factory', duration: 10, referenceVideoUrls: [departureReference],
      prompt: `${sharedStyle} Shanghai textile factory in the mid-1970s. Lin Meizhen is the same nineteen-year-old woman from reference video 1, with the same two low braids and muted teal work jacket. Long rows of looms run continuously and fabric rolls move through the machines. In one continuous scene, Meizhen walks briskly beside a moving bolt of cloth, stops when she notices a flaw, lifts the fabric with both hands, marks the edge with tailor's chalk, then exchanges a quiet approving nod with another female worker. Threads, belts and fabric move convincingly. Start with a wide tracking shot through the active factory, follow her walking inspection, end close on her hands checking the weave. Strong purposeful work actions, no posing.`,
    });
  }
  const trainReference = await h3ResultUrl('1984-train');
  if (mode === 'h3-quiet') {
    return generateH3DramaShot({
      name: '2018-quiet-home', duration: 12, referenceVideoUrls: [trainReference],
      prompt: `${sharedStyle} Shanghai apartment on a rainy evening in 2018. The protagonist is Lin Meizhen from reference video 1 aged naturally into her mid-sixties, retaining the same thoughtful eyes and gentle face, now with short softly curled grey hair and a muted teal cardigan. The apartment is lived-in and warm, but the chair opposite her is empty. In one continuous restrained scene, Meizhen hears rain, rises from the table, walks to the balcony, gathers a damp shirt from the clothesline with both hands, pauses when she remembers that her late husband used to do this, then folds the shirt against her chest and looks back into the room. Rain strikes the glass, curtains and laundry move, steam rises from tea. Start on the empty chair and moving rain, follow her walking and gathering laundry, end on her calm reflective face. Genuine continuous movement, quiet rather than tragic.`,
    });
  }
  if (mode === 'h3-legacy') {
    const quietReference = await h3ResultUrl('2018-quiet-home');
    return generateH3DramaShot({
      name: '2026-legacy', duration: 12, referenceVideoUrls: [quietReference],
      prompt: `${sharedStyle} The same Shanghai apartment in 2026, now touched by clear warm morning light. Lin Meizhen is the same elderly woman from reference video 1, now seventy-two, wearing the same muted teal cardigan. In one continuous scene, she carries a worn green tea tin to the table, sits down, opens the lid with both hands, and gently takes out an old train ticket, a factory badge, a hospital bracelet and a photograph. She arranges the objects beside a handwritten letter, presses the letter flat, then looks toward a tablet showing only the soft silhouette of her grandson and smiles. Osmanthus branches in a vase move in the light breeze. Begin following the tin in her hands, orbit slightly as she opens and arranges the keepsakes, end close on her smile and the letter. Genuine carrying, sitting, opening and arranging actions; intimate and hopeful, not a product advertisement.`,
    });
  }
  throw new Error(`Unknown remaining H3 mode: ${mode}`);
}

async function generateSelectedVoice() {
  const auditions = JSON.parse(await readFile(resolve(metadataDir, 'meizhen-voice-auditions.json'), 'utf8'));
  const selected = auditions.voices.find((voice) => voice.name === 'a-warm');
  if (!selected?.voiceId) throw new Error('Voice audition A is missing');
  const narration = '林美珍，一九五四年出生在苏州。小时候每到秋天，她都会帮母亲把桂花铺在竹匾上。十九岁那年，她带着一只绿色铁盒离开家，到上海纺织厂工作。后来，她和赵国伟组成家庭，一九八一年女儿赵岚出生。三年后，一家人乘火车回苏州。车厢里只有一个座位，女儿睡在美珍肩上，国伟在旁边站了六个小时。二〇一八年国伟离开后，家里安静了许多。直到二〇二六年，她在夜晚的交谈中重新讲起雨声、旧车票和那只铁盒。她终于明白，传承不是留下多贵重的东西，而是把一个人怎样爱过、怎样照顾过别人，讲给下一代听。';
  const letter = '亲爱的乐安：我以前以为，传承是给你留下一件值钱的东西。后来我才明白，真正留下来的，是我们在普通日子里怎样照顾一个人。绿色铁盒里的旧车票，并不因为它去过哪里而重要。我留下它，是因为那趟车上，你妈妈睡在我肩上，你外公在只有一个座位的时候，在我们身边站了六个小时。他没有说什么，可我一直记得。无论你以后走到哪里，都要记住，家不只是在你身后。家也在你愿意为别人停下来、站一会儿、伸出手的那些时刻里。等你回来，我把铁盒打开给你看，我们一起喝茶。爱你的，外婆，美珍。';
  const files = [];
  files.push(await generateSpeech({ text: narration, voiceId: selected.voiceId, languageBoost: 'Chinese', outputName: 'meizhen-life-narration-zh-a.mp3', speed: 1.02 }));
  files.push(await generateSpeech({ text: letter, voiceId: selected.voiceId, languageBoost: 'Chinese', outputName: 'meizhen-family-letter-zh-a.mp3', speed: 0.96 }));
  await writeFile(resolve(metadataDir, 'meizhen-selected-voice.json'), `${JSON.stringify({ selected: 'a-warm', files }, null, 2)}\n`);
}

async function generateH3DramaTrials() {
  const sharedStyle = 'A refined warm New Chinese 2.5D animated short drama, hand-painted cinematic animation with natural full-body acting, expressive faces, coherent anatomy and physics, warm ivory light, muted jade green and tea-brown palette, restrained emotion, period-accurate everyday China, fluid 24fps motion. No text, subtitles, logo, watermark, frozen pose, slideshow movement, facial morphing, extra fingers, melodrama, modern objects or dialogue.';
  await generateH3DramaShot({
    name: '1973-departure',
    duration: 10,
    prompt: `${sharedStyle} Suzhou, early autumn morning in 1973. Nineteen-year-old Lin Meizhen, a slim Chinese woman with an oval face, thoughtful almond eyes and black hair in two low braids, wears a simple muted teal jacket and carries a cloth travel bag. In one continuous dramatic scene, her elderly mother places a small worn green tea tin inside the bag, tightens the bag strap, and smooths Meizhen's collar. Meizhen hugs her mother, walks several steps through the wooden courtyard gate, then turns back and waves while her mother remains beneath an osmanthus tree. Osmanthus petals and laundry move in a light breeze. Begin with a close-up of hands and the green tin, follow Meizhen walking, then widen to reveal the courtyard separation. The characters must genuinely walk, reach, embrace and turn; strong purposeful action, not a still portrait with camera zoom.`,
  });
  await generateH3DramaShot({
    name: '1984-train',
    duration: 12,
    prompt: `${sharedStyle} Inside a crowded Chinese passenger train travelling from Shanghai to Suzhou in 1984. Lin Meizhen is now thirty, with the same oval face and thoughtful almond eyes, hair pinned neatly, wearing a muted teal cotton jacket. She sits in the only narrow seat holding her sleeping three-year-old daughter against her shoulder. Her husband Zhao Guowei, a reserved Chinese man in his mid-thirties wearing a grey work jacket, stands beside them gripping the overhead rail as the carriage visibly sways. In a continuous sequence, he steadies himself, takes a metal tea cup from a passing vendor, carefully passes it to Meizhen, and she looks up with a small grateful smile while the child continues sleeping. Other passengers adjust their bags and sway naturally; scenery moves quickly outside the window. Start wide to establish the crowded moving carriage, track toward the family, then end on their hands passing the cup. Everyone must move naturally and purposefully; no frozen posing or simple image zoom.`,
  });
}

const mode = process.argv[2] || 'first-pass';
if (mode === 'copy') await generateCopy();
else if (mode === 'image') {
  const copy = JSON.parse(await readFile(resolve(metadataDir, 'meizhen-archive-copy.json'), 'utf8'));
  await generateImage(copy, 0);
} else if (mode === 'image2') {
  const copy = JSON.parse(await readFile(resolve(metadataDir, 'meizhen-archive-copy.json'), 'utf8'));
  await generateImage(copy, 1);
} else if (mode === 'video1' || mode === 'video2') {
  const copy = JSON.parse(await readFile(resolve(metadataDir, 'meizhen-archive-copy.json'), 'utf8'));
  await generateVideo(copy, mode === 'video2' ? 1 : 0);
} else if (mode === 'audio') {
  await generateAudioArchive();
} else if (mode === 'voice-design') {
  await generateVoiceAuditions();
} else if (mode === 'selected-voice') {
  await generateSelectedVoice();
} else if (mode === 'h3-trials') {
  await generateH3DramaTrials();
} else if (['h3-childhood', 'h3-factory', 'h3-quiet', 'h3-legacy'].includes(mode)) {
  await generateRemainingH3Shot(mode);
} else if (mode === 'h3-departure' || mode === 'h3-train') {
  const sharedStyle = 'A refined warm New Chinese 2.5D animated short drama, hand-painted cinematic animation with natural full-body acting, expressive faces, coherent anatomy and physics, warm ivory light, muted jade green and tea-brown palette, restrained emotion, fluid 24fps motion. No text, subtitles, logo, watermark, frozen pose, slideshow movement, facial morphing, extra fingers or melodrama.';
  if (mode === 'h3-departure') await generateH3DramaShot({ name: '1973-departure', duration: 10, prompt: `${sharedStyle} Suzhou in 1973. Nineteen-year-old Lin Meizhen with an oval face, thoughtful almond eyes and black hair in two low braids wears a muted teal jacket. Her elderly mother places a worn green tea tin in Meizhen's cloth travel bag and smooths her collar. Meizhen hugs her mother, walks through the courtyard gate, then turns back and waves beneath an osmanthus tree. Begin close on moving hands and the tin, follow her walking, end wide. Genuine continuous walking, reaching, embracing and turning.` });
  else await generateH3DramaShot({ name: '1984-train', duration: 12, prompt: `${sharedStyle} A crowded moving Chinese passenger train from Shanghai to Suzhou in 1984. Thirty-year-old Lin Meizhen with the same oval face and thoughtful eyes sits holding her sleeping three-year-old daughter. Her husband Zhao Guowei stands beside them gripping the overhead rail as the carriage sways. He steadies himself, takes a metal tea cup from a passing vendor and carefully passes it to Meizhen; she looks up with a small grateful smile. Passengers and scenery move naturally. Start wide, track closer, end on their moving hands. Genuine continuous action.` });
} else {
  const copy = await generateCopy();
  await generateImage(copy, 0);
}

console.log('First-pass media are ready in public/generated; private run metadata are in work/generated.');
