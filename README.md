# 述忆（ShuYi）· AI 口述历史传记访谈助手

一个 AI 传记访谈助手：通过多轮文本访谈收集受访者的人生记忆，由 DeepSeek 驱动完成「记忆抽取 → 追问规划 → 传记写作」的完整流程，并提供一个豆包风格的 Web 前端用于实际交互。

## 功能特性

- **Web 前端**（`static/`）：左侧人物栏（新增 / 删除 / 置顶）、中间对话流、底部输入卡片；预留语音输入/输出接口，内置「总结人生」入口。
- **SQLite + SQLAlchemy** 数据模型，记录项目、会话、原始对话与结构化记忆。
- **三个 DeepSeek 提示词模块**：
  1. **Memory Extractor** — 从回答中抽取结构化记忆
  2. **Interview Planner / Question Generator** — 生成候选追问
  3. **Biography Writer** — 把记忆组织成传记章节
- **确定性访谈规划评分层**（不依赖 LLM，结果可解释、可调优）。
- **全链路中文约束**：提问、记忆标题/内容、传记标题/正文均强制简体中文。
- **低延迟访谈链路**：访谈与记忆抽取使用 `deepseek-v4-flash` 并关闭推理模式（thinking），单轮约 9 秒。

## MVP 流程

```
用户回答 -> Memory Extractor -> 存储记忆
        -> Planner 对缺口/候选打分 -> DeepSeek 生成追问
        -> 重复以上 -> Biography Writer 生成章节
```

## 项目结构

```
ShuYi/
├── app/
│   ├── api/routes.py          # FastAPI 路由
│   ├── core/config.py         # 配置读取（.env）
│   ├── db/                    # SQLAlchemy engine / session / base
│   ├── models/                # entities（表模型）与 schemas（Pydantic）
│   ├── prompts/               # 三个 DeepSeek 提示词模块
│   ├── services/              # 访谈、传记、DeepSeek 客户端、规划器
│   └── main.py                # FastAPI 应用入口（含前端挂载）
├── static/                    # Web 前端（index.html / style.css / app.js）
├── scripts/
│   ├── demo_cli.py            # 命令行交互式访谈演示
│   └── init_db.py             # 初始化数据库表（可选）
├── tests/test_planner.py      # 规划层单元测试
├── .env.example               # 环境变量模板
├── requirements.txt
└── README.md
```

## 环境要求

- Python 3.10+
- 一个有效的 DeepSeek API Key

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

编辑 `.env`：

```bash
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxx       # 你的真实 key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro               # 传记写作等重型任务
DEEPSEEK_INTERVIEW_MODEL=deepseek-v4-flash   # 实时访谈链路（更快、更省）
DATABASE_URL=sqlite:///./shuyi.db
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

### GET /api/health

健康检查，不依赖 API Key。

```json
{ "status": "ok" }
```

### POST /api/reset

**初始化**：清空当前所有项目、对话、记忆与章节，从头开始（开发调试用）。

```json
{ "status": "ok", "message": "数据库已清空，从头开始" }
```

### GET /api/projects

按置顶优先、创建时间倒序返回人物列表，供前端左侧人物栏使用。

```json
[
  { "id": 1, "subject_name": "陈建国", "pinned": true, "created_at": "..." }
]
```

### GET /api/projects/{project_id}

返回单个项目的详情与其最新会话的完整对话流（`messages` 按时间升序）。

```json
{
  "id": 1,
  "subject_name": "陈建国",
  "pinned": true,
  "session_id": 3,
  "messages": [
    { "role": "assistant", "text": "..." },
    { "role": "user", "text": "..." }
  ]
}
```

### POST /api/projects/{project_id}/pin

切换该项目的置顶状态（`pinned` 取反）。

```json
{ "id": 1, "pinned": true }
```

### DELETE /api/projects/{project_id}

删除指定项目（连同其会话、记忆、章节）。

```json
{ "status": "ok", "deleted": 1 }
```

### POST /api/projects

创建访谈项目与会话，返回第一个问题（该问题由代码内置，不调用 LLM）。

请求：

```json
{ "subject_name": "陈建国" }
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `subject_name` | string | 否 | 受访者姓名，默认 `Unknown` |

响应：

```json
{
  "project_id": 1,
  "session_id": 1,
  "first_question": "我们从哪里开始聊起？……"
}
```

### POST /api/interview/turn

提交受访者的一段回答，返回抽取到的记忆、规划调试信息与下一个追问。**此接口会调用 DeepSeek（Flash 模型）。**

请求：

```json
{
  "project_id": 1,
  "session_id": 1,
  "answer": "我十七八岁的时候第一次离开家乡，去了上海。"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `project_id` | int | 是 | 项目 ID |
| `session_id` | int | 是 | 会话 ID |
| `answer` | string | 是 | 受访者本段回答 |

响应：

```json
{
  "next_question": "第一次到上海那天是什么感觉？",
  "extracted_memories": [
    {
      "memory_type": "event",
      "title": "离乡赴沪",
      "content": "十七八岁时第一次离开家乡前往上海。",
      "life_stage": "early_adulthood",
      "approx_year": null,
      "approx_age": 17,
      "location": "上海",
      "people": [],
      "tags": [],
      "importance": 0.8,
      "emotional_intensity": 0.6,
      "confidence": 0.9,
      "unresolved_points": []
    }
  ],
  "planner_debug": {
    "coverage": { "childhood": 0.0, "education": 0.25, "...": 0.0 },
    "ranked_candidates": [
      { "question": "...", "target_stage": "early_adulthood", "reason": "...", "score": 0.42 }
    ]
  }
}
```

`extracted_memories` 中每个元素的字段含义：

| 字段 | 类型 | 说明 |
|------|------|------|
| `memory_type` | string | `person` / `event` / `place` / `date` / `value` / `emotion` / `relationship` |
| `title` | string | 记忆标题（简体中文） |
| `content` | string | 记忆内容（简体中文） |
| `life_stage` | string | 人生阶段（`childhood` / `education` / `early_adulthood` / `career` / `family` / `later_life` / `turning_point` / `values` / `historical_context` / `unknown`） |
| `approx_year` / `approx_age` | int \| null | 大致年份 / 年龄 |
| `location` | string \| null | 地点 |
| `people` / `tags` | string[] | 相关人物 / 标签 |
| `importance` | float | 重要度 0~1 |
| `emotional_intensity` | float | 情绪强度 0~1 |
| `confidence` | float | 置信度 0~1 |
| `unresolved_points` | string[] | 待澄清点 |

> 说明：`memory_type` / `life_stage` 等枚举字段保持英文值（便于程序处理）；`title` / `content` / `next_question` 等面向人的字段强制简体中文。

### POST /api/chapters

基于已收集的记忆生成一个传记章节。**此接口会调用 DeepSeek（Pro 模型）。**

请求：

```json
{
  "project_id": 1,
  "focus": "写一段关于离乡与步入成年的章节。"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `project_id` | int | 是 | 项目 ID |
| `focus` | string | 否 | 章节主题/焦点 |

响应：

```json
{ "title": "离乡", "body": "……（简体中文正文）" }
```

## 配置项说明

所有配置通过 `.env` 文件加载（见 [app/core/config.py](app/core/config.py)）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEEPSEEK_API_KEY` | 空 | DeepSeek API Key，必填 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek API 地址 |
| `DEEPSEEK_MODEL` | `deepseek-v4-pro` | 传记写作等重型任务所用模型 |
| `DEEPSEEK_INTERVIEW_MODEL` | `deepseek-v4-flash` | 实时访谈链路所用模型（更快、更省） |
| `DATABASE_URL` | `sqlite:///./shuyi.db` | SQLite 连接串 |

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
4. 增加音频存储与句子级来源引用。
5. 增加记忆确认 / 编辑界面。
6. 访谈足够长后，再按需引入向量检索。
