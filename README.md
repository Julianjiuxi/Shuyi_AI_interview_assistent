# Shuyi Biography Agent MVP

一个 AI 传记访谈助手的最小后端原型。它通过多轮文本访谈收集受访者的人生记忆，并由 DeepSeek 驱动完成「记忆抽取 → 追问规划 → 传记写作」的完整流程。

## 功能特性

- SQLite 数据库 + SQLAlchemy 数据模型
- 三个 DeepSeek 提示词模块：
  1. **Memory Extractor** — 从回答中抽取结构化记忆
  2. **Interview Planner / Question Generator** — 生成候选追问
  3. **Biography Writer** — 把记忆组织成传记章节
- 一个**确定性的访谈规划评分层**（不依赖 LLM，结果可解释、可调优）
- FastAPI 文本访谈接口
- CLI 交互式演示脚本
- 单元测试

## MVP 流程

```
用户回答 -> Memory Extractor -> 存储记忆
        -> Planner 对缺口/候选打分 -> DeepSeek 生成一句追问
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
│   └── main.py                # FastAPI 应用入口
├── scripts/
│   ├── demo_cli.py            # 命令行交互式访谈演示
│   └── init_db.py             # 初始化数据库表
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
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxx   # 你的真实 key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
DATABASE_URL=sqlite:///./shuyi.db
```

> `.env` 已被 `.gitignore` 排除，不会被提交到仓库。

### 3. 初始化数据库

```bash
python -m scripts.init_db
```

### 4. 启动服务

```bash
uvicorn app.main:app --reload
```

打开交互式文档：<http://127.0.0.1:8000/docs>

### 5. CLI 交互式访谈演示

```bash
python -m scripts.demo_cli
```

### 6. 运行测试

```bash
pytest -q
```

> **注意**：运行 `scripts/` 下的脚本请使用 `python -m scripts.xxx`（而非 `python scripts/xxx.py`），否则会因 `app` 不在导入路径而报 `ModuleNotFoundError: No module named 'app'`。

## 接口文档

基础地址：`http://127.0.0.1:8000`，所有接口前缀为 `/api`。

### GET /api/health

健康检查，不依赖 API Key。

响应：

```json
{ "status": "ok" }
```

### POST /api/projects

创建访谈项目与会话，返回第一个问题（该问题由代码内置，不调用 LLM）。

请求：

```json
{ "subject_name": "Demo User" }
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `subject_name` | string | 否 | 受访者姓名，默认 `Unknown` |

响应：

```json
{
  "project_id": 1,
  "session_id": 1,
  "first_question": "Where would you like to begin your story? ..."
}
```

### POST /api/interview/turn

提交受访者的一段回答，返回抽取到的记忆、规划调试信息与下一个追问。**此接口会调用 DeepSeek。**

请求：

```json
{
  "project_id": 1,
  "session_id": 1,
  "answer": "I grew up in Shandong. When I was about seventeen, I left home for Shanghai for the first time."
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
  "next_question": "What was that first day in Shanghai like?",
  "extracted_memories": [
    {
      "memory_type": "event",
      "title": "Leaving home for Shanghai",
      "content": "Left home for Shanghai for the first time around age seventeen.",
      "life_stage": "early_adulthood",
      "approx_year": null,
      "approx_age": 17,
      "location": "Shanghai",
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
      {
        "question": "...",
        "target_stage": "early_adulthood",
        "reason": "...",
        "score": 0.42
      }
    ]
  }
}
```

`extracted_memories` 中每个元素的字段含义：

| 字段 | 类型 | 说明 |
|------|------|------|
| `memory_type` | string | `person` / `event` / `place` / `date` / `value` / `emotion` / `relationship` |
| `title` | string | 记忆标题 |
| `content` | string | 记忆内容 |
| `life_stage` | string | 人生阶段（`childhood` / `education` / `early_adulthood` / `career` / `family` / `later_life` / `turning_point` / `values` / `historical_context` / `unknown`） |
| `approx_year` / `approx_age` | int \| null | 大致年份 / 年龄 |
| `location` | string \| null | 地点 |
| `people` / `tags` | string[] | 相关人物 / 标签 |
| `importance` | float | 重要度 0~1 |
| `emotional_intensity` | float | 情绪强度 0~1 |
| `confidence` | float | 置信度 0~1 |
| `unresolved_points` | string[] | 待澄清点 |

### POST /api/chapters

基于已收集的记忆生成一个传记章节。**此接口会调用 DeepSeek。**

请求：

```json
{
  "project_id": 1,
  "focus": "Write a short chapter about leaving home and entering adulthood."
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `project_id` | int | 是 | 项目 ID |
| `focus` | string | 否 | 章节主题/焦点 |

响应：

```json
{ "title": "Leaving Home", "body": "..." }
```

## 配置项说明

所有配置通过 `.env` 文件加载（见 [app/core/config.py](app/core/config.py)）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEEPSEEK_API_KEY` | 空 | DeepSeek API Key，必填 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek API 地址 |
| `DEEPSEEK_MODEL` | `deepseek-v4-pro` | 使用的模型名 |
| `DATABASE_URL` | `sqlite:///./shuyi.db` | SQLite 连接串 |

## 设计原则

模型不允许凭空捏造记忆：重要的记忆事实始终关联到它被抽取出来的那条原文（`source_utterance`）。规划器被刻意拆成两层：

1. **Python 中的确定性打分**（[app/services/planner.py](app/services/planner.py)）；
2. **LLM 生成最终问题的措辞**。

这样能在开发阶段保证产品可解释、易于调优。

## 后续建议

1. 用 5-10 次真实模拟访谈调优提示词。
2. 文本链路稳定后，接入语音转文字。
3. 需要账号或多设备使用时，将 SQLite 替换为 Supabase / PostgreSQL。
4. 增加音频存储与句子级来源引用。
5. 增加记忆确认 / 编辑界面。
6. 访谈足够长后，再按需引入向量检索。
