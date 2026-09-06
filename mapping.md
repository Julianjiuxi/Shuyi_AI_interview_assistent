# ShuYi 前后端功能 / API / 控件 / 约束全景图

> 生成时间：2026-09-05
> 覆盖范围：后端 FastAPI 全部接口 + 两套前端（豆包 Dev Console、Everroot 家庭记忆展示）。
> 本文档是「代码即事实」的映射说明，若与代码冲突以源码为准。

---

## 目录

- [1. 总体架构](#1-总体架构)
- [2. 统一约定](#2-统一约定)
- [3. 后端 API 全清单](#3-后端-api-全清单)
  - [3.1 项目 / 访谈 / 会话（routes.py）](#31-项目--访谈--会话routespy)
  - [3.2 家庭与家谱（families.py）](#32-家庭与家谱familiespy)
  - [3.3 结构化记忆（memories.py）](#33-结构化记忆memoriespy)
  - [3.4 文稿（documents.py）](#34-文稿documentspy)
  - [3.5 档案聚合（archives.py）](#35-档案聚合archivespy)
  - [3.6 媒体生成（media.py）](#36-媒体生成mediapy)
  - [3.7 文件上传（files.py）](#37-文件上传filespy)
- [4. 关键返回结构与枚举](#4-关键返回结构与枚举)
- [5. 前端控件清单](#5-前端控件清单)
  - [5.1 豆包 Dev Console（static/）](#51-豆包-dev-consolestatic)
  - [5.2 Everroot 家庭记忆展示（frontend/）](#52-everroot-家庭记忆展示frontend)
- [6. 数据源解耦与隐私边界](#6-数据源解耦与隐私边界)

---

## 1. 总体架构

```
Everroot 前端 (React 19 + Vinext + Vite)
        │  NEXT_PUBLIC_SHUYI_DATA_SOURCE=mock|api
        ▼
  Data Provider (mock-provider | shuyi-provider)
        │  ViewModel (FamilyArchiveViewModel)
        ▼
  UI (family-archive.tsx)  ←—— 条件渲染，缺字段隐藏
        │
        │  (api 模式) 仅调用公开档案接口
        ▼
FastAPI 后端 (app/main.py, 前缀 /api)
        │
        ├─ SQLite (SQLAlchemy 2.0)
        ├─ DeepSeek-V4 (访谈 flash / 写作 pro)
        └─ MiniMax (媒体生成，key 留空待前端同学提供)
```

- 后端进程：`uvicorn app.main:app --reload --port 8000`
- 前端进程：`npm run build` 后 `node dist/standalone/server.js`（standalone 模式，绕开 workerd）
- 豆包 Dev Console 由后端直接挂载在根路径 `/`（`static/`），用于开发调试。

---

## 2. 统一约定

### 2.1 统一错误格式

所有接口异常（业务错误 / HTTP 错误 / 校验错误）都收敛为同一结构：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",      // 稳定错误码
    "message": "Request validation failed",
    "details": null,                  // 结构化详情（可空）
    "request_id": "uuid-or-header"    // 从 X-Request-ID 头透传，或自动生成
  }
}
```

- 响应头会回写 `X-Request-ID`。
- 业务错误码示例：`DESTRUCTIVE_DISABLED`、`CROSS_FAMILY`、`DUPLICATE_RELATIONSHIP`、`UNCONFIRMED_HIGH_IMPORTANCE`、`VALIDATION_ERROR`。
- 普通 404/400 走 `HTTP_404` / `HTTP_400` 这类 `HTTP_{status}` 码。

### 2.2 枚举约束（后端 Pydantic Literal）

| 枚举 | 取值 |
|---|---|
| `LifeStage`（人生阶段） | `childhood`, `education`, `early_adulthood`, `career`, `family`, `later_life`, `turning_point`, `values`, `historical_context`, `unknown` |
| `MemoryType`（记忆类型） | `person`, `event`, `place`, `date`, `value`, `emotion`, `relationship` |
| `MemoryStatus`（记忆状态） | `extracted`, `review`, `confirmed`, `rejected` |
| `Visibility`（可见性） | `private`, `family`, `public` |
| `ArchiveStatus`（归档状态） | `draft`, `review`, `approved`, `published` |
| `DocumentType`（文稿类型） | `biography`, `chapter`, `family_letter`, `summary`, `narration`, `storyboard` |
| `DocumentStatus`（文稿状态） | `draft`, `review`, `approved`, `published`, `deleted` |
| `RelationType`（关系类型） | `parent`, `child`, `spouse`, `sibling`, `grandparent`, `grandchild`, `other` |
| `MediaType`（媒体类型） | `image`, `audio`, `video` |
| `MediaJobStatus`（媒体任务状态） | `queued`, `processing`, `succeeded`, `failed`, `cancelled` |
| `AssetType`（资源类型） | `avatar`, `image`, `audio`, `video`, `thumbnail` |

### 2.3 硬约束

1. **输出语言**：LLM 生成的提问、记忆标题/正文、传记标题/正文强制简体中文。
2. **审计追踪**：每条 `Memory` 必须通过 `source_utterance_id` 关联原始对话（防幻觉）。
3. **approve ≠ publish**：`approved`（审批通过）与 `published`（对外发布）是两个独立动作，各有独立端点。
4. **高重要度拦截**：存在 `importance >= 0.8` 且未确认的记忆时，禁止把归档推进到 `approved`/`published`（返回 409）。
5. **跨家庭校验**：创建关系时两端成员必须存在且属于同一家庭，否则 400；重复关系返回 409。
6. **软删除**：文稿删除为状态软删除（`deleted`），不做物理删除。
7. **公共档案隐私边界**：公开档案接口默认**不读** raw transcript 与未确认记忆；只有显式 `include_transcript=true` 才返回 transcript。
8. **语言过滤 + 回退**：档案里的精选故事 / 家书优先返回指定语言已发布文稿，找不到时回退任意语言。
9. **媒体幂等**：媒体任务创建支持 `Idempotency-Key` 头去重。
10. **CORS**：`ALLOWED_ORIGINS`（逗号分隔）控制允许来源，禁止 `*` + `credentials` 组合。

---

## 3. 后端 API 全清单

> 所有路径均带 `/api` 前缀（由 `main.py` 统一挂载）。

### 3.1 项目 / 访谈 / 会话（routes.py）

| 方法 | 路径 | 功能 | 返回 | 关键约束 |
|---|---|---|---|---|
| GET | `/health` | 健康检查 | `{"status":"ok"}` | 无 |
| POST | `/reset` | 清空库并重建表 | `{"status","message"}` | 需 `ENABLE_DESTRUCTIVE_ENDPOINTS=true`，否则 403 |
| GET | `/projects` | 项目列表 | `list[ProjectListItem]` | 支持 `family_id`、`status` 过滤；按 pinned/pinned_at/id 倒序 |
| POST | `/projects` | 创建人物 + 会话 + 首问 | `CreateProjectResponse` | 触发 DeepSeek 首问 |
| GET | `/projects/{project_id}` | 项目详情（含消息流） | `ProjectDetail` | 无会话时 404 |
| PATCH | `/projects/{project_id}` | 更新项目字段 | 部分字段 dict | 部分更新 |
| POST | `/projects/{project_id}/pin` | 置顶开关 | `{"id","pinned"}` | toggle |
| DELETE | `/projects/{project_id}` | 删除项目 | `{"status","deleted"}` | 级联删除 |
| PATCH | `/projects/{project_id}/archive-status` | 推进归档状态 | `{"id","archive_status"}` | 高重要度未确认记忆拦截（409） |
| GET | `/projects/{project_id}/sessions` | 会话列表 | `[{id,started_at,ended_at,session_summary}]` | 按 id 倒序 |
| GET | `/sessions/{session_id}/messages` | 会话消息 | `[{id,role,text,audio_url,created_at}]` | 按 id 升序 |
| POST | `/sessions/{session_id}/complete` | 完成会话 | `InterviewService.complete_session` 结果 | 会写 ended_at |
| POST | `/interview/turn` | **核心访谈轮** | `InterviewTurnResponse` | 入参 `{project_id, session_id, answer}` |
| POST | `/chapters` | 生成章节（总结人生） | `ChapterResponse` | 入参 `{project_id, focus}` |

**InterviewTurnResponse** 返回字段：

```json
{
  "next_question": "追问文本",
  "next_utterance": "",
  "dialogue_act": "",
  "conversation_state": {},
  "extracted_memories": [{ "memory_type":"event", "title":"", "content":"", ... }],
  "planner_debug": {}
}
```

### 3.2 家庭与家谱（families.py）

| 方法 | 路径 | 功能 | 返回 | 关键约束 |
|---|---|---|---|---|
| POST | `/families` | 创建家庭 | `FamilyOut`（201） | slug 自动生成，重名加后缀 |
| GET | `/families` | 家庭列表 | `{"items":[...],"next_cursor":...}` | `limit` 1~100，cursor 分页 |
| GET | `/families/{family_id}` | 家庭详情 | `FamilyOut` | 404 |
| PATCH | `/families/{family_id}` | 更新家庭 | `FamilyOut` | 部分更新 |
| GET | `/families/{family_id}/tree` | 家谱树 | `TreeOut` | people + relationships |
| POST | `/families/{family_id}/relationships` | 创建关系 | `RelationshipOut`（201） | 跨家庭校验；重复 409 |
| PATCH | `/relationships/{relationship_id}` | 更新关系 | `RelationshipOut` | 404 |
| DELETE | `/relationships/{relationship_id}` | 删除关系 | `{"status","deleted"}` | 404 |

**TreeOut** 结构（前端 api 模式核心数据源）：

```json
{
  "family": { "id": 1, "name": "..." },
  "people": [
    { "project_id": 1, "display_name": "", "chinese_name": "", "subject_name": "",
      "birth_year": null, "death_year": null, "avatar_url": null, "archive_status": "draft" }
  ],
  "relationships": [
    { "id": 1, "from_project_id": 1, "to_project_id": 2,
      "relation_type": "child", "label": "", "confirmed": false }
  ]
}
```

### 3.3 结构化记忆（memories.py）

| 方法 | 路径 | 功能 | 返回 | 关键约束 |
|---|---|---|---|---|
| GET | `/projects/{project_id}/memories` | 记忆列表 | `list[MemoryOut]` | 过滤：`life_stage`/`memory_type`/`status`/`min_importance`；排序：`sort=chronological|importance|created_at` |
| GET | `/memories/{memory_id}` | 记忆详情 | `MemoryOut` | 404 |
| PATCH | `/memories/{memory_id}` | 编辑记忆 | `MemoryOut` | `people`/`tags`/`unresolved_points` 转 JSON 存储 |
| POST | `/memories/{memory_id}/confirm` | 确认记忆 | `MemoryOut` | 置 `confirmed=true`、`status=confirmed` |
| POST | `/memories/{memory_id}/reject` | 驳回记忆 | `MemoryOut` | 置 `confirmed=false`、`status=rejected` |
| POST | `/projects/{project_id}/memories/bulk-review` | 批量审核 | `{"confirmed":n,"rejected":m}` | 只处理属于该项目的记忆 |

**MemoryOut** 关键字段（含审计追踪）：

```json
{
  "id": 1,
  "source_utterance_id": 12,          // 审计：关联原始对话
  "memory_type": "event",
  "title": "", "content": "",
  "life_stage": "childhood",
  "approx_year": 1960, "approx_age": 10, "location": "苏州",
  "people": [], "tags": [], "unresolved_points": [],
  "importance": 0.8, "emotional_intensity": 0.6, "confidence": 0.9,
  "status": "review", "confirmed": false,
  "source_excerpt": "原文摘录", "review_note": "", "confirmed_by": "",
  "created_at": "...", "updated_at": "..."
}
```

### 3.4 文稿（documents.py）

| 方法 | 路径 | 功能 | 返回 | 关键约束 |
|---|---|---|---|---|
| POST | `/projects/{project_id}/documents/generate` | 生成文稿 | `list[DocumentOut]` | 支持 `Idempotency-Key`；类型 `document_types` |
| GET | `/projects/{project_id}/documents` | 文稿列表 | `{"items":[...],"next_cursor":...}` | 过滤 `type`/`status`；cursor 分页 |
| GET | `/documents/{document_id}` | 文稿详情 | `DocumentOut` | 404 |
| PATCH | `/documents/{document_id}` | 更新文稿 | `DocumentOut` | 部分更新 |
| DELETE | `/documents/{document_id}` | 删除文稿 | `{"status","deleted"}` | 软删除 |
| POST | `/documents/{document_id}/approve` | 审批通过 | `DocumentOut` | `status=approved` |
| POST | `/documents/{document_id}/publish` | 发布 | `DocumentOut` | `status=published`（与 approve 分离） |

**DocumentOut** 字段：

```json
{
  "id": 1, "project_id": 1,
  "document_type": "biography",
  "title": "", "body": "",
  "language": "zh-CN", "status": "draft",
  "source_memory_ids": [],
  "model_provider": "deepseek", "model_name": "", "prompt_version": "",
  "created_at": "...", "updated_at": "..."
}
```

### 3.5 档案聚合（archives.py）

| 方法 | 路径 | 功能 | 返回 | 关键约束 |
|---|---|---|---|---|
| GET | `/projects/{project_id}/archive` | 档案聚合 | `ArchiveOut` | `language`（默认 `en`）；`include_transcript`（默认 `false`） |
| GET | `/projects/{project_id}/archive/status` | 档案状态 | `ArchiveStatusOut` | 无 |
| GET | `/projects/{project_id}/usage` | 用量统计 | `UsageOut` | 无 |

**ArchiveOut** 结构（公共档案，前端 api 模式读取）：

```json
{
  "project": { "id":1, "subject_name":"", "display_name":"", "chinese_name":"",
               "birth_year":null, "death_year":null, "birth_place":"", "current_place":"",
               "short_bio":"", "avatar_url":null, "archive_status":"draft", "visibility":"private" },
  "family": { "id":1, "name":"..." },          // 可空
  "relationships": [ ... ],
  "timeline": [                                  // 仅已确认且有年份的记忆
    { "memory_id":1, "year":1960, "place":"苏州", "title":"", "detail":"",
      "confidence":0.9, "confirmed":true }
  ],
  "featured_story": { "document_id":1, "title":"", "body":"" },  // 已发布传记/章节
  "family_letter": { "document_id":2, "title":"", "body":"" },   // 已发布家书
  "preserved_quotes": [],
  "media": { "avatar":null, "images":[], "audio":[], "videos":[] },
  "review": { "unconfirmed_memory_count":0, "unresolved_points":[] },
  "updated_at": "..."
}
```

> **隐私边界**：`transcript` 字段仅在 `include_transcript=true` 时才出现在结果中。

**ArchiveStatusOut**：

```json
{
  "project_id": 1, "archive_status": "draft",
  "interview": { "sessions":1, "messages":10, "completed":false },
  "memories": { "total":5, "confirmed":3, "unresolved":1 },
  "documents": { "draft":0, "approved":0 },
  "media": { "queued":0, "processing":0, "approved":0 },
  "next_action": "Review 1 unresolved memories"
}
```

### 3.6 媒体生成（media.py）

| 方法 | 路径 | 功能 | 返回 | 关键约束 |
|---|---|---|---|---|
| POST | `/projects/{project_id}/media/images` | 图片任务 | `MediaJobCreateResponse`（202） | `Idempotency-Key` |
| POST | `/projects/{project_id}/media/audio` | 语音任务 | `MediaJobCreateResponse`（202） | `voice_id`/`text` 必填 |
| POST | `/projects/{project_id}/media/videos` | 视频任务 | `MediaJobCreateResponse`（202） | `Idempotency-Key` |
| GET | `/media/jobs/{job_id}` | 任务状态 | `MediaJobOut` | 404 |
| POST | `/media/jobs/{job_id}/cancel` | 取消任务 | `MediaJobOut` | 409 |
| POST | `/media/jobs/{job_id}/retry` | 重试任务 | `MediaJobOut`（202） | 404 |
| GET | `/projects/{project_id}/media` | 资源列表 | `list[MediaAssetOut]` | 过滤 `type`/`approved` |
| PATCH | `/media/assets/{asset_id}` | 更新资源 | `MediaAssetOut` | 可改 `approved`/`visibility` |
| DELETE | `/media/assets/{asset_id}` | 删除资源 | `{"status","deleted"}` | 同时删存储 |

**MediaJobCreateResponse**：`{"job_id":1, "media_type":"image", "status":"queued", "created_at":"..."}`

### 3.7 文件上传（files.py）

| 方法 | 路径 | 功能 | 返回 | 关键约束 |
|---|---|---|---|---|
| POST | `/files` | 上传文件（multipart） | `FileUploadOut` | MIME/大小校验，见下表 |

**上传约束**：

| 类型 | 允许 MIME | 大小上限 |
|---|---|---|
| image | `image/jpeg`, `image/png`, `image/webp` | 20 MB |
| audio | `audio/mpeg`, `audio/wav`, `audio/x-wav`, `audio/mp4`, `audio/x-m4a` | 50 MB |
| video | `video/mp4` | 100 MB |

**FileUploadOut**：`{"file_id":1, "asset_type":"image", "mime_type":"image/jpeg", "url":"/uploads/...", "created_at":"..."}`

> 注意：文件上传后 `project_id=0`（暂不关联项目），由前端后续绑定；`approved=false` 需审批后才进档案。

---

## 4. 关键返回结构与枚举

### 4.1 项目 / 人物

```json
// ProjectListItem（列表项）
{ "id":1, "subject_name":"", "pinned":false, "created_at":"",
  "family_id":null, "display_name":"", "chinese_name":"",
  "birth_year":null, "death_year":null, "avatar_url":null,
  "archive_status":"draft", "updated_at":null }

// CreateProjectResponse
{ "project_id":1, "session_id":1, "first_question":"首问文本" }

// ProjectDetail（含会话消息 + 人物画像）
{ "id":1, "subject_name":"", "pinned":false, "session_id":1,
  "messages":[{"role":"interviewer","text":""}],
  "profile":{ ... }, "archive_status":"draft" }
```

### 4.2 访谈 Planner 内部类型（仅供理解，不直接对外）

- `ConversationState`：`current_focus`, `focus_stage`, `focus_memory_id`, `focus_strength`, `storyteller_lead`, `closure_signal`, `user_focus_lock`
- `CandidateDialogueMove`：`utterance`, `act_type`, `form`, `topic_relation`, `target_stage`, `target_memory_id`, 以及 8 个评分维度（`focus_alignment`, `storyteller_alignment`, `conversational_naturalness`, `information_gain`, `emotional_value`, `narrative_value`, `novelty`, `sensitivity_risk`, `repetition_risk`）

---

## 5. 前端控件清单

### 5.1 豆包 Dev Console（static/）

技术栈：原生 HTML/CSS/JS（`static/index.html` + `style.css` + `app.js`），由后端挂载在 `/`。

#### 布局与控件

| 区域 | 控件 | 功能 | 调用的 API |
|---|---|---|---|
| 左侧任务栏 | `+ 新对话` / `+ 创建新访谈` | 打开创建弹窗 | — |
| 左侧任务栏 | 人物列表（`person-list`） | 展示访谈项目，点击切换 | `GET /api/projects` |
| 左侧任务栏 | 人物「置顶/取消置顶」按钮（↑/↓） | 置顶切换 | `POST /api/projects/{id}/pin` |
| 左侧任务栏 | 人物「删除」按钮（×） | 删除项目（confirm） | `DELETE /api/projects/{id}` |
| 左侧底部 | 用户卡片 | 占位 | — |
| 顶部条 | 「复制对话」按钮 | 复制全部气泡文本 | — |
| 顶部条 | 「接口测试面板」按钮 | 打开右侧调试面板 | — |
| 中间主区 | 对话流（`chat-stream`） | 渲染 AI/用户气泡 | 数据来自 `GET /api/projects/{id}` |
| 中间主区 | 空状态提示 | 无项目时引导 | — |
| 底部输入 | 文本框（`textarea`） | 输入回答 | `POST /api/interview/turn` |
| 底部输入 | 「更多功能」菜单 | 展开功能列表 | — |
| 底部输入 | 「总结人生」 | 生成传记总结卡片 | `POST /api/chapters` |
| 底部输入 | 「语音输入」按钮 | 预留 STT（弹「即将支持」） | — |
| 气泡动作 | 「复制」 | 复制单条 | — |
| 气泡动作 | 「朗读」 | 浏览器 TTS 朗读（zh-CN） | — |
| 弹窗 | 创建访谈弹窗 | 输入姓名/中文名/出生年 | `POST /api/projects` |

#### 接口测试面板（7 个 Tab）

| Tab | 操作按钮 | 对应 API |
|---|---|---|
| 家庭 | 创建家庭 / 家庭列表 / 家谱树 / 创建关系 / 删除关系 | `POST /families`、`GET /families`、`GET /families/{id}/tree`、`POST /families/{id}/relationships`、`DELETE /relationships/{id}` |
| 记忆 | 记忆列表 / 确认 / 驳回 / 编辑 / 批量审核 | `GET /projects/{id}/memories`、`POST /memories/{id}/confirm`、`POST /memories/{id}/reject`、`PATCH /memories/{id}`、`POST /projects/{id}/memories/bulk-review` |
| 文稿 | 生成文稿 / 文稿列表 / 审批 / 删除 | `POST /projects/{id}/documents/generate`、`GET /projects/{id}/documents`、`POST /documents/{id}/approve`、`DELETE /documents/{id}` |
| 档案 | 档案聚合 / 状态 / 用量 | `GET /projects/{id}/archive`、`GET /projects/{id}/archive/status`、`GET /projects/{id}/usage` |
| 媒体 | 图片 / 语音 / 视频 / 任务状态 / 资源列表 | `POST /projects/{id}/media/images`、`POST /projects/{id}/media/audio`、`POST /projects/{id}/media/videos`、`GET /media/jobs/{id}`、`GET /projects/{id}/media` |
| 文件 | 上传文件 | `POST /files` |
| 项目 | 更新项目 / 归档状态 / 会话列表 / 完成会话 | `PATCH /projects/{id}`、`PATCH /projects/{id}/archive-status`、`GET /projects/{id}/sessions`、`POST /sessions/{id}/complete` |

### 5.2 Everroot 家庭记忆展示（frontend/）

技术栈：React 19 + Vinext + Vite，`frontend/app/family-archive.tsx` + `frontend/app/page.tsx` + `lib/`。

#### 页面 Section（按渲染顺序）

| Section | 组件 | 显示条件 | 数据来源字段 |
|---|---|---|---|
| 欢迎封面 | `WelcomeCover` | 始终 | 静态文案 |
| 顶部导航 | `<header>` | 始终 | 锚点导航 |
| 家庭区 | `FamilySection` | 始终 | `family.family.name`、`family.people`、`family.stats`、`family.sources` |
| 人物档案 | `ProfileSection` | `active` 存在 | `person`（avatar/name/chinese/years/role/overview/location/occupation/personality/interests/smallThings/perspectives/timeline/quote） |
| 生命地图 | `LifeMap` | `active.journey?.length` | `person.journey`（城市/坐标/年代/记忆） |
| 完整故事 | `StorySection` | `active.story?.length` | `person.storyTitle/storyDeck/story[]/perspectives` |
| 生命影片 | `FilmSection` | `active.film` | `person.film`（src/poster/duration/chapters/language/status/heading/description） |
| 家书 | `LetterSection` | `active.letter?.length` | `person.letterTo/letter[]` |
| 声音档案 | `VoiceSection` | `active` 存在 | `person.voice` + `family.collections` |
| 家庭动态 | `FamilyMoments` | `active.moments?.length \|\| active.perspectives?.length` | `person.moments/perspectives` |
| 页脚 | `<footer>` | 始终 | `family.family.name` |

#### 交互控件

| 控件 | 功能 | 实现 |
|---|---|---|
| 人物节点（`PersonNode`） | 切换人物，懒加载档案 | `selectPerson(id)` → `getArchiveProvider().getPerson(projectId)` |
| 地图标记（`map-marker`） | 切换旅程站点 | `setActiveIndex(index)` |
| 地图站点列表（`map-stop-row`） | 切换站点 | 同上 |
| 影片播放器（`<video>`） | 播放生命影片 | `<video controls>` |
| 音频播放器（`<audio>`） | 播放家书朗读 | `<audio controls>` |
| 抄本折叠（`<details>`） | 展开中文抄本 | 原生 details |
| 点赞（`moment-action`） | 点赞动态 | `setLiked`（本地状态） |
| 评论展开 | 展开评论 | `setShowComments` |
| 「分享记忆」表单 | 新增本地动态 | `shareMemory`（本地状态，未持久化） |
| 锚点导航 | 跳转到各 section | `href="#..."` |

---

## 6. 数据源解耦与隐私边界

### 6.1 数据源切换

前端通过环境变量切换数据源（`frontend/.env.local`，已被 gitignore）：

```env
NEXT_PUBLIC_SHUYI_DATA_SOURCE=mock        # mock | api
NEXT_PUBLIC_SHUYI_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SHUYI_FAMILY_ID=1
NEXT_PUBLIC_SHUYI_ARCHIVE_LANGUAGE=zh-CN
SITES_LOCAL_AUTH=1                        # 本地 standalone 调试旁路（跳过 ChatGPT 登录）
```

- `mock`：使用 `mock-provider.ts`，展示林美珍 Demo（无需后端）。
- `api`：使用 `shuyi-provider.ts`，只调用公开档案接口。

### 6.2 Provider 分层

```
ArchiveDataProvider 接口
  ├── getFamily(id): Promise<FamilyArchiveViewModel>   // 调用 /tree + 首个 /archive
  └── getPerson(projectId): Promise<PersonArchiveViewModel>  // 调用 /archive
```

- `mock-provider.ts`：内置 `PROJECT_IDS` 映射、`journeys`、`meizhenMoments`、`demoSources`，为 meizhen 提供真实 demo film，非 meizhen 提供 film placeholder。
- `shuyi-provider.ts`：只读 `GET /families/{id}/tree` + `GET /projects/{id}/archive`，**不读** `getProject`/`listMemories`/transcript。

### 6.3 隐私边界（重要）

| 页面类型 | 可读数据 | 不可读数据 |
|---|---|---|
| 公共档案页（Everroot api 模式） | `tree`（家谱）、`archive`（已确认时间线、已发布文稿、已审批媒体）、`archive/status` | raw transcript、未审核记忆（`extracted/review` 状态）、未审批媒体 |
| 编辑/管理界面（豆包 Dev Console） | 全部（含 memories/documents/media/files） | 无（本地开发用） |

### 6.4 前端「条件渲染」原则

后端未提供的字段 / section，前端一律隐藏，**不伪造 demo 内容**。例如：
- `story` 为空 → 不渲染 StorySection
- `film` 为空 → 不渲染 FilmSection（但 mock 会提供 placeholder film）
- `journey` 为空 → 不渲染 LifeMap
- `moments` 与 `perspectives` 都为空 → 不渲染 FamilyMoments
