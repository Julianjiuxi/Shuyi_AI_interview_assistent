# 述忆（ShuYi）· AI 口述历史传记访谈助手

一个 AI 传记访谈助手：通过多轮文本访谈收集受访者的人生记忆，由 DeepSeek 驱动完成「记忆抽取 → 追问规划 → 传记写作」的完整流程，并提供一个豆包风格的 Web 前端用于实际交互。

后端同时提供 Everroot 前端所需的家庭/家谱、记忆审核、多类型文稿、档案聚合、媒体生成（MiniMax）与文件上传等接口。

## 功能特性

- **Web 前端**（`static/`）：左侧人物栏（新增 / 删除 / 置顶）、中间对话流、底部输入卡片；预留语音输入/输出接口，内置「总结人生」入口，并含一个右侧「接口测试面板」用于调试新增接口。
- **SQLite + SQLAlchemy** 数据模型，记录家庭、项目、会话、原始对话、结构化记忆、文稿、媒体任务与资源。
- **家庭与家谱**：家庭 CRUD、家谱树、成员关系（父子/配偶/兄弟等，含跨家庭校验与唯一约束）。
- **结构化记忆审核**：记忆列表（多维度过滤/排序）、单条编辑、确认/拒绝、批量审核。
- **多类型文稿生成**：传记 / 章节 / 家书 / 摘要 / 旁白 / 分镜脚本，含软删除与审批状态机。
- **档案聚合**：仅聚合已确认记忆、已发布文稿、已审批媒体，输出时间线、精选故事、家书、金句与媒体清单。
- **媒体生成（MiniMax）**：图片 / 语音 / 视频任务，幂等去重、取消/重试、资源审批与删除。
- **文件上传**：图片 / 音频 / 视频，带 MIME 与大小校验。
- **统一错误格式**：`{"error": {"code", "message", "details", "request_id"}}`。
- **三个 DeepSeek 提示词模块**：Memory Extractor / Interview Planner / Document Writer。
- **确定性访谈规划评分层**（不依赖 LLM，结果可解释、可调优）。
- **全链路中文约束**：提问、记忆标题/内容、传记标题/正文均强制简体中文。
- **低延迟访谈链路**：访谈与记忆抽取使用 `deepseek-v4-flash` 并关闭推理模式（thinking），单轮约 9 秒。

## MVP 流程

```
用户回答 -> Memory Extractor -> 存储记忆
        -> Planner 对缺口/候选打分 -> DeepSeek 生成追问
        -> 重复以上 -> Document Writer 生成文稿
        -> 记忆确认 -> 档案聚合 -> 媒体生成（MiniMax）
```

## 项目结构

```
ShuYi/
├── app/                      # FastAPI 后端
│   ├── api/                  # 路由（routes / families / memories / documents / archives / media / files / errors / deps）
│   ├── core/config.py        # 配置读取（.env）
│   ├── db/                   # SQLAlchemy engine / session / base
│   ├── models/               # entities（表模型）与 schemas（Pydantic）
│   ├── prompts/              # DeepSeek 提示词模块
│   ├── services/             # 访谈、文稿、档案、媒体任务、MiniMax、存储、规划器
│   ├── workers/              # 媒体任务后台执行（MVP 用 BackgroundTasks）
│   └── main.py               # FastAPI 应用入口（含前端/静态/上传挂载）
├── frontend/                 # Everroot 前端（React 19 + Vinext + Vite，面向用户的家庭记忆展示）
├── tools/
│   └── everroot-person-system/  # 通用人物档案生成系统（Skill + 网页模板 + 安装脚本）
├── examples/
│   └── lin-meizhen/          # 林美珍示例人物（person.json + 媒体素材）
├── docs/
│   └── everroot/             # Everroot 集成文档（后端需求 + ShuYi 对接说明）
├── static/                   # 后端 Dev Console（index.html / style.css / app.js）
├── scripts/
│   ├── demo_cli.py           # 命令行交互式访谈演示
│   └── init_db.py            # 初始化数据库表（可选）
├── tests/                    # pytest 测试（访谈、关系、记忆、文稿、档案、媒体任务）
├── .env.example              # 环境变量模板
├── requirements.txt
└── README.md
```

## 前端（Everroot）

`frontend/` 是面向用户的家庭记忆展示前端（原 `Everroot-Final-Package/01-live-website`），技术栈为 React 19 + Vinext + Vite，独立于后端进程运行。

```bash
cd frontend
npm install
npm run dev
```

> 要求 Node >= 22.13.0。在 `frontend/.env.local` 中配置（`.env.local` 已被 gitignore，不会提交）：

```bash
# 数据源：mock 走内置林美珍 Demo，api 走真实 ShuYi 后端
NEXT_PUBLIC_SHUYI_DATA_SOURCE=mock
# 真实后端地址（api 模式生效）
NEXT_PUBLIC_SHUYI_API_BASE_URL=http://127.0.0.1:8000
# 展示的家庭 ID（api 模式生效）
NEXT_PUBLIC_SHUYI_FAMILY_ID=1
# 档案文稿语言偏好，默认 zh-CN
NEXT_PUBLIC_SHUYI_ARCHIVE_LANGUAGE=zh-CN
```

> `DATA_SOURCE=mock` 时前端无需后端即可演示；切到 `api` 后前端仅读取公开档案接口（家谱 `/families/{id}/tree`、档案 `/projects/{id}/archive`、状态 `/projects/{id}/archive/status`），不读取原始对话与未审核记忆。

其余目录：

- `tools/everroot-person-system/`：通用人物档案生成系统（Codex Skill + 网页模板 + 安装脚本）。
- `examples/lin-meizhen/`：林美珍示例人物（结构化数据 + 媒体素材）。
- `docs/everroot/`：Everroot 后端需求与 ShuYi 对接文档。

后端与前端是两个进程，本地开发分别启动（后端 `uvicorn app.main:app --reload`，前端 `npm run dev`）。

## 环境要求

- Python 3.10+
- 一个有效的 DeepSeek API Key
- （可选）MiniMax API Key，用于媒体生成
- （前端）Node >= 22.13.0

## Quick Start

### 1. 安装依赖

建议使用虚拟环境：

```bash
python -m venv .venv
# Windows 激活：
.venv\Scripts\activate
# macOS / Linux 激活：
source .venv/bin/activate

pip install -r requirements.txt
```

> 若国内镜像源（如清华源）查询不到 `fastapi`，可临时指定官方源：
> `pip install -r requirements.txt -i https://pypi.org/simple`

### 2. 配置环境变量

复制模板并填入你的 DeepSeek API Key：

```bash
# Windows
copy .env.example .env
# macOS / Linux
cp .env.example .env
```

编辑 `.env`（关键项）：

```bash
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxx       # 你的真实 key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro               # 传记写作等重型任务
DEEPSEEK_INTERVIEW_MODEL=deepseek-v4-flash   # 实时访谈链路（更快、更省）
DATABASE_URL=sqlite:///./shuyi.db

# MiniMax 媒体生成（key 由前端同学提供；留空则媒体接口报错或走 Mock）
MINIMAX_API_KEY=
ENABLE_MOCK_MEDIA=false

# 开发期设为 true 以启用 /api/reset；生产环境必须设为 false
ENABLE_DESTRUCTIVE_ENDPOINTS=true
```

> - `.env` 已被 `.gitignore` 排除，不会被提交到仓库。
> - `DEEPSEEK_MODEL` 与 `DEEPSEEK_INTERVIEW_MODEL` 共用同一个 API Key，无需更换令牌。

### 3. 启动服务

```bash
uvicorn app.main:app --reload
```

- 前端界面：<http://127.0.0.1:8000/>
- 交互式接口文档：<http://127.0.0.1:8000/docs>

> 数据库表会在应用启动时自动创建，无需手动执行初始化脚本。

### 4. 命令行交互式访谈演示（可选）

```bash
python -m scripts.demo_cli
```

> **注意**：运行 `scripts/` 下的脚本请使用 `python -m scripts.xxx`（而非 `python scripts/xxx.py`），否则会因 `app` 不在导入路径而报 `ModuleNotFoundError: No module named 'app'`。

### 5. 运行测试

```bash
pytest -q
```

## 接口文档

基础地址：`http://127.0.0.1:8000`，所有接口前缀为 `/api`。

统一错误格式：

```json
{
  "error": {
    "code": "UNCONFIRMED_HIGH_IMPORTANCE",
    "message": "存在高重要度未确认记忆，无法发布",
    "details": {},
    "request_id": "xxxxxxxx"
  }
}
```

### 基础

#### GET /api/health

健康检查，不依赖 API Key。

```json
{ "status": "ok" }
```

#### POST /api/reset

**初始化**：清空当前所有数据并重建表结构（开发调试用，受 `ENABLE_DESTRUCTIVE_ENDPOINTS` 控制）。

```json
{ "status": "ok", "message": "数据库已清空，从头开始" }
```

### 项目（人物）

#### GET /api/projects

按置顶优先、创建时间倒序返回人物列表，支持 `family_id`、`status` 过滤。

```json
[
  {
    "id": 1, "subject_name": "陈建国", "pinned": true,
    "family_id": 1, "display_name": "建国", "chinese_name": "陈建国",
    "birth_year": 1948, "death_year": null,
    "avatar_url": null, "archive_status": "draft", "created_at": "...", "updated_at": "..."
  }
]
```

#### GET /api/projects/{project_id}

返回单个项目详情、最新会话的完整对话流（`messages` 按时间升序）与人物档案 `profile`。

```json
{
  "id": 1, "subject_name": "陈建国", "pinned": true, "session_id": 3,
  "messages": [
    { "role": "interviewer", "text": "..." },
    { "role": "storyteller", "text": "..." }
  ],
  "profile": {
    "subject_name": "陈建国", "display_name": "建国", "chinese_name": "陈建国",
    "gender": "male", "birth_year": 1948, "death_year": null,
    "birth_place": "上海", "current_place": "北京", "short_bio": null, "visibility": "private"
  },
  "archive_status": "draft"
}
```

#### POST /api/projects

创建访谈项目与会话，返回第一个问题（该问题由代码内置，不调用 LLM）。

请求（人物档案字段均为可选）：

```json
{
  "subject_name": "陈建国",
  "family_id": null,
  "display_name": "建国",
  "chinese_name": "陈建国",
  "gender": "male",
  "birth_year": 1948,
  "death_year": null,
  "birth_place": "上海",
  "current_place": "北京",
  "visibility": "private"
}
```

响应：

```json
{ "project_id": 1, "session_id": 1, "first_question": "我们从哪里开始聊起？……" }
```

#### PATCH /api/projects/{project_id}

更新项目人物档案字段（`subject_name` / `family_id` / `display_name` / `chinese_name` / `gender` / `birth_year` / `death_year` / `birth_place` / `current_place` / `short_bio` / `visibility`）。

#### PATCH /api/projects/{project_id}/archive-status

推进归档状态机（`draft → review → approved → published`）。存在高重要度（importance >= 0.8）未确认记忆时返回 409。

请求：`{ "status": "approved" }`

#### POST /api/projects/{project_id}/pin

切换该项目的置顶状态（`pinned` 取反）。

#### DELETE /api/projects/{project_id}

删除指定项目（连同其会话、记忆、文稿等）。

#### GET /api/projects/{project_id}/sessions

返回项目的会话列表。

#### POST /api/sessions/{session_id}/complete

完成会话，写入 `ended_at` 与 `session_summary`。

#### GET /api/sessions/{session_id}/messages

返回指定会话的完整消息列表。

### 访谈

#### POST /api/interview/turn

提交受访者的一段回答，返回抽取到的记忆、规划调试信息与下一个追问。**此接口会调用 DeepSeek（Flash 模型）。**

请求：

```json
{ "project_id": 1, "session_id": 1, "answer": "我十七八岁的时候第一次离开家乡，去了上海。" }
```

响应：

```json
{
  "next_question": "第一次到上海那天是什么感觉？",
  "extracted_memories": [
    {
      "memory_type": "event", "title": "离乡赴沪", "content": "十七八岁时第一次离开家乡前往上海。",
      "life_stage": "early_adulthood", "approx_year": null, "approx_age": 17,
      "location": "上海", "people": [], "tags": [],
      "importance": 0.8, "emotional_intensity": 0.6, "confidence": 0.9, "unresolved_points": []
    }
  ],
  "planner_debug": {
    "coverage": { "childhood": 0.0, "education": 0.25, "...": 0.0 },
    "ranked_candidates": [ { "question": "...", "target_stage": "early_adulthood", "reason": "...", "score": 0.42 } ]
  }
}
```

#### POST /api/chapters

基于已收集的记忆生成一个传记章节（兼容旧接口，内部走 `DocumentService.generate_chapter`）。**此接口会调用 DeepSeek（Pro 模型）。**

请求：`{ "project_id": 1, "focus": "写一段关于离乡与步入成年的章节。" }`

响应：`{ "id": 1, "title": "离乡", "body": "……", "status": "draft", ... }`

### 家庭与家谱

#### POST /api/families

创建家庭。请求：`{ "name": "陈家", "description": "...", "visibility": "private" }`

#### GET /api/families

家庭列表（cursor 分页），响应：`{ "items": [...], "next_cursor": null }`。每个 item 含 `member_count`。

#### GET /api/families/{family_id}

获取家庭详情。

#### PATCH /api/families/{family_id}

更新家庭（`name` / `description` / `visibility` / `cover_asset_id`）。

#### GET /api/families/{family_id}/tree

家谱树，返回家庭内所有成员与关系。

```json
{
  "family": { "id": 1, "name": "陈家" },
  "people": [ { "project_id": 1, "subject_name": "陈建国", "birth_year": 1948, "archive_status": "draft" } ],
  "relationships": [ { "id": 1, "from_project_id": 1, "to_project_id": 2, "relation_type": "child", "label": "", "confirmed": false } ]
}
```

#### POST /api/families/{family_id}/relationships

创建成员关系。请求：`{ "from_project_id": 1, "to_project_id": 2, "relation_type": "child", "label": "", "confirmed": false }`

> `relation_type` 取值：`parent` / `child` / `spouse` / `sibling` / `grandparent` / `grandchild` / `other`。两个成员必须属于同一家庭。

#### PATCH /api/relationships/{relationship_id}

更新关系。

#### DELETE /api/relationships/{relationship_id}

删除关系。

### 记忆

#### GET /api/projects/{project_id}/memories

记忆列表，支持过滤：`life_stage`、`memory_type`、`status`、`min_importance`、`sort`（`created_at` / `chronological` / `importance`）。

#### GET /api/memories/{memory_id}

获取单条记忆（含 `source_excerpt` 原文出处）。

#### PATCH /api/memories/{memory_id}

编辑记忆（`title` / `content` / `approx_year` / `approx_age` / `location` / `people` / `tags` / `unresolved_points` / `importance` / `emotional_intensity`）。

#### POST /api/memories/{memory_id}/confirm

确认记忆。请求：`{ "confirmed_by": "reviewer", "review_note": "" }`

#### POST /api/memories/{memory_id}/reject

驳回记忆。请求：`{ "review_note": "与事实不符" }`

#### POST /api/projects/{project_id}/memories/bulk-review

批量审核。请求：`{ "confirm_ids": [1, 2], "reject_ids": [3] }`，返回 `{ "confirmed": 2, "rejected": 1 }`。

### 文稿

#### POST /api/projects/{project_id}/documents/generate

按类型批量生成文稿。请求：

```json
{
  "document_types": ["biography", "family_letter"],
  "language": "en",
  "tone": "warm, restrained, faithful",
  "focus": "",
  "only_confirmed_memories": true
}
```

> `document_types` 取值：`biography` / `chapter` / `family_letter` / `summary` / `narration` / `storyboard`。

#### GET /api/projects/{project_id}/documents

文稿列表（cursor 分页），支持 `type`、`status` 过滤。

#### GET /api/documents/{document_id}

获取单篇文稿。

#### PATCH /api/documents/{document_id}

编辑文稿（`title` / `body` / `language` / `status`）。

#### DELETE /api/documents/{document_id}

软删除文稿（`status → deleted`）。

#### POST /api/documents/{document_id}/approve

审批文稿（`status → approved`）。

#### POST /api/documents/{document_id}/publish

发布文稿（`status → published`）。审批（approved）与发布（published）是两个独立动作：审批通过表示内容已核对，发布后才进入档案聚合、向家庭成员展示。

### 档案聚合

#### GET /api/projects/{project_id}/archive

聚合档案（`language` 默认 `en`，`include_transcript` 默认 false）。返回时间线、精选故事、家书、金句、媒体清单与审核状态。

#### GET /api/projects/{project_id}/archive/status

返回归档状态与下一步建议（`interview` / `memories` / `documents` / `media` / `next_action`）。

#### GET /api/projects/{project_id}/usage

返回 DeepSeek / MiniMax 用量统计与汇总。

### 媒体（MiniMax）

#### POST /api/projects/{project_id}/media/images

生成图片任务（202）。请求：`{ "prompt": "...", "aspect_ratio": "16:9", "count": 1 }`

#### POST /api/projects/{project_id}/media/audio

生成语音任务（202）。请求：`{ "voice_id": "...", "text": "...", "language": "en", "speed": 1.0 }`

#### POST /api/projects/{project_id}/media/videos

生成视频任务（202）。请求：`{ "prompt": "...", "duration_seconds": 6, "first_frame_asset_id": null }`（`duration_seconds` 5~8）。

> 三类接口均支持 `Idempotency-Key` 请求头去重。

#### GET /api/media/jobs/{job_id}

查询任务状态。

#### POST /api/media/jobs/{job_id}/cancel

取消任务。

#### POST /api/media/jobs/{job_id}/retry

重试任务（生成新 job，带 `parent_job_id`）。

#### GET /api/projects/{project_id}/media

资源列表，支持 `type`、`approved` 过滤。

#### PATCH /api/media/assets/{asset_id}

更新资源（`title` / `caption` / `sort_order` / `visibility` / `approved`）。

#### DELETE /api/media/assets/{asset_id}

删除资源（同时删除本地文件）。

### 文件上传

#### POST /api/files

上传文件（`multipart/form-data`，字段名 `file`）。

- 图片：jpeg / png / webp（≤ 20MB）
- 音频：mp3 / wav / m4a（≤ 50MB）
- 视频：mp4（≤ 100MB）

响应：`{ "file_id": 1, "asset_type": "image", "mime_type": "image/jpeg", "url": "...", "created_at": "..." }`

> 上传的文件暂不绑定项目（`project_id=0`），由前端后续绑定。

## 配置项说明

所有配置通过 `.env` 文件加载（见 [app/core/config.py](app/core/config.py)）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEEPSEEK_API_KEY` | 空 | DeepSeek API Key，必填 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek API 地址 |
| `DEEPSEEK_MODEL` | `deepseek-v4-pro` | 传记写作等重型任务所用模型 |
| `DEEPSEEK_INTERVIEW_MODEL` | `deepseek-v4-flash` | 实时访谈链路所用模型（更快、更省） |
| `DATABASE_URL` | `sqlite:///./shuyi.db` | SQLite 连接串 |
| `MINIMAX_API_KEY` | 空 | MiniMax API Key（媒体生成用） |
| `MINIMAX_BASE_URL` | `https://api.minimax.io` | MiniMax API 地址 |
| `MINIMAX_IMAGE_MODEL` | `image-01` | 图片生成模型 |
| `MINIMAX_SPEECH_MODEL` | `speech-2.8-hd` | 语音合成模型 |
| `MINIMAX_VIDEO_MODEL` | `MiniMax-H3` | 视频生成模型 |
| `MEDIA_STORAGE_DIR` | `./uploads` | 本地媒体存储目录 |
| `PUBLIC_BASE_URL` | `http://127.0.0.1:8000` | 公开访问基础地址 |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS 允许来源（逗号分隔） |
| `ENABLE_DESTRUCTIVE_ENDPOINTS` | `false` | 是否启用 `/api/reset`（开发 true） |
| `ENABLE_MOCK_MEDIA` | `false` | 无 key 时媒体生成走 Mock 占位 |

> 访谈链路的 DeepSeek 请求已关闭推理模式（thinking），并严格控制 `max_tokens`（记忆抽取 900、规划器 800），以换取低延迟。

## 设计原则

模型不允许凭空捏造记忆：重要的记忆事实始终关联到它被抽取出来的那条原文（`source_utterance`）。规划器被刻意拆成两层：

1. **Python 中的确定性打分**（[app/services/planner.py](app/services/planner.py)）；
2. **LLM 生成最终问题的措辞**。

这样能在开发阶段保证产品可解释、易于调优。

## 后续建议

1. 用 5-10 次真实模拟访谈调优提示词。
2. 文本链路稳定后，接入语音转文字（前端已预留语音输入/输出接口）。
3. 需要账号或多设备使用时，将 SQLite 替换为 Supabase / PostgreSQL。
4. 媒体任务 MVP 使用 FastAPI `BackgroundTasks`，生产环境建议迁移到 Redis + Celery。
5. 增加账号体系与审批流（当前无鉴权，所有接口直接可用）。
6. 访谈足够长后，再按需引入向量检索。
