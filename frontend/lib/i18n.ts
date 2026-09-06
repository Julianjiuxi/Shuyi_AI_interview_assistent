'use client';

import { useCallback, useEffect, useState } from 'react';

export type UILang = 'en-US' | 'zh-CN';

const STORAGE_KEY = 'everroot-ui-lang';
const DEFAULT_LANG: UILang = 'en-US';

export const DICT: Record<UILang, Record<string, string>> = {
  'en-US': {
    // Nav / branding
    'nav.home': 'Everroot home',
    'nav.tagline': 'Companionship becomes legacy',
    'nav.private': 'Private family space',
    'nav.chat': 'Chat',
    'nav.family': 'Family',
    'nav.life': 'Life',
    'nav.map': 'Map',
    'nav.story': 'Story',
    'nav.film': 'Film',
    'nav.letter': 'Letter',
    'nav.voice': 'Voice',
    'nav.moments': 'Moments',

    // App mode (DM / RT)
    'mode.group.aria': 'App mode',
    'mode.dm.label': 'Demo mode · show Lin Meizhen',
    'mode.rt.label': 'Realtime mode · generated from conversations',
    'mode.rt.hint.title': 'Realtime mode',
    'mode.rt.hint.copy':
      'No demo content is loaded. Archive pages appear here only after the backend produces and publishes them from your conversations. Use the chat section below to create a person and start the interview.',

    // Welcome cover
    'welcome.eyebrow': 'A family keepsakes platform',
    'welcome.title.part1': 'Stay for the conversation.',
    'welcome.title.part2': 'Keep what matters.',
    'welcome.copy':
      'Some memories arrive as stories. Others begin with a small question on an ordinary evening. Everroot gives every generation a place to be heard—and every family a way to carry those voices forward.',
    'welcome.cta.archive': 'Enter a family archive',
    'welcome.cta.chat': 'Start a conversation',
    'welcome.cta.memory': 'See how a memory lives',
    'welcome.scroll': 'Discover the archive',
    'welcome.memory.eyebrow': 'How Everroot keeps a memory alive',
    'welcome.memory.title': 'From one conversation, to a book, to a whole family.',
    'welcome.memory.p1.title': 'Record it',
    'welcome.memory.p1.copy':
      'A small, voice-guided interview asks the gentle questions everyone forgets.',
    'welcome.memory.p2.title': 'Preserve it',
    'welcome.memory.p2.copy':
      'Transcripts, audio and photographs stay safely inside your private family archive.',
    'welcome.memory.p3.title': 'Hand it down',
    'welcome.memory.p3.copy':
      'A book and a short film appear automatically, ready for the next generation.',
    'welcome.promise.1.title': 'Be heard',
    'welcome.promise.1.copy': 'A familiar voice has time for the whole story.',
    'welcome.promise.2.title': 'Be remembered',
    'welcome.promise.2.copy': 'Small details find their place in a life.',
    'welcome.promise.3.title': 'Stay connected',
    'welcome.promise.3.copy': 'Stories keep moving between generations.',
    'welcome.lang.zh': '中文',
    'welcome.lang.en': 'English',

    // Chatting section
    'chat.eyebrow': 'Interview · Memory · Archive',
    'chat.title': 'Talk to your family. Memories settle automatically.',
    'chat.copy':
      'Pick or create an interviewee on the left, then chat directly in the middle. The backend extracts memories, asks follow-ups, and drafts the life book. A ShuYi Dev Console test panel is kept on the right.',
    'chat.refresh': 'Refresh',
    'chat.openTest': 'Open test panel',
    'chat.closeTest': 'Close panel',
    'chat.testToggle': 'Test',
    'chat.people.title': 'People / Projects',
    'chat.people.newAria': 'New project',
    'chat.people.loading': 'Loading…',
    'chat.people.error1': 'Load failed.',
    'chat.people.error2': 'Please make sure the backend http://127.0.0.1:8000 is running and CORS allows this origin.',
    'chat.people.empty': 'No people yet. Click + on the top right to create.',
    'chat.people.pin': 'Pin / Unpin',
    'chat.people.delete': 'Delete',
    'chat.people.confirmDelete': 'Confirm to delete?',
    'chat.create.placeholder.name': 'English / pinyin full name, e.g. Meizhen Lin',
    'chat.create.placeholder.zh': 'Chinese name (optional)',
    'chat.create.placeholder.birth': 'Birth year (optional)',
    'chat.create.submit': 'Create + First question',
    'chat.create.cancel': 'Cancel',
    'chat.create.creating': 'Creating…',
    'chat.chat.title.noProject': 'No person selected',
    'chat.chat.title.hasProject': 'Conversation #{id}',
    'chat.chat.sub.noSession': 'No session; creating a person auto-starts the first question.',
    'chat.chat.sub.hasSession': 'Session #{id}',
    'chat.chat.emptyTitle': 'Begin with one quiet conversation',
    'chat.chat.emptyCopy':
      'Pick an existing biography on the left to start the interview, or click + to create one. The system will automatically open the first question. Every answer becomes a structured memory and joins the family archive.',
    'chat.chat.noMessages':
      'Session has not started yet. If a first message should appear after selecting a person, wait for it to load automatically; otherwise use the test panel on the right to check /api/projects.',
    'chat.chat.role.user': 'You',
    'chat.chat.role.ai': 'AI Interviewer',
    'chat.chat.thinking': 'Thinking…',
    'chat.chat.fail': 'Failed to send: {msg}',
    'chat.placeholder.hasProject': 'Answer the last question. Enter to send, Shift+Enter for newline.',
    'chat.placeholder.noProject': 'Select or create a person on the left…',
    'chat.send': 'Send',
    'chat.disclaimer1': 'Using backend {api}. Interview chain runs on deepseek-v4-flash with reasoning disabled, each turn takes about 9s.',
    'chat.disclaimer2': 'Use the test panel on the right to call every backend endpoint directly.',
    'chat.test.title': 'API Test Panel',
    'chat.test.closeAria': 'Close',
    'chat.test.tab.family': 'Family',
    'chat.test.tab.memories': 'Memories',
    'chat.test.tab.documents': 'Documents',
    'chat.test.tab.archive': 'Archive',
    'chat.test.tab.media': 'Media',
    'chat.test.tab.files': 'Files',
    'chat.test.tab.projects': 'Projects',
    'chat.test.result': 'Result',
    'chat.test.busy': 'Requesting…',
    'chat.test.empty': 'Pick an operation above.',
    'chat.test.family.name': 'Family name',
    'chat.test.family.limit': 'List limit',
    'chat.test.family.id': 'Family ID',
    'chat.test.family.fromPid': 'from project_id',
    'chat.test.family.toPid': 'to project_id',
    'chat.test.family.relType': 'relation_type',
    'chat.test.family.row1': 'Create family',
    'chat.test.family.row2': 'Family list',
    'chat.test.family.row3': 'Family tree',
    'chat.test.family.row4': 'Create relationship',
    'chat.test.project.id': 'project_id',
    'chat.test.project.status': 'archive_status (draft/review/approved/published)',
    'chat.test.memory.id': 'memory_id',
    'chat.test.memory.row1': 'Memory list',
    'chat.test.memory.row2': 'Confirm memory',
    'chat.test.memory.row3': 'Reject memory',
    'chat.test.doc.id': 'document_id',
    'chat.test.doc.row1': 'Generate documents',
    'chat.test.doc.row2': 'Document list',
    'chat.test.doc.row3': 'Approve',
    'chat.test.doc.row4': 'Publish',
    'chat.test.archive.row1': 'Archive aggregate',
    'chat.test.archive.row2': 'Archive status',
    'chat.test.archive.row3': 'Usage stats',
    'chat.test.media.jobId': 'job_id',
    'chat.test.media.imgPrompt': 'image prompt',
    'chat.test.media.audioText': 'audio text',
    'chat.test.media.videoPrompt': 'video prompt',
    'chat.test.media.row1': 'Image job',
    'chat.test.media.row2': 'Voice job',
    'chat.test.media.row3': 'Video job',
    'chat.test.media.row4': 'Job status',
    'chat.test.media.row5': 'Asset list',
    'chat.test.file.hint': 'File upload uses multipart/form-data. A direct upload entry is below:',
    'chat.test.file.cap': 'Limits: image 20MB / audio 50MB / video 100MB.',
    'chat.test.project.row1': 'Project list',
    'chat.test.project.row2': 'Project detail',
    'chat.test.project.row3': 'Toggle pin',
    'chat.test.project.row4': 'Advance archive status',
    'chat.test.project.row5': 'Session list',
    'chat.test.run': 'Run',

    // Family section
    'family.eyebrow': 'Generations, in one living archive',
    'family.title': 'One family.\nMany witnesses.',
    'family.copy1': 'Every person is remembered from more than one direction.',
    'family.copy2':
      'Their own words sit beside the memories of parents, partners, children and grandchildren.',
    'family.stats.people': 'People remembered',
    'family.stats.memories': 'Verified memories',
    'family.stats.recordings': 'Recordings preserved',
    'family.collections.title': 'In this collection',
    'family.sources.title': 'Collected from',
    'family.sources.chat': 'Text interview',
    'family.sources.voice': 'Voice recordings',
    'family.sources.image': 'Photographs & letters',

    // Person node card
    'person.relation.self': 'Self',
    'person.relation.spouse': 'Spouse',
    'person.relation.child': 'Child',
    'person.relation.parent': 'Parent',
    'person.relation.sibling': 'Sibling',
    'person.relation.grandparent': 'Grandparent',
    'person.relation.grandchild': 'Grandchild',
    'person.relation.other': 'Family',
    'person.status.living': 'Living',
    'person.status.remembered': 'Remembered',
    'person.node.select': 'Select {name}',
    'person.detail.open': 'Open {name}’s full life archive',

    // Profile / Life tabs
    'life.heading.backTop': 'Back to family',
    'life.character.tab': 'Character',
    'life.hometown.tab': 'Roots',
    'life.interests.tab': 'Passions',
    'life.quote.title': 'A voice we still hear',
    'life.timeline.title': 'Life Timeline',
    'life.overview.title': 'Life Overview',
    'life.perspectives.title': 'Remembered by their family',
    'life.perspectives.empty':
      'No perspectives have been added yet for this family member. They can be written during an interview or uploaded as a keepsake.',
    'life.character.empty':
      'Personality traits and notes will appear here once the life interview has progressed further.',
    'life.character.note': 'Why this matters',
    'life.hometown.empty':
      'The places that shaped them will appear here once places, addresses and hometown stories are added.',
    'life.hometown.born': 'Born in',
    'life.hometown.lived': 'Also lived in',
    'life.hometown.based': 'Now based in',
    'life.interests.empty':
      'Small daily joys and lifelong interests will appear here once captured during the life interview.',
    'life.character.title': 'Personality',
    'life.hometown.title': 'Places & Roots',
    'life.interests.title': 'Interests & Small Things',

    // Journey / LifeMap
    'journey.eyebrow': 'A life, drawn in places',
    'journey.title': 'Every place they lived,\nturned into one map.',
    'journey.copy1':
      'Hometowns, first apartments, children’s bedrooms, last hospital rooms. Each stop contains a memory someone still tells.',
    'journey.copy2':
      'Family stops gather around the central life line in warm gold; personal cities sit further out in the family green.',
    'journey.empty':
      'No life-map stops have been compiled yet for this family member. Places and coordinates automatically appear once addresses, cities and biographical stops are collected in the life interview.',
    'journey.sidebar.title': 'A life on the move',
    'journey.sidebar.sub': 'Click any stop to step back into that place.',
    'journey.sidebar.life': 'Life stops',
    'journey.sidebar.family': 'Family stops',
    'journey.sidebar.empty1': 'Click a dot on the map',
    'journey.sidebar.empty2': 'or pick a stop on the right',
    'journey.sidebar.years': 'Years: {years}',

    // Story section
    'story.eyebrow': 'A life, written down',
    'story.title': 'Their story,\njust as they told it.',
    'story.copy':
      'Every paragraph in the manuscript below is sourced directly from transcripts and reviewed memories. Nothing is invented. Nothing is added.',
    'story.empty':
      'No written story has been attached to this family member yet. A manuscript is generated automatically once sufficient reviewed memories and life documents are available.',
    'story.perspectives.title': 'Remembered by',
    'story.perspectives.sub': 'Family memories, placed beside the story.',
    'story.perspectives.empty':
      'No family perspectives have been collected yet for this section. They appear automatically once more than one relative contributes a story or recording.',
    'story.perspectives.source': 'Source',
    'story.perspectives.relation': 'Relation to subject',
    'story.cta.sharePrompt': 'Share a memory of {name}',
    'story.cta.shareCopy':
      'A short story, a one-line memory, a photograph, an audio clip. Share what you still hear.',
    'story.cta.writeCaption': 'Write a story',
    'story.cta.recordCaption': 'Record a voice note',
    'story.cta.photoCaption': 'Upload a photograph',
    'story.cta.letterCaption': 'Write a letter',

    // Film section
    'film.eyebrow': 'A life, remembered in motion',
    'film.title': 'Their life film,\nquietly watching.',
    'film.copy1':
      'A short film sits beside the book: home photographs, ambient sound, and captions drawn directly from their own sentences.',
    'film.copy2':
      'Captions and chapters are pulled from the same reviewed manuscript as the story above — nothing is hallucinated, nothing is scripted by AI.',
    'film.copy3':
      'If a life film has not been produced yet, the approved stills, photographs and manuscript chapters can be turned into one by the family.',
    'film.empty.status': 'No film yet',
    'film.empty.heading': 'A life, remembered in motion.',
    'film.empty.description':
      'No life film has been added to {name}’s family page yet. Their written story, timeline and family perspectives remain available above.',
    'film.stats.captions': 'Captions',
    'film.stats.chapters': 'Chapters',
    'film.stats.duration': 'Duration',
    'film.stats.language': 'Language',

    // Letter section
    'letter.eyebrow': 'A letter to the ones left behind',
    'letter.title': 'A letter,\nstill reaching us.',
    'letter.copy':
      'Some sentences are only worth writing once. This letter is sourced directly from their last reviewed life manuscript — not composed by AI.',
    'letter.empty':
      'No final letter has been attached to this family member yet. A letter appears automatically once a reviewed family-letter document is available.',

    // Voice section
    'voice.eyebrow': 'A voice, preserved exactly',
    'voice.title': 'Keep hearing\nthat exact voice.',
    'voice.copy1':
      'A single voice recording becomes something the family can play. Speech is theirs alone; captions are transcripted verbatim.',
    'voice.copy2':
      'Nothing on this page is synthetic. The voice is the original recording. The captions are its transcript.',
    'voice.collections.title': 'In this collection',
    'voice.collections.sub':
      'Every item below is preserved directly from materials gathered during the life interview.',
    'voice.transcript': 'Chinese transcript',

    // Family moments
    'moments.eyebrow': 'Small things, still present',
    'moments.title': 'Small moments,\nstill part of today.',
    'moments.copy':
      'Family posts, photographs and perspectives live beside the archive. Comments, likes and shares are private to your family space.',
    'moments.ctaShare': 'Share a memory',
    'moments.placeholderAuthor': 'Your name',
    'moments.placeholderText': 'Write what you still remember…',
    'moments.submit': 'Post',
    'moments.perspectives.title': 'Remembered by',
    'moments.perspectives.sub': 'Short perspectives, placed alongside the day.',
    'moments.perspectives.empty':
      'No family perspectives have been collected yet for this section. They appear automatically once memories are added.',
    'moments.postLike': 'Like',
    'moments.postComment': 'Comment',
    'moments.commentsEmpty': 'No comments yet.',

    // Footer
    'footer.tagline': 'Companionship becomes legacy',
    'footer.copy': '© {year} Everroot · {family}. All contents are private to this family archive.',
  },

  'zh-CN': {
    'nav.home': 'Everroot 首页',
    'nav.tagline': '以陪伴传递记忆',
    'nav.private': '家庭私密空间',
    'nav.chat': '对话',
    'nav.family': '家庭',
    'nav.life': '人生',
    'nav.map': '地图',
    'nav.story': '故事',
    'nav.film': '影片',
    'nav.letter': '家书',
    'nav.voice': '声音',
    'nav.moments': '动态',

    // App mode (DM / RT)
    'mode.group.aria': '运行模式',
    'mode.dm.label': '展示模式 · 展示林美珍',
    'mode.rt.label': '实时模式 · 由对话生成',
    'mode.rt.hint.title': '实时模式',
    'mode.rt.hint.copy':
      '实时模式下不加载演示内容。档案子页面只有在后端根据对话生成并发布后才会出现。请在下方对话区创建人物并开始访谈。',

    'welcome.eyebrow': '家庭记忆 · 留声平台',
    'welcome.title.part1': '留住那场对话。',
    'welcome.title.part2': '守住那些重要的事。',
    'welcome.copy':
      '有些记忆生来就是故事；有些只是某个平凡夜里轻轻抛出的一个小问题。Everroot 让每一代人都被听见，让每个家庭带着这些声音继续走下去。',
    'welcome.cta.archive': '进入家庭档案',
    'welcome.cta.chat': '开始一场对话',
    'welcome.cta.memory': '看看记忆如何被留存',
    'welcome.scroll': '继续阅读档案',
    'welcome.memory.eyebrow': 'Everroot 如何让一段记忆活下来',
    'welcome.memory.title': '从一场对话，到一本书，再到整个家族。',
    'welcome.memory.p1.title': '先录下来',
    'welcome.memory.p1.copy': '温和的语音引导式访谈，替每个人问出那些总被忘掉的小问题。',
    'welcome.memory.p2.title': '再保存好',
    'welcome.memory.p2.copy': '文字稿、录音与照片，都安全地留在你家私密的档案里。',
    'welcome.memory.p3.title': '最后传下去',
    'welcome.memory.p3.copy': '一本书、一部短片，会自动整理好，等着交给下一代。',
    'welcome.promise.1.title': '被聆听',
    'welcome.promise.1.copy': '一个熟悉的声音，愿意花时间听完一整个故事。',
    'welcome.promise.2.title': '被记住',
    'welcome.promise.2.copy': '哪怕是细小的细节，也会在一段人生中找到它的位置。',
    'welcome.promise.3.title': '保持联结',
    'welcome.promise.3.copy': '故事在一代代之间，静静地继续流动。',
    'welcome.lang.zh': '中文',
    'welcome.lang.en': 'English',

    'chat.eyebrow': '访谈 · 记忆 · 档案',
    'chat.title': '与家人对话，让记忆自动沉淀',
    'chat.copy':
      '左边选择或新建访谈人物，中间直接聊天，后端会自动抽取记忆、追问并生成文稿。右侧保留接口测试面板，与豆包 Dev Console 功能一致。',
    'chat.refresh': '刷新',
    'chat.openTest': '打开测试面板',
    'chat.closeTest': '收起面板',
    'chat.testToggle': '测试',
    'chat.people.title': '人物 / Projects',
    'chat.people.newAria': '新建项目',
    'chat.people.loading': '加载中…',
    'chat.people.error1': '加载失败。',
    'chat.people.error2': '请确认后端 http://127.0.0.1:8000 已启动，且 CORS 已放行当前域名。',
    'chat.people.empty': '暂无人物，点击右上角 + 新建。',
    'chat.people.pin': '置顶 / 取消置顶',
    'chat.people.delete': '删除',
    'chat.people.confirmDelete': '确认删除？',
    'chat.create.placeholder.name': '英文 / 拼音全名，如 Meizhen Lin',
    'chat.create.placeholder.zh': '中文名（可选）',
    'chat.create.placeholder.birth': '出生年份（可选）',
    'chat.create.submit': '创建 + 首问',
    'chat.create.cancel': '取消',
    'chat.create.creating': '创建中…',
    'chat.chat.title.noProject': '未选择人物',
    'chat.chat.title.hasProject': '对话项目 #{id}',
    'chat.chat.sub.noSession': '无会话；新建人物会自动创建首问。',
    'chat.chat.sub.hasSession': '会话 #{id}',
    'chat.chat.emptyTitle': '从一次安静的对话开始',
    'chat.chat.emptyCopy':
      '左侧选一个已有传记人物开始访谈；或点击 + 新建，系统会自动开启第一次提问。所有回答会抽取为结构化记忆，并沉淀到家庭档案。',
    'chat.chat.noMessages':
      '会话尚未开始。选择人物后如出现首问消息，稍等自动加载；若没有，建议在右侧测试面板检查 /api/projects。',
    'chat.chat.role.user': '你',
    'chat.chat.role.ai': 'AI 访谈者',
    'chat.chat.thinking': '正在思考…',
    'chat.chat.fail': '发送失败：{msg}',
    'chat.placeholder.hasProject': '回答刚刚的问题，Enter 发送 / Shift+Enter 换行',
    'chat.placeholder.noProject': '先在左侧选择或新建人物…',
    'chat.send': '发送',
    'chat.disclaimer1': '使用后端 {api}。访谈链路由 deepseek-v4-flash（关闭推理）驱动，单轮约 9 秒。',
    'chat.disclaimer2': '右侧测试面板可直接调全部后端接口。',
    'chat.test.title': '接口测试面板',
    'chat.test.closeAria': '关闭',
    'chat.test.tab.family': '家庭',
    'chat.test.tab.memories': '记忆',
    'chat.test.tab.documents': '文稿',
    'chat.test.tab.archive': '档案',
    'chat.test.tab.media': '媒体',
    'chat.test.tab.files': '文件',
    'chat.test.tab.projects': '项目',
    'chat.test.result': '结果',
    'chat.test.busy': '请求中…',
    'chat.test.empty': '请选择上方操作。',
    'chat.test.family.name': '家庭名',
    'chat.test.family.limit': '列表 limit',
    'chat.test.family.id': '家庭 ID',
    'chat.test.family.fromPid': 'from project_id',
    'chat.test.family.toPid': 'to project_id',
    'chat.test.family.relType': 'relation_type',
    'chat.test.family.row1': '创建家庭',
    'chat.test.family.row2': '家庭列表',
    'chat.test.family.row3': '家谱树',
    'chat.test.family.row4': '创建关系',
    'chat.test.project.id': 'project_id',
    'chat.test.project.status': 'archive_status（草稿 / 审核 / 通过 / 已发布）',
    'chat.test.memory.id': 'memory_id',
    'chat.test.memory.row1': '记忆列表',
    'chat.test.memory.row2': '确认记忆',
    'chat.test.memory.row3': '驳回记忆',
    'chat.test.doc.id': 'document_id',
    'chat.test.doc.row1': '生成文稿',
    'chat.test.doc.row2': '文稿列表',
    'chat.test.doc.row3': '审批通过',
    'chat.test.doc.row4': '发布',
    'chat.test.archive.row1': '档案聚合',
    'chat.test.archive.row2': '档案状态',
    'chat.test.archive.row3': '用量统计',
    'chat.test.media.jobId': 'job_id',
    'chat.test.media.imgPrompt': 'image prompt',
    'chat.test.media.audioText': 'audio text',
    'chat.test.media.videoPrompt': 'video prompt',
    'chat.test.media.row1': '图片任务',
    'chat.test.media.row2': '语音任务',
    'chat.test.media.row3': '视频任务',
    'chat.test.media.row4': '任务状态',
    'chat.test.media.row5': '资源列表',
    'chat.test.file.hint': '文件上传使用 multipart/form-data，提供直传入口：',
    'chat.test.file.cap': '上限：图片 20MB / 音频 50MB / 视频 100MB。',
    'chat.test.project.row1': '项目列表',
    'chat.test.project.row2': '项目详情',
    'chat.test.project.row3': '置顶切换',
    'chat.test.project.row4': '归档状态推进',
    'chat.test.project.row5': '会话列表',
    'chat.test.run': '运行',

    'family.eyebrow': '数代人，一份活的档案',
    'family.title': '一个家族，\n被很多人同时见证。',
    'family.copy1': '每个人都不止从一个角度被记住。',
    'family.copy2': '他们自己的话，与父母、伴侣、子女、孙辈的记忆并排陈列。',
    'family.stats.people': '被记住的人',
    'family.stats.memories': '已核实记忆',
    'family.stats.recordings': '已留存录音',
    'family.collections.title': '本合辑收录',
    'family.sources.title': '采集来源',
    'family.sources.chat': '文字访谈',
    'family.sources.voice': '语音录音',
    'family.sources.image': '照片与书信',

    'person.relation.self': '本人',
    'person.relation.spouse': '配偶',
    'person.relation.child': '子女',
    'person.relation.parent': '父母',
    'person.relation.sibling': '兄弟姐妹',
    'person.relation.grandparent': '祖父母',
    'person.relation.grandchild': '孙辈',
    'person.relation.other': '亲属',
    'person.status.living': '仍在身旁',
    'person.status.remembered': '深切怀念',
    'person.node.select': '选择 {name}',
    'person.detail.open': '打开 {name} 的完整人生档案',

    'life.heading.backTop': '返回家庭总览',
    'life.character.tab': '性格',
    'life.hometown.tab': '故土',
    'life.interests.tab': '热爱',
    'life.quote.title': '我们仍能听见的声音',
    'life.timeline.title': '人生时间线',
    'life.overview.title': '人生概览',
    'life.perspectives.title': '家人眼中的他/她',
    'life.perspectives.empty':
      '这位家人还没有补充视角。可在访谈中采集，或作为纪念物直接上传。',
    'life.character.empty':
      '当人生访谈继续深入，性格特征与备注会自动出现在这里。',
    'life.character.note': '为什么这很重要',
    'life.hometown.empty':
      '当访谈里录入了地址、籍贯与故乡故事，塑造他们的地方会自动出现在这里。',
    'life.hometown.born': '出生于',
    'life.hometown.lived': '也曾居住于',
    'life.hometown.based': '现居',
    'life.interests.empty':
      '当访谈里记录下日常小事与毕生热爱，相应的条目会自动出现在这里。',
    'life.character.title': '性格特质',
    'life.hometown.title': '故土与归宿',
    'life.interests.title': '热爱与小事',

    'journey.eyebrow': '一辈子，画在去过的地方',
    'journey.title': '他们住过的每一个地方，\n汇成同一张地图。',
    'journey.copy1':
      '故乡、第一套公寓、孩子的卧室、最后一间病房。每一站都装着一段至今仍有人讲起的记忆。',
    'journey.copy2':
      '与家庭相关的站点围绕主线以暖金环绕；个人成长站点以家族墨绿沿外圈分布。',
    'journey.empty':
      '这位家人尚未整理出生命地图。当人生访谈里收集到足够的地址、城市与人生站点后，会自动生成。',
    'journey.sidebar.title': '一生的足迹',
    'journey.sidebar.sub': '点击任一站点，回到当时那个地方。',
    'journey.sidebar.life': '人生站点',
    'journey.sidebar.family': '家庭站点',
    'journey.sidebar.empty1': '点击地图上的标记',
    'journey.sidebar.empty2': '或在右侧选择站点',
    'journey.sidebar.years': '年代：{years}',

    'story.eyebrow': '一生的故事，认认真真写下来',
    'story.title': '他们的故事，\n原原本本按他们自己的话写。',
    'story.copy':
      '下方手稿中的每一段，都直接来自文字稿与已审核记忆。没有任何内容是虚构。没有任何文字是凭空添加。',
    'story.empty':
      '这位家人还没有整理好文字故事。当审核记忆与人生文稿足够时，会自动生成一份手稿。',
    'story.perspectives.title': '家人回忆',
    'story.perspectives.sub': '家人的片段回忆，排在故事旁边。',
    'story.perspectives.empty':
      '这里还没有家人补充视角。当不止一位亲属贡献了故事或录音后，会自动出现在这里。',
    'story.perspectives.source': '来源',
    'story.perspectives.relation': '与主人的关系',
    'story.cta.sharePrompt': '分享一段你记忆中的 {name}',
    'story.cta.shareCopy': '一个小故事、一句话回忆、一张照片、一段语音。把你仍听得见的东西留下来。',
    'story.cta.writeCaption': '写一个故事',
    'story.cta.recordCaption': '录一段语音',
    'story.cta.photoCaption': '上传一张照片',
    'story.cta.letterCaption': '写一封书信',

    'film.eyebrow': '一生的时光，静静放映',
    'film.title': '他们的生命影片，\n仍在安静地播放。',
    'film.copy1':
      '一本书旁，还有一部短片：老照片、环境声、以及直接从他们原话里抽出的字幕。',
    'film.copy2':
      '字幕与章节的来源，与上方人生故事出自同一套审核文稿——没有 AI 幻觉，没有任何编造台词。',
    'film.copy3':
      '如果尚未制作生命影片，家人可以把已审核的照片、人生章节整理成一部。',
    'film.empty.status': '尚未收录影片',
    'film.empty.heading': '一生的时光，静静放映。',
    'film.empty.description':
      '{name} 的家庭页面还没有加入生命影片。上方的文字故事、时间线与家人回忆仍然可以阅读。',
    'film.stats.captions': '字幕',
    'film.stats.chapters': '章节',
    'film.stats.duration': '时长',
    'film.stats.language': '语言',

    'letter.eyebrow': '一封写给留下的人的信',
    'letter.title': '那封信，\n仍在抵达我们。',
    'letter.copy':
      '有些话一辈子只值得写一次。这封家书直接来源于他/她最后一份审核通过的人生文稿——不是由 AI 代笔。',
    'letter.empty':
      '这位家人还没有整理好最后的家书。当一份已审核的 family_letter 文稿存在后，会自动出现在这里。',

    'voice.eyebrow': '一个声音，原原本本留存',
    'voice.title': '反复去听，\n那熟悉的声音。',
    'voice.copy1':
      '一段录音，变成了家人可以随时播放的纪念物。声音是本人的；字幕逐字逐句抄录。',
    'voice.copy2':
      '本页任何内容都不是合成品。声音来自原始录音。字幕是录音的转写稿。',
    'voice.collections.title': '本合辑收录',
    'voice.collections.sub':
      '下方每一件物品，都原样保留自访谈中采集的材料。',
    'voice.transcript': '中文抄本',

    'moments.eyebrow': '小事，仍像昨天一样存在',
    'moments.title': '细碎的日常，\n仍是今天的一部分。',
    'moments.copy':
      '家庭动态、照片、视角与档案并排陈列。评论、点赞、分享仅限家庭空间可见。',
    'moments.ctaShare': '分享一段记忆',
    'moments.placeholderAuthor': '你的名字',
    'moments.placeholderText': '写下你还记得的事……',
    'moments.submit': '发布',
    'moments.perspectives.title': '家人记得',
    'moments.perspectives.sub': '简短视角，与那一天的动态并列。',
    'moments.perspectives.empty':
      '这里还没有家人补充视角。当新记忆被添加后，会自动显示。',
    'moments.postLike': '点赞',
    'moments.postComment': '评论',
    'moments.commentsEmpty': '还没有评论。',

    'footer.tagline': '以陪伴传递记忆',
    'footer.copy': '© {year} Everroot · {family}。所有内容仅本家庭档案可见。',
  },
};

const ALL_KEYS = Object.keys(DICT[DEFAULT_LANG]);

export function formatTemplate(tpl: string, vars?: Record<string, string | number>): string {
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (m, k) => {
    const v = vars[k];
    return v === undefined ? m : String(v);
  });
}

function detectInitialLang(): UILang {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'zh-CN' || raw === 'en-US') return raw;
  } catch {
    /* ignore */
  }
  try {
    const nav = (window.navigator?.language || '').toLowerCase();
    if (nav.startsWith('zh')) return 'zh-CN';
  } catch {
    /* ignore */
  }
  return DEFAULT_LANG;
}

export function useI18n() {
  const [lang, setLangState] = useState<UILang>(detectInitialLang);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'zh-CN' ? 'zh-CN' : 'en';
    }
  }, [lang]);

  const setLang = useCallback((next: UILang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const dict = DICT[lang] || DICT[DEFAULT_LANG];
      const fallback = DICT[DEFAULT_LANG];
      const raw = dict[key] ?? fallback[key] ?? key;
      return formatTemplate(raw, vars);
    },
    [lang],
  );

  return { lang, setLang, t, keys: ALL_KEYS } as const;
}
