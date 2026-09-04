# Everroot × ShuYi 后端调整需求文档

**文档版本：**
 v1.0  
**适用项目：** ShuYi FastAPI 后端 + Everroot 家族记忆展示网页  
**目标读者：** 后端开发、AI 工作流开发、前端开发  
**基准日期：** 2026-09-03

---

## 1. 项目目标

ShuYi 当前已经完成“创建受访者项目—多轮访谈—记忆抽取—追问规划—传记章节生成”的基本闭环。Everroot 网页负责访谈完成后的展示层，包括：

1. 家庭与家谱展示；
2. 家庭成员档案；
3. 生平简介与人生时间线；
4. 整理后的故事、传记章节和家书；
5. 图片、音频和视频展示；
6. 内容确认、隐私范围及生成状态展示。

本次后端调整的核心目标是：**在不破坏 ShuYi 现有访谈接口的前提下，将单个“受访者项目”扩展为可以被 Everroot 消费的完整“家庭记忆档案”。**

---

## 2. 当前后端能力与主要缺口

### 2.1 已有接口

| 接口 | 当前作用 | 处理建议 |
|---|---|---|
| `GET /api/health` | 健康检查 | 保留并扩展依赖状态 |
| `POST /api/reset` | 清空数据库 | 仅开发环境保留 |
| `GET /api/projects` | 获取受访者项目列表 | 保留，增加分页和家庭字段 |
| `POST /api/projects` | 创建受访者和首个会话 | 保留，扩展人物资料 |
| `GET /api/projects/{id}` | 获取最新会话及对话 | 保留，补充项目状态 |
| `POST /api/projects/{id}/pin` | 切换置顶 | 保留 |
| `DELETE /api/projects/{id}` | 删除项目全部数据 | 保留，增加软删除建议 |
| `POST /api/interview/turn` | 记录回答、抽取记忆、生成追问 | 保留 |
| `POST /api/chapters` | 生成并保存一个传记章节 | 保留但调整返回结构 |

### 2.2 当前缺口

虽然数据库已经保存 `Memory` 和 `Chapter`，但没有对外提供读取、修改、确认和列表接口。因此 Everroot 当前无法：

- 获取已抽取的全部结构化记忆；
- 修改错误的时间、地点或人物；
- 将某条记忆标记为“已确认”；
- 获取已经生成并保存的章节；
- 生成并保存家书、生平摘要和媒体提示词；
- 获取家庭及家谱关系；
- 保存 MiniMax 图片、语音和视频任务；
- 查询生成任务进度；
- 一次性获取人物页面所需的完整档案。

---

## 3. 总体设计原则

### 3.1 兼容现有接口

- 不删除或重命名当前接口。
- 新字段尽量使用可选字段，避免旧前端失效。
- 新的聚合读取接口使用 `/archive`，避免把现有 `GET /projects/{id}` 变得过重。

### 3.2 事实与生成内容分离

后端必须区分：

- 原始访谈内容 `utterance`；
- AI 抽取记忆 `memory`；
- 用户确认事实 `confirmed memory`；
- AI 整理文稿 `document`；
- AI 生成媒体 `media asset`。

不得用润色后的文稿覆盖原始访谈和结构化记忆。

### 3.3 API Key 安全

- `DEEPSEEK_API_KEY` 与 `MINIMAX_API_KEY` 只能存在于后端环境变量。
- 前端不得直接调用 DeepSeek 或 MiniMax。
- 后端向前端返回任务状态和最终资源 URL，不返回第三方密钥。

### 3.4 生成任务异步化

图片、语音和视频生成采用异步任务：

```text
queued → processing → succeeded
                    ↘ failed
                    ↘ cancelled
```

创建任务接口应立即返回 `job_id`；前端通过状态接口轮询，视频建议每 10 秒查询一次。

---

## 4. 推荐领域模型

### 4.1 Family：家庭

新增 `families` 表：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `id` | int | 是 | 主键 |
| `name` | varchar(160) | 是 | 家庭显示名称，如 Zhao–Lin Family |
| `slug` | varchar(160) | 是 | URL 可用唯一标识 |
| `description` | text | 否 | 家庭简介 |
| `cover_asset_id` | int | 否 | 封面媒体 |
| `visibility` | enum | 是 | `private/family/public` |
| `created_at` | datetime | 是 | 创建时间 |
| `updated_at` | datetime | 是 | 更新时间 |

### 4.2 Person：家庭成员

建议将现有 `BiographyProject` 继续作为人物访谈项目使用，并增加字段；不必立即重构表名。

新增字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `family_id` | int FK | 否 | 所属家庭 |
| `display_name` | varchar(120) | 否 | 英文或页面显示名 |
| `chinese_name` | varchar(120) | 否 | 中文名 |
| `gender` | varchar(40) | 否 | 可空，不强制二元 |
| `birth_year` | int | 否 | 出生年份 |
| `death_year` | int | 否 | 去世年份 |
| `birth_place` | varchar(200) | 否 | 出生地 |
| `current_place` | varchar(200) | 否 | 当前所在地 |
| `short_bio` | text | 否 | 经确认的短简介 |
| `avatar_asset_id` | int | 否 | 头像资源 |
| `archive_status` | enum | 是 | `draft/review/approved/published` |
| `visibility` | enum | 是 | `private/family/public` |
| `updated_at` | datetime | 是 | 更新时间 |

`subject_name` 继续保留，用于兼容 ShuYi 现有代码。

### 4.3 Relationship：家谱关系

新增 `relationships` 表：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int | 主键 |
| `family_id` | int FK | 家庭 ID |
| `from_project_id` | int FK | 起点人物 |
| `to_project_id` | int FK | 终点人物 |
| `relation_type` | enum | `parent/child/spouse/sibling/grandparent/grandchild/other` |
| `label` | varchar(80) | 自定义关系显示文字 |
| `confirmed` | bool | 是否已确认 |
| `created_at` | datetime | 创建时间 |

约束：同一家庭中相同的 `from + to + relation_type` 必须唯一。

### 4.4 Memory：结构化记忆

现有 `memories` 表保留，建议新增：

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | enum | `extracted/review/confirmed/rejected` |
| `review_note` | text | 家属或本人修订说明 |
| `updated_at` | datetime | 修改时间 |
| `confirmed_at` | datetime | 确认时间 |
| `confirmed_by` | varchar(120) | 确认人；无账户系统时可先存名字 |

原有 `confirmed` 布尔字段可保留兼容；后续以 `status` 为准。

### 4.5 Document：整理后的文稿

建议用统一的 `documents` 表替代继续增加多种专用表。现有 `chapters` 可以迁移或暂时双写。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int | 主键 |
| `project_id` | int FK | 人物项目 |
| `document_type` | enum | `biography/chapter/family_letter/summary/narration/storyboard` |
| `title` | varchar(200) | 标题 |
| `body` | text | 文稿正文 |
| `language` | varchar(16) | `zh-CN/en` 等 |
| `status` | enum | `draft/review/approved/published` |
| `source_memory_ids_json` | text/json | 来源记忆 ID |
| `model_provider` | varchar(60) | 如 `deepseek` |
| `model_name` | varchar(100) | 如 `deepseek-v4-pro` |
| `prompt_version` | varchar(40) | 提示词版本 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

### 4.6 MediaJob：媒体生成任务

新增 `media_jobs` 表：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int | 内部主键 |
| `project_id` | int FK | 人物项目 |
| `document_id` | int FK | 可选，来源文稿 |
| `media_type` | enum | `image/audio/video` |
| `provider` | varchar(40) | `minimax` |
| `model_name` | varchar(100) | `image-01/MiniMax-H3/speech-2.8-hd` |
| `provider_task_id` | varchar(200) | MiniMax 任务 ID |
| `status` | enum | `queued/processing/succeeded/failed/cancelled` |
| `prompt` | text | 生成提示词 |
| `request_json` | text/json | 去除密钥后的请求参数 |
| `error_code` | varchar(100) | 错误码 |
| `error_message` | text | 错误说明 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

### 4.7 MediaAsset：最终媒体资源

新增 `media_assets` 表：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int | 主键 |
| `project_id` | int FK | 人物项目 |
| `job_id` | int FK | 来源任务 |
| `asset_type` | enum | `avatar/image/audio/video/thumbnail` |
| `title` | varchar(200) | 页面显示标题 |
| `caption` | text | 图片或视频说明 |
| `url` | varchar(1000) | 可访问资源 URL |
| `storage_key` | varchar(500) | 自有存储位置 |
| `mime_type` | varchar(100) | MIME 类型 |
| `duration_seconds` | float | 音视频时长 |
| `width` | int | 图片/视频宽度 |
| `height` | int | 图片/视频高度 |
| `sort_order` | int | 页面顺序 |
| `visibility` | enum | `private/family/public` |
| `approved` | bool | 是否确认可展示 |
| `created_at` | datetime | 创建时间 |

**重要：** MiniMax 返回的临时下载链接必须由后端下载并转存到自有存储，不能把临时链接长期写进页面。

---

## 5. API 通用规范

### 5.1 基础路径

继续使用：

```text
/api
```

如后期准备公开或长期维护，建议升级为 `/api/v1`，本次 MVP 可暂不改。

### 5.2 日期格式

所有时间统一使用 ISO 8601 UTC：

```json
"2026-09-03T08:30:00Z"
```

### 5.3 错误格式

统一返回：

```json
{
  "error": {
    "code": "MEMORY_NOT_FOUND",
    "message": "Memory not found",
    "details": null,
    "request_id": "req_abc123"
  }
}
```

建议状态码：

- `400` 参数或状态不允许；
- `404` 资源不存在；
- `409` 重复关系或任务冲突；
- `422` Pydantic 校验失败；
- `429` 第三方或本服务限流；
- `502` DeepSeek/MiniMax 上游失败；
- `503` 上游暂时不可用。

### 5.4 分页

列表接口统一支持：

```text
?limit=20&cursor=opaque_cursor
```

响应：

```json
{
  "items": [],
  "next_cursor": null
}
```

### 5.5 幂等性

生成类 POST 接口支持：

```http
Idempotency-Key: client-generated-uuid
```

相同键不得重复扣费或创建相同任务。

---

## 6. 家庭与家谱接口

### 6.1 创建家庭

```http
POST /api/families
```

请求：

```json
{
  "name": "Zhao–Lin Family",
  "description": "Three generations of family memories",
  "visibility": "private"
}
```

响应 `201`：

```json
{
  "id": 1,
  "name": "Zhao–Lin Family",
  "slug": "zhao-lin-family",
  "description": "Three generations of family memories",
  "visibility": "private",
  "created_at": "2026-09-03T08:30:00Z"
}
```

### 6.2 获取家庭列表

```http
GET /api/families?limit=20&cursor=
```

返回家庭摘要、成员数量、封面和更新时间。

### 6.3 获取家庭详情

```http
GET /api/families/{family_id}
```

### 6.4 修改家庭

```http
PATCH /api/families/{family_id}
```

允许修改 `name/description/visibility/cover_asset_id`。

### 6.5 获取家谱

```http
GET /api/families/{family_id}/tree
```

响应：

```json
{
  "family": { "id": 1, "name": "Zhao–Lin Family" },
  "people": [
    {
      "project_id": 1,
      "display_name": "Lin Meizhen",
      "chinese_name": "林美珍",
      "birth_year": 1954,
      "death_year": null,
      "avatar_url": null,
      "archive_status": "published"
    }
  ],
  "relationships": [
    {
      "id": 1,
      "from_project_id": 1,
      "to_project_id": 2,
      "relation_type": "parent",
      "label": "mother",
      "confirmed": true
    }
  ]
}
```

### 6.6 新增家谱关系

```http
POST /api/families/{family_id}/relationships
```

请求：

```json
{
  "from_project_id": 1,
  "to_project_id": 2,
  "relation_type": "parent",
  "label": "mother",
  "confirmed": true
}
```

### 6.7 修改与删除关系

```http
PATCH  /api/relationships/{relationship_id}
DELETE /api/relationships/{relationship_id}
```

后端需验证两个成员属于同一家庭。

---

## 7. 人物项目接口调整

### 7.1 调整创建项目接口

保留：

```http
POST /api/projects
```

扩展请求：

```json
{
  "subject_name": "林美珍",
  "family_id": 1,
  "display_name": "Lin Meizhen",
  "chinese_name": "林美珍",
  "birth_year": 1954,
  "birth_place": "Suzhou",
  "visibility": "family"
}
```

新增字段均可选，以兼容旧调用。

### 7.2 修改人物资料

```http
PATCH /api/projects/{project_id}
```

只更新请求中出现的字段。响应返回更新后人物摘要。

### 7.3 项目列表增强

```http
GET /api/projects?family_id=1&status=published&limit=20
```

每项新增：`family_id/display_name/chinese_name/birth_year/death_year/avatar_url/archive_status/updated_at`。

### 7.4 项目详情增强

现有：

```http
GET /api/projects/{project_id}
```

保持 `messages` 字段，新增 `profile` 与 `archive_status`，但不要在此接口塞入所有记忆和媒体。

### 7.5 发布状态修改

```http
PATCH /api/projects/{project_id}/archive-status
```

请求：

```json
{ "status": "approved" }
```

状态只能按以下方向推进，管理员可回退：

```text
draft → review → approved → published
```

存在未确认的高重要度记忆时，`approved/published` 应返回 `409` 和待确认记忆 ID。

---

## 8. 访谈与会话接口补充

### 8.1 获取全部会话

```http
GET /api/projects/{project_id}/sessions
```

### 8.2 获取指定会话对话

```http
GET /api/sessions/{session_id}/messages
```

消息需返回：

```json
{
  "id": 101,
  "role": "storyteller",
  "text": "……",
  "audio_url": null,
  "created_at": "2026-09-03T08:30:00Z"
}
```

### 8.3 结束访谈

```http
POST /api/sessions/{session_id}/complete
```

作用：

1. 写入 `ended_at`；
2. 生成 `session_summary`；
3. 将尚未整理的记忆置为 `review`；
4. 可选触发档案处理任务。

响应：

```json
{
  "session_id": 1,
  "status": "completed",
  "memory_count": 14,
  "unresolved_count": 3
}
```

---

## 9. 结构化记忆接口

### 9.1 获取记忆列表

```http
GET /api/projects/{project_id}/memories
```

查询参数：

- `life_stage`；
- `memory_type`；
- `status`；
- `min_importance`；
- `sort=chronological|importance|created_at`。

每条记忆必须额外返回：

```json
{
  "id": 18,
  "source_utterance_id": 66,
  "memory_type": "event",
  "title": "离乡赴沪",
  "content": "十九岁时第一次离开苏州前往上海。",
  "life_stage": "early_adulthood",
  "approx_year": 1973,
  "approx_age": 19,
  "location": "Shanghai",
  "people": ["母亲"],
  "tags": ["departure", "family"],
  "importance": 0.92,
  "emotional_intensity": 0.78,
  "confidence": 0.91,
  "unresolved_points": [],
  "status": "confirmed",
  "source_excerpt": "十九岁那年，我第一次离开苏州……",
  "created_at": "2026-09-03T08:30:00Z",
  "updated_at": "2026-09-03T08:35:00Z"
}
```

### 9.2 获取单条记忆

```http
GET /api/memories/{memory_id}
```

必须附带 `source_excerpt`，方便前端展示证据来源。

### 9.3 修改记忆

```http
PATCH /api/memories/{memory_id}
```

可修改：标题、内容、年份、年龄、地点、人物、标签、待澄清点、重要度和情绪强度。每次修改保留更新时间。

### 9.4 确认记忆

```http
POST /api/memories/{memory_id}/confirm
```

请求：

```json
{
  "confirmed_by": "Lin Meizhen",
  "review_note": "年份确认是 1973 年"
}
```

### 9.5 驳回记忆

```http
POST /api/memories/{memory_id}/reject
```

驳回不物理删除，以便审计和重新抽取。

### 9.6 批量确认

```http
POST /api/projects/{project_id}/memories/bulk-review
```

请求包含 `confirm_ids/reject_ids`，用于审核页面一次提交。

---

## 10. 文稿与 DeepSeek 接口

### 10.1 调整现有章节生成接口

保留：

```http
POST /api/chapters
```

建议响应从：

```json
{ "title": "离乡", "body": "……" }
```

扩展为：

```json
{
  "id": 7,
  "project_id": 1,
  "document_type": "chapter",
  "title": "离乡",
  "body": "……",
  "language": "zh-CN",
  "status": "draft",
  "source_memory_ids": [18, 21, 25],
  "created_at": "2026-09-03T08:30:00Z"
}
```

### 10.2 统一生成档案文稿

```http
POST /api/projects/{project_id}/documents/generate
```

请求：

```json
{
  "document_types": ["summary", "biography", "family_letter", "narration", "storyboard"],
  "language": "en",
  "tone": "warm, restrained, faithful",
  "focus": "The osmanthus tin and the first journey to Shanghai",
  "only_confirmed_memories": true
}
```

处理规则：

1. 默认只允许使用 `confirmed` 记忆；
2. 未确认内容若被允许使用，必须在结果元数据中标记；
3. 保留原话，不能生成受访者从未表达的关键事实；
4. DeepSeek 使用 `deepseek-v4-pro`；
5. 使用 JSON 输出；
6. 保存模型名和提示词版本；
7. 返回异步 `job_id`，或在耗时稳定时同步返回文稿。

### 10.3 文稿列表

```http
GET /api/projects/{project_id}/documents?type=family_letter&status=approved
```

### 10.4 获取、编辑、删除文稿

```http
GET    /api/documents/{document_id}
PATCH  /api/documents/{document_id}
DELETE /api/documents/{document_id}
```

删除建议使用软删除。

### 10.5 确认文稿

```http
POST /api/documents/{document_id}/approve
```

确认后才能作为 MiniMax 媒体生成输入。

### 10.6 推荐 DeepSeek 输出结构

```json
{
  "person_profile": {
    "display_name": "Lin Meizhen",
    "short_bio": "..."
  },
  "timeline": [],
  "biography": { "title": "...", "body": "..." },
  "family_letter": { "title": "...", "body": "..." },
  "preserved_quotes": [
    { "text": "...", "source_utterance_id": 66 }
  ],
  "uncertain_facts": [],
  "image_prompts": [],
  "video_storyboard": [],
  "narration_script": "..."
}
```

---

## 11. MiniMax 图片、语音与视频接口

### 11.1 创建图片任务

```http
POST /api/projects/{project_id}/media/images
```

请求：

```json
{
  "document_id": 7,
  "model": "image-01",
  "prompt": "Warm restrained new-Chinese editorial scene...",
  "aspect_ratio": "16:9",
  "reference_asset_ids": [],
  "count": 1
}
```

响应 `202`：

```json
{
  "job_id": 101,
  "media_type": "image",
  "status": "queued",
  "created_at": "2026-09-03T08:30:00Z"
}
```

### 11.2 创建语音任务

```http
POST /api/projects/{project_id}/media/audio
```

请求：

```json
{
  "document_id": 9,
  "model": "speech-2.8-hd",
  "voice_id": "system_voice_id",
  "text": "Narration text...",
  "language": "en",
  "speed": 0.95,
  "format": "mp3"
}
```

必须记录语音是否为 AI 合成；使用克隆音色时增加：

```json
{
  "voice_clone_consent": true,
  "consent_record_id": 12
}
```

### 11.3 创建视频任务

```http
POST /api/projects/{project_id}/media/videos
```

请求：

```json
{
  "document_id": 10,
  "model": "MiniMax-H3",
  "mode": "image-to-video",
  "prompt": "A slow restrained camera movement...",
  "first_frame_asset_id": 31,
  "last_frame_asset_id": null,
  "duration_seconds": 6,
  "resolution": "768P",
  "ratio": "adaptive"
}
```

规则：

- 首版只开放 5–8 秒单镜头；
- 输入图片必须已审核；
- 创建前校验预估费用；
- 保存 MiniMax `task_id`；
- 后台任务每约 10 秒查询一次状态；
- 成功后立即下载并转存。

### 11.4 获取任务状态

```http
GET /api/media/jobs/{job_id}
```

响应：

```json
{
  "job_id": 101,
  "media_type": "video",
  "provider": "minimax",
  "model": "MiniMax-H3",
  "status": "processing",
  "progress": null,
  "asset": null,
  "error": null,
  "updated_at": "2026-09-03T08:31:00Z"
}
```

### 11.5 取消或重试任务

```http
POST /api/media/jobs/{job_id}/cancel
POST /api/media/jobs/{job_id}/retry
```

重试创建新任务并使用 `parent_job_id` 关联旧任务，防止覆盖历史。

### 11.6 获取人物媒体列表

```http
GET /api/projects/{project_id}/media?type=image&approved=true
```

### 11.7 更新媒体说明和顺序

```http
PATCH /api/media/assets/{asset_id}
```

允许修改 `title/caption/sort_order/visibility/approved`。

### 11.8 删除媒体

```http
DELETE /api/media/assets/{asset_id}
```

数据库删除与对象存储删除必须保持一致；失败时进入待清理队列。

---

## 12. Everroot 核心聚合接口

### 12.1 获取完整人物档案

这是本次改造最重要的接口：

```http
GET /api/projects/{project_id}/archive
```

查询参数：

```text
?language=en&include_transcript=false
```

推荐响应：

```json
{
  "project": {
    "id": 1,
    "family_id": 1,
    "subject_name": "林美珍",
    "display_name": "Lin Meizhen",
    "chinese_name": "林美珍",
    "birth_year": 1954,
    "death_year": null,
    "birth_place": "Suzhou",
    "current_place": "Shanghai",
    "short_bio": "...",
    "avatar_url": null,
    "archive_status": "published",
    "visibility": "family"
  },
  "family": {
    "id": 1,
    "name": "Zhao–Lin Family"
  },
  "relationships": [],
  "timeline": [
    {
      "memory_id": 18,
      "year": 1973,
      "place": "Shanghai",
      "title": "The first journey alone",
      "detail": "...",
      "confidence": 0.91,
      "confirmed": true
    }
  ],
  "featured_story": {
    "document_id": 7,
    "title": "The Osmanthus Tin",
    "body": "..."
  },
  "family_letter": {
    "document_id": 8,
    "title": "Dear Leo",
    "body": "..."
  },
  "preserved_quotes": [],
  "media": {
    "avatar": null,
    "images": [],
    "audio": [],
    "videos": []
  },
  "review": {
    "unconfirmed_memory_count": 0,
    "unresolved_points": []
  },
  "updated_at": "2026-09-03T08:30:00Z"
}
```

### 12.2 该接口的组装规则

1. 人物资料来自 `BiographyProject`；
2. 时间线来自已确认、含时间信息的记忆；
3. Featured Story 优先选择已发布的 `biography/chapter`；
4. 家书选择最新已发布 `family_letter`；
5. 媒体只返回 `approved=true` 且访问权限允许的资源；
6. 默认不返回原始对话，避免响应过大和隐私泄露；
7. 不允许前端从零散数据自行推断家属关系。

### 12.3 获取处理概览

```http
GET /api/projects/{project_id}/archive/status
```

用于前端展示：

```json
{
  "project_id": 1,
  "archive_status": "review",
  "interview": { "sessions": 1, "messages": 24, "completed": true },
  "memories": { "total": 16, "confirmed": 13, "unresolved": 3 },
  "documents": { "draft": 2, "approved": 1 },
  "media": { "queued": 0, "processing": 1, "approved": 4 },
  "next_action": "Review 3 unresolved memories"
}
```

---

## 13. 文件上传与存储

### 13.1 上传文件

```http
POST /api/files
Content-Type: multipart/form-data
```

用途：上传人物参考照片、声音样本和家族旧照片。

限制建议：

- 图片：JPG/PNG/WEBP，不超过 20 MB；
- 音频：MP3/WAV/M4A，不超过 50 MB；
- 视频：MP4，不超过 100 MB；
- 服务端校验真实 MIME，不只看扩展名；
- 文件名随机化；
- 私有文件使用签名 URL。

响应：

```json
{
  "file_id": 51,
  "asset_type": "image",
  "mime_type": "image/jpeg",
  "url": "signed-or-controlled-url",
  "created_at": "2026-09-03T08:30:00Z"
}
```

### 13.2 存储策略

MVP 可使用本地 `uploads/`，但部署版本建议使用对象存储。数据库只保存 `storage_key` 和受控 URL，不保存大型 Base64。

---

## 14. 隐私、审核与访问控制

即使 MVP 暂无账户系统，也必须在数据层保留以下字段：

- 家庭、人物、文稿、媒体的 `visibility`；
- 记忆与文稿的确认状态；
- 声音克隆同意记录；
- AI 生成标识；
- 原始访谈与公开内容分离。

最低规则：

1. 新项目默认 `private`；
2. 未审核文稿和媒体不得出现在公开档案接口；
3. 原始访谈默认不进入公开接口；
4. 真实人物声音克隆必须有明确同意；
5. 删除项目时提示将级联影响的会话、记忆、文稿和媒体；
6. 生产环境禁用 `/api/reset`，或仅管理员可用。

---

## 15. CORS 与部署要求

ShuYi 当前未配置 `CORSMiddleware`。如果 Everroot 和 ShuYi 不同域，必须配置允许的前端来源：

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://everroot-family-archive.example.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "Idempotency-Key"],
)
```

禁止生产环境使用 `allow_origins=["*"]` 搭配凭证。

推荐配置：

```text
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_INTERVIEW_MODEL=deepseek-v4-flash
MINIMAX_API_KEY=
MINIMAX_BASE_URL=https://api.minimax.io
DATABASE_URL=sqlite:///./shuyi.db
MEDIA_STORAGE_DIR=./uploads
PUBLIC_BASE_URL=http://127.0.0.1:8000
ALLOWED_ORIGINS=http://localhost:3000
ENABLE_DESTRUCTIVE_ENDPOINTS=false
```

---

## 16. 日志与可观测性

每次 AI 调用至少记录：

- `request_id`；
- `project_id`；
- provider 与 model；
- 开始/结束时间；
- 成功或失败；
- token 或媒体计费信息；
- 第三方任务 ID；
- 不包含密钥的错误详情。

不得在日志中完整打印：API Key、声音样本、私密原始访谈、完整第三方授权头。

增加管理查询：

```http
GET /api/projects/{project_id}/usage
```

响应提供 DeepSeek token、MiniMax 生成秒数、任务数量和粗略成本，便于控制课堂测试预算。

---

## 17. 测试验收标准

### 17.1 单元测试

- Pydantic Schema 枚举和范围校验；
- 家谱关系重复和跨家庭校验；
- 记忆状态流转；
- 文稿只使用允许的记忆；
- MiniMax 状态映射；
- 档案聚合选择最新已发布内容。

### 17.2 接口测试

至少覆盖：

1. 创建家庭和四个成员；
2. 创建人物关系并读取家谱；
3. 完成一次访谈；
4. 获取、修改和确认记忆；
5. 生成并确认传记和家书；
6. 创建图片、语音和视频任务；
7. 模拟任务成功与失败；
8. 获取 `/archive` 并验证页面需要的所有字段；
9. 未审核内容不会出现在发布档案；
10. 重复 Idempotency-Key 不会重复创建收费任务。

### 17.3 MVP 联调验收

前端仅通过以下三个入口即可完成展示：

```text
GET /api/families/{family_id}/tree
GET /api/projects/{project_id}/archive
GET /api/projects/{project_id}/archive/status
```

生成操作通过 Documents 与 Media Jobs 接口完成。任何页面都不应直接调用 DeepSeek 或 MiniMax。

---

## 18. 实施优先级

### P0：课堂 Demo 必须完成

1. `GET /api/projects/{id}/memories`；
2. `PATCH /api/memories/{id}`；
3. `POST /api/memories/{id}/confirm`；
4. `GET /api/projects/{id}/documents`；
5. 调整 `POST /api/chapters` 返回文稿 ID；
6. `GET /api/projects/{id}/archive`；
7. 人物基础字段扩展；
8. CORS 与环境变量；
9. 使用准备好的本地图片/视频 URL 返回媒体数据。

### P1：真实 API 生成闭环

1. 统一文稿生成接口；
2. `media_jobs` 与 `media_assets`；
3. MiniMax Image-01；
4. MiniMax Speech 2.8 HD；
5. MiniMax H3 异步任务；
6. 媒体转存；
7. 任务查询、失败和重试。

### P2：完整家族产品

1. Family 与 Relationship；
2. 家谱读取接口；
3. 文件上传；
4. 细粒度可见范围；
5. 用量和成本统计；
6. 账户、邀请与权限；
7. 审核历史与版本管理。

---

## 19. 建议后端目录调整

```text
app/
├── api/
│   ├── routes.py
│   ├── families.py
│   ├── memories.py
│   ├── documents.py
│   ├── media.py
│   └── archives.py
├── models/
│   ├── entities.py
│   └── schemas.py
├── services/
│   ├── interview_service.py
│   ├── biography_service.py
│   ├── archive_service.py
│   ├── document_service.py
│   ├── minimax_client.py
│   ├── media_job_service.py
│   └── storage_service.py
├── prompts/
│   ├── biography_writer.py
│   ├── family_letter_writer.py
│   └── media_storyboard.py
└── workers/
    └── media_worker.py
```

MVP 阶段可使用 FastAPI `BackgroundTasks`；如果进入真实用户或并发生成阶段，应切换到 Redis + Celery/RQ 等可靠任务队列。

---

## 20. 后端交付清单

后端提交联调版本时，应同时提供：

- 更新后的 OpenAPI `/docs`；
- 数据库迁移脚本；
- `.env.example`；
- Postman/Bruno/cURL 示例；
- 一套不消耗 API 余额的 Mock 模式；
- 一套林美珍示例数据；
- MiniMax 失败和超时模拟；
- 测试执行说明；
- 已知限制列表。

**最终联调目标：** Everroot 输入一个 `family_id` 即可加载家谱；点击成员后输入 `project_id` 即可加载其完整生平、时间线、家书、图片、音频、视频和审核状态。
