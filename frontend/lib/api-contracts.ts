/**
 * ShuYi API adapter
 * Aligned with /Users/ryanho/Desktop/ShuYi 2/app/models/schemas.py (v0.2.0, 2026-09-03).
 * This file contains no key and makes no request until API mode is enabled.
 */

export type LifeStage =
  | 'childhood'
  | 'education'
  | 'early_adulthood'
  | 'career'
  | 'family'
  | 'later_life'
  | 'turning_point'
  | 'values'
  | 'historical_context'
  | 'unknown';

export type MemoryType = 'person' | 'event' | 'place' | 'date' | 'value' | 'emotion' | 'relationship';

export interface ShuYiProjectListItem {
  id: number;
  subject_name: string;
  pinned: boolean;
  created_at: string;
  family_id: number | null;
  display_name: string | null;
  chinese_name: string | null;
  birth_year: number | null;
  death_year: number | null;
  avatar_url: string | null;
  archive_status: ArchiveStatus;
  updated_at: string | null;
}

export interface ShuYiMessage {
  role: string;
  text: string;
}

export interface ShuYiProjectDetail {
  id: number;
  subject_name: string;
  pinned: boolean;
  session_id: number;
  messages: ShuYiMessage[];
  profile: PersonProfile | null;
  archive_status: ArchiveStatus;
}

export type Visibility = 'private' | 'family' | 'public';
export type ArchiveStatus = 'draft' | 'review' | 'approved' | 'published';
export type MemoryStatus = 'extracted' | 'review' | 'confirmed' | 'rejected';
export type DocumentType = 'biography' | 'chapter' | 'family_letter' | 'summary' | 'narration' | 'storyboard';
export type DocumentStatus = 'draft' | 'review' | 'approved' | 'published' | 'deleted';
export type RelationType = 'parent' | 'child' | 'spouse' | 'sibling' | 'grandparent' | 'grandchild' | 'other';
export type MediaJobStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

export interface PersonProfile {
  subject_name: string;
  display_name: string | null;
  chinese_name: string | null;
  gender: string | null;
  birth_year: number | null;
  death_year: number | null;
  birth_place: string | null;
  current_place: string | null;
  short_bio: string | null;
  visibility: Visibility;
}

export interface ShuYiExtractedMemory {
  id?: number;
  source_utterance_id?: number | null;
  memory_type: MemoryType;
  title: string;
  content: string;
  life_stage: LifeStage;
  approx_year: number | null;
  approx_age: number | null;
  location: string | null;
  people: string[];
  tags: string[];
  importance: number;
  emotional_intensity: number;
  confidence: number;
  unresolved_points: string[];
  status?: MemoryStatus;
  confirmed?: boolean;
  source_excerpt?: string | null;
  review_note?: string | null;
  confirmed_by?: string | null;
  created_at?: string;
  updated_at?: string | null;
}

export interface ShuYiInterviewTurnResponse {
  next_question: string;
  extracted_memories: ShuYiExtractedMemory[];
  planner_debug: Record<string, unknown>;
}

export interface ShuYiChapter {
  id: number;
  project_id: number;
  document_type: 'chapter';
  title: string;
  body: string;
  language: string;
  status: DocumentStatus;
  source_memory_ids: number[];
  created_at: string;
}

export interface ShuYiFamily {
  id: number;
  name: string;
  slug: string;
  description: string;
  visibility: Visibility;
  created_at: string;
  updated_at: string | null;
}

export interface ShuYiRelationship {
  id: number;
  from_project_id: number;
  to_project_id: number;
  relation_type: RelationType;
  label: string;
  confirmed: boolean;
}

export interface ShuYiTreePerson {
  project_id: number;
  display_name: string | null;
  chinese_name: string | null;
  subject_name: string;
  birth_year: number | null;
  death_year: number | null;
  avatar_url: string | null;
  archive_status: ArchiveStatus;
}

export interface ShuYiFamilyTree {
  family: { id: number; name: string };
  people: ShuYiTreePerson[];
  relationships: ShuYiRelationship[];
}

export interface ShuYiDocument {
  id: number;
  project_id: number;
  document_type: DocumentType;
  title: string;
  body: string;
  language: string;
  status: DocumentStatus;
  source_memory_ids: number[];
  model_provider: string;
  model_name: string;
  prompt_version: string;
  created_at: string;
  updated_at: string | null;
}

export interface ShuYiMediaAsset {
  id: number;
  project_id: number;
  job_id: number | null;
  asset_type: 'avatar' | 'image' | 'audio' | 'video' | 'thumbnail';
  title: string;
  caption: string;
  url: string;
  mime_type: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  visibility: Visibility;
  approved: boolean;
  created_at: string;
}

export interface ShuYiMediaJob {
  job_id: number;
  media_type: 'image' | 'audio' | 'video';
  provider: 'minimax';
  model: string;
  status: MediaJobStatus;
  progress: number | null;
  asset: ShuYiMediaAsset | null;
  error: { code: string | null; message: string | null } | null;
  updated_at: string | null;
}

export interface ShuYiArchive {
  project: Record<string, unknown> & { id: number; family_id: number | null; display_name: string | null; chinese_name: string | null; archive_status: ArchiveStatus };
  family: { id: number; name: string } | null;
  relationships: ShuYiRelationship[];
  timeline: Array<{ memory_id: number; year: number | null; place: string | null; title: string; detail: string; confidence: number; confirmed: boolean }>;
  featured_story: { document_id: number; title: string; body: string } | null;
  family_letter: { document_id: number; title: string; body: string } | null;
  preserved_quotes: Array<Record<string, unknown>>;
  media: { avatar: string | null; images: ShuYiMediaAsset[]; audio: ShuYiMediaAsset[]; videos: ShuYiMediaAsset[] };
  review: { unconfirmed_memory_count: number; unresolved_points: Array<{ memory_id: number; point: string }> };
  updated_at: string | null;
  transcript?: Array<{ id: number; role: string; text: string; created_at: string }>;
}

export interface ShuYiArchiveStatus {
  project_id: number;
  archive_status: ArchiveStatus;
  interview: { sessions: number; messages: number; completed: boolean };
  memories: { total: number; confirmed: number; unresolved: number };
  documents: { draft: number; approved: number };
  media: { queued: number; processing: number; approved: number };
  next_action: string;
}

interface CursorPage<T> { items: T[]; next_cursor: string | null }

export interface ShuYiImageJobInput { document_id?: number; model?: string; prompt: string; aspect_ratio?: string; reference_asset_ids?: number[]; count?: number }
export interface ShuYiAudioJobInput { document_id?: number; model?: string; voice_id: string; text: string; language?: string; speed?: number; format?: string; voice_clone_consent?: boolean; consent_record_id?: number }
export interface ShuYiVideoJobInput { document_id?: number; model?: string; mode?: string; prompt: string; first_frame_asset_id?: number; last_frame_asset_id?: number; duration_seconds?: number; resolution?: string; ratio?: string }

export interface EverrootArchive {
  projectId: number;
  sessionId: number;
  person: { displayName: string };
  transcript: ShuYiMessage[];
  chapter: ShuYiChapter | null;
  memories: ShuYiExtractedMemory[];
  media: { imageUrls: string[]; videoUrl: string | null };
}

const configuredBaseUrl = process.env.NEXT_PUBLIC_SHUYI_API_BASE_URL?.replace(/\/$/, '');

function baseUrl(): string {
  if (!configuredBaseUrl) throw new Error('ShuYi API is not connected in demo mode.');
  return configuredBaseUrl;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail || `ShuYi request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const shuyiApi = {
  health: () => request<{ status: 'ok' }>('/api/health'),
  listProjects: () => request<ShuYiProjectListItem[]>('/api/projects'),
  getProject: (projectId: number) => request<ShuYiProjectDetail>(`/api/projects/${projectId}`),
  getFamilyTree: (familyId: number) => request<ShuYiFamilyTree>(`/api/families/${familyId}/tree`),
  getArchive: (projectId: number, options?: { language?: string; includeTranscript?: boolean }) => {
    const params = new URLSearchParams({
      language: options?.language ?? 'en',
      include_transcript: String(options?.includeTranscript ?? false),
    });
    return request<ShuYiArchive>(`/api/projects/${projectId}/archive?${params}`);
  },
  getArchiveStatus: (projectId: number) => request<ShuYiArchiveStatus>(`/api/projects/${projectId}/archive/status`),
  listMemories: (projectId: number) => request<ShuYiExtractedMemory[]>(`/api/projects/${projectId}/memories?sort=chronological`),
  updateMemory: (memoryId: number, changes: Partial<ShuYiExtractedMemory>) => request<ShuYiExtractedMemory>(`/api/memories/${memoryId}`, { method: 'PATCH', body: JSON.stringify(changes) }),
  confirmMemory: (memoryId: number, confirmedBy = '', reviewNote = '') => request<ShuYiExtractedMemory>(`/api/memories/${memoryId}/confirm`, { method: 'POST', body: JSON.stringify({ confirmed_by: confirmedBy, review_note: reviewNote }) }),
  listDocuments: (projectId: number, type?: DocumentType, status?: DocumentStatus) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    return request<CursorPage<ShuYiDocument>>(`/api/projects/${projectId}/documents?${params}`);
  },
  generateDocuments: (projectId: number, input: { document_types: DocumentType[]; language?: string; tone?: string; focus?: string; only_confirmed_memories?: boolean }) => request<ShuYiDocument[]>(`/api/projects/${projectId}/documents/generate`, { method: 'POST', body: JSON.stringify(input) }),
  generateChapter: (projectId: number, focus: string) => request<ShuYiChapter>('/api/chapters', {
    method: 'POST', body: JSON.stringify({ project_id: projectId, focus }),
  }),
  listMedia: (projectId: number, type?: ShuYiMediaAsset['asset_type'], approved?: boolean) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (approved !== undefined) params.set('approved', String(approved));
    return request<ShuYiMediaAsset[]>(`/api/projects/${projectId}/media?${params}`);
  },
  getMediaJob: (jobId: number) => request<ShuYiMediaJob>(`/api/media/jobs/${jobId}`),
  createImageJob: (projectId: number, input: ShuYiImageJobInput, idempotencyKey: string) => request<{ job_id: number; media_type: 'image'; status: MediaJobStatus; created_at: string }>(`/api/projects/${projectId}/media/images`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(input) }),
  createAudioJob: (projectId: number, input: ShuYiAudioJobInput, idempotencyKey: string) => request<{ job_id: number; media_type: 'audio'; status: MediaJobStatus; created_at: string }>(`/api/projects/${projectId}/media/audio`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(input) }),
  createVideoJob: (projectId: number, input: ShuYiVideoJobInput, idempotencyKey: string) => request<{ job_id: number; media_type: 'video'; status: MediaJobStatus; created_at: string }>(`/api/projects/${projectId}/media/videos`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(input) }),
  cancelMediaJob: (jobId: number) => request<ShuYiMediaJob>(`/api/media/jobs/${jobId}/cancel`, { method: 'POST' }),
  retryMediaJob: (jobId: number) => request<ShuYiMediaJob>(`/api/media/jobs/${jobId}/retry`, { method: 'POST' }),
};

/** Converts ShuYi 2's aggregate archive contract into the current Everroot view model. */
export async function loadArchiveFromShuYi(projectId: number): Promise<EverrootArchive> {
  const [project, archive, memories] = await Promise.all([
    shuyiApi.getProject(projectId),
    shuyiApi.getArchive(projectId, { language: 'en' }),
    shuyiApi.listMemories(projectId),
  ]);
  return {
    projectId: project.id,
    sessionId: project.session_id,
    person: { displayName: project.subject_name },
    transcript: project.messages,
    chapter: archive.featured_story ? {
      id: archive.featured_story.document_id,
      project_id: project.id,
      document_type: 'chapter',
      title: archive.featured_story.title,
      body: archive.featured_story.body,
      language: 'en',
      status: 'published',
      source_memory_ids: [],
      created_at: archive.updated_at ?? new Date(0).toISOString(),
    } : null,
    memories,
    media: {
      imageUrls: archive.media.images.map((asset) => asset.url),
      videoUrl: archive.media.videos[0]?.url ?? null,
    },
  };
}
