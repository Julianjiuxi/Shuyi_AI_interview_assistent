from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

# ---- 枚举类型 ----
LifeStage = Literal[
    "childhood", "education", "early_adulthood", "career", "family",
    "later_life", "turning_point", "values", "historical_context", "unknown"
]

MemoryType = Literal["person", "event", "place", "date", "value", "emotion", "relationship"]

MemoryStatus = Literal["extracted", "review", "confirmed", "rejected"]

Visibility = Literal["private", "family", "public"]

ArchiveStatus = Literal["draft", "review", "approved", "published"]

DocumentType = Literal["biography", "chapter", "family_letter", "summary", "narration", "storyboard"]

DocumentStatus = Literal["draft", "review", "approved", "published", "deleted"]

RelationType = Literal["parent", "child", "spouse", "sibling", "grandparent", "grandchild", "other"]

MediaType = Literal["image", "audio", "video"]

MediaJobStatus = Literal["queued", "processing", "succeeded", "failed", "cancelled"]

AssetType = Literal["avatar", "image", "audio", "video", "thumbnail"]


# ---- 访谈相关（保留兼容） ----
class ExtractedMemory(BaseModel):
    memory_type: MemoryType
    title: str = ""
    content: str
    life_stage: LifeStage = "unknown"
    approx_year: Optional[int] = None
    approx_age: Optional[int] = None
    location: Optional[str] = None
    people: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    importance: float = Field(default=0.5, ge=0, le=1)
    emotional_intensity: float = Field(default=0.0, ge=0, le=1)
    confidence: float = Field(default=0.7, ge=0, le=1)
    unresolved_points: list[str] = Field(default_factory=list)


class ExtractionResult(BaseModel):
    memories: list[ExtractedMemory] = Field(default_factory=list)
    response_summary: str = ""


class ConversationState(BaseModel):
    current_focus: Optional[str] = None
    focus_stage: Optional[str] = None
    focus_memory_id: Optional[int] = None
    focus_strength: float = Field(default=0.0, ge=0, le=1)
    storyteller_lead: float = Field(default=0.0, ge=0, le=1)
    closure_signal: float = Field(default=0.0, ge=0, le=1)
    user_focus_lock: bool = False


ActType = Literal["reflect", "invite_continue", "deepen", "clarify", "bridge", "transition"]
DialogueForm = Literal["statement", "invitation", "question"]
TopicRelation = Literal["same", "adjacent", "new"]


class CandidateDialogueMove(BaseModel):
    utterance: str
    act_type: ActType
    form: DialogueForm
    topic_relation: TopicRelation
    target_stage: LifeStage = "unknown"
    target_memory_id: Optional[int] = None
    reason: str = ""
    focus_alignment: float = Field(default=0.0, ge=0, le=1)
    storyteller_alignment: float = Field(default=0.0, ge=0, le=1)
    conversational_naturalness: float = Field(default=0.0, ge=0, le=1)
    information_gain: float = Field(default=0.0, ge=0, le=1)
    emotional_value: float = Field(default=0.0, ge=0, le=1)
    narrative_value: float = Field(default=0.0, ge=0, le=1)
    novelty: float = Field(default=0.0, ge=0, le=1)
    sensitivity_risk: float = Field(default=0.0, ge=0, le=1)
    repetition_risk: float = Field(default=0.0, ge=0, le=1)


class PlannerLLMResult(BaseModel):
    conversation_state: ConversationState = Field(default_factory=ConversationState)
    candidates: list[CandidateDialogueMove] = Field(default_factory=list)


class InterviewTurnRequest(BaseModel):
    project_id: int
    session_id: int
    answer: str


class InterviewTurnResponse(BaseModel):
    next_question: str
    next_utterance: str = ""
    dialogue_act: str = ""
    conversation_state: Optional[dict] = None
    extracted_memories: list[ExtractedMemory]
    planner_debug: dict


# ---- 人物项目 ----
class CreateProjectRequest(BaseModel):
    subject_name: str = "Unknown"
    family_id: Optional[int] = None
    display_name: Optional[str] = None
    chinese_name: Optional[str] = None
    gender: Optional[str] = None
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    birth_place: Optional[str] = None
    current_place: Optional[str] = None
    visibility: Visibility = "private"


class CreateProjectResponse(BaseModel):
    project_id: int
    session_id: int
    first_question: str


class ProjectUpdate(BaseModel):
    subject_name: Optional[str] = None
    family_id: Optional[int] = None
    display_name: Optional[str] = None
    chinese_name: Optional[str] = None
    gender: Optional[str] = None
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    birth_place: Optional[str] = None
    current_place: Optional[str] = None
    short_bio: Optional[str] = None
    visibility: Optional[Visibility] = None


class ProjectListItem(BaseModel):
    id: int
    subject_name: str
    pinned: bool
    created_at: datetime
    family_id: Optional[int] = None
    display_name: Optional[str] = None
    chinese_name: Optional[str] = None
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    avatar_url: Optional[str] = None
    archive_status: str = "draft"
    updated_at: Optional[datetime] = None


class Message(BaseModel):
    role: str
    text: str


class PersonProfile(BaseModel):
    subject_name: str
    display_name: Optional[str] = None
    chinese_name: Optional[str] = None
    gender: Optional[str] = None
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    birth_place: Optional[str] = None
    current_place: Optional[str] = None
    short_bio: Optional[str] = None
    visibility: str = "private"


class ProjectDetail(BaseModel):
    id: int
    subject_name: str
    pinned: bool
    session_id: int
    messages: list[Message]
    profile: Optional[PersonProfile] = None
    archive_status: str = "draft"


class ArchiveStatusUpdate(BaseModel):
    status: ArchiveStatus


# ---- 家庭与家谱 ----
class FamilyCreate(BaseModel):
    name: str
    description: str = ""
    visibility: Visibility = "private"


class FamilyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[Visibility] = None
    cover_asset_id: Optional[int] = None


class FamilyOut(BaseModel):
    id: int
    name: str
    slug: str
    description: str
    visibility: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class FamilyListItem(BaseModel):
    id: int
    name: str
    slug: str
    description: str
    visibility: str
    member_count: int = 0
    cover_asset_id: Optional[int] = None
    updated_at: Optional[datetime] = None


class RelationshipCreate(BaseModel):
    from_project_id: int
    to_project_id: int
    relation_type: RelationType
    label: str = ""
    confirmed: bool = False


class RelationshipUpdate(BaseModel):
    relation_type: Optional[RelationType] = None
    label: Optional[str] = None
    confirmed: Optional[bool] = None


class RelationshipOut(BaseModel):
    id: int
    from_project_id: int
    to_project_id: int
    relation_type: str
    label: str
    confirmed: bool


class TreePerson(BaseModel):
    project_id: int
    display_name: Optional[str] = None
    chinese_name: Optional[str] = None
    subject_name: str
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    avatar_url: Optional[str] = None
    archive_status: str


class TreeOut(BaseModel):
    family: dict
    people: list[TreePerson]
    relationships: list[RelationshipOut]


# ---- 结构化记忆 ----
class MemoryOut(BaseModel):
    id: int
    source_utterance_id: Optional[int] = None
    memory_type: str
    title: str
    content: str
    life_stage: str
    approx_year: Optional[int] = None
    approx_age: Optional[int] = None
    location: Optional[str] = None
    people: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    importance: float
    emotional_intensity: float
    confidence: float
    unresolved_points: list[str] = Field(default_factory=list)
    status: str
    confirmed: bool = False
    source_excerpt: Optional[str] = None
    review_note: Optional[str] = None
    confirmed_by: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class MemoryUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    approx_year: Optional[int] = None
    approx_age: Optional[int] = None
    location: Optional[str] = None
    people: Optional[list[str]] = None
    tags: Optional[list[str]] = None
    unresolved_points: Optional[list[str]] = None
    importance: Optional[float] = Field(default=None, ge=0, le=1)
    emotional_intensity: Optional[float] = Field(default=None, ge=0, le=1)


class MemoryConfirm(BaseModel):
    confirmed_by: str = ""
    review_note: str = ""


class MemoryReject(BaseModel):
    review_note: str = ""


class BulkReview(BaseModel):
    confirm_ids: list[int] = Field(default_factory=list)
    reject_ids: list[int] = Field(default_factory=list)


# ---- 文稿 ----
class ChapterRequest(BaseModel):
    project_id: int
    focus: str = "Create a coherent chapter from the most important available memories."


class ChapterResponse(BaseModel):
    id: int
    project_id: int
    document_type: str = "chapter"
    title: str
    body: str
    language: str = "zh-CN"
    status: str = "draft"
    source_memory_ids: list[int] = Field(default_factory=list)
    created_at: datetime


class DocumentOut(BaseModel):
    id: int
    project_id: int
    document_type: str
    title: str
    body: str
    language: str
    status: str
    source_memory_ids: list[int] = Field(default_factory=list)
    model_provider: str = "deepseek"
    model_name: str = ""
    prompt_version: str = ""
    created_at: datetime
    updated_at: Optional[datetime] = None


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    language: Optional[str] = None
    status: Optional[DocumentStatus] = None


class DocumentGenerateRequest(BaseModel):
    document_types: list[DocumentType]
    language: str = "en"
    tone: str = "warm, restrained, faithful"
    focus: str = ""
    only_confirmed_memories: bool = True


class DocumentApprove(BaseModel):
    pass


# ---- 媒体 ----
class ImageJobCreate(BaseModel):
    document_id: Optional[int] = None
    model: str = "image-01"
    prompt: str
    aspect_ratio: str = "16:9"
    reference_asset_ids: list[int] = Field(default_factory=list)
    count: int = 1


class AudioJobCreate(BaseModel):
    document_id: Optional[int] = None
    model: str = "speech-2.8-hd"
    voice_id: str
    text: str
    language: str = "en"
    speed: float = 1.0
    format: str = "mp3"
    voice_clone_consent: bool = False
    consent_record_id: Optional[int] = None


class VideoJobCreate(BaseModel):
    document_id: Optional[int] = None
    model: str = "MiniMax-H3"
    mode: str = "image-to-video"
    prompt: str
    first_frame_asset_id: Optional[int] = None
    last_frame_asset_id: Optional[int] = None
    duration_seconds: int = 6
    resolution: str = "768P"
    ratio: str = "adaptive"


class MediaJobCreateResponse(BaseModel):
    job_id: int
    media_type: str
    status: str = "queued"
    created_at: datetime


class MediaJobOut(BaseModel):
    job_id: int
    media_type: str
    provider: str
    model: str
    status: str
    progress: Optional[float] = None
    asset: Optional[dict] = None
    error: Optional[dict] = None
    updated_at: Optional[datetime] = None


class MediaAssetOut(BaseModel):
    id: int
    project_id: int
    job_id: Optional[int] = None
    asset_type: str
    title: str
    caption: str
    url: str
    mime_type: str
    duration_seconds: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    sort_order: int
    visibility: str
    approved: bool
    created_at: datetime


class MediaAssetUpdate(BaseModel):
    title: Optional[str] = None
    caption: Optional[str] = None
    sort_order: Optional[int] = None
    visibility: Optional[Visibility] = None
    approved: Optional[bool] = None


# ---- 档案聚合 ----
class TimelineItem(BaseModel):
    memory_id: int
    year: Optional[int] = None
    place: Optional[str] = None
    title: str
    detail: str
    confidence: float
    confirmed: bool


class DocRef(BaseModel):
    document_id: int
    title: str
    body: str


# ---- 人生视图 ----
class PerspectiveOut(BaseModel):
    speaker: str
    relationship: str
    source: str
    text: str


class JourneyStopOut(BaseModel):
    city: str
    chinese: str
    years: str
    kind: Literal["life", "family"]
    x: int
    y: int
    title: str
    memory: str


class LifeViewOut(BaseModel):
    role: Optional[str] = None
    occupation: Optional[str] = None
    personality: Optional[str] = None
    personality_note: Optional[str] = None
    interests: list[str] = Field(default_factory=list)
    small_things: list[str] = Field(default_factory=list)
    quote: Optional[str] = None
    story_title: Optional[str] = None
    story_deck: Optional[str] = None
    perspectives: list[PerspectiveOut] = Field(default_factory=list)
    journey: list[JourneyStopOut] = Field(default_factory=list)
    is_draft: bool = False
    generated_at: Optional[datetime] = None


class LifeViewGenerateRequest(BaseModel):
    language: str = "zh-CN"
    only_confirmed_memories: bool = True


class ArchiveOut(BaseModel):
    project: dict
    family: Optional[dict] = None
    relationships: list[RelationshipOut] = Field(default_factory=list)
    timeline: list[TimelineItem] = Field(default_factory=list)
    featured_story: Optional[DocRef] = None
    family_letter: Optional[DocRef] = None
    preserved_quotes: list[dict] = Field(default_factory=list)
    media: dict = Field(default_factory=dict)
    review: dict = Field(default_factory=dict)
    life_view: Optional[LifeViewOut] = None
    updated_at: Optional[datetime] = None


class ArchiveStatusOut(BaseModel):
    project_id: int
    archive_status: str
    interview: dict
    memories: dict
    documents: dict
    media: dict
    next_action: str


class UsageOut(BaseModel):
    project_id: int
    deepseek: dict
    minimax: dict
    summary: str


# ---- 文件上传 ----
class FileUploadOut(BaseModel):
    file_id: int
    asset_type: str
    mime_type: str
    url: str
    created_at: datetime
