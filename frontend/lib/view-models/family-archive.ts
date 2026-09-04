/**
 * Everroot family-archive view models.
 *
 * These are the only shapes the UI is allowed to know. They are intentionally
 * a superset of what the ShuYi backend currently returns: fields that the
 * backend cannot yet provide are optional, and the UI hides a section when the
 * corresponding field is missing instead of inventing demo content.
 */

export type LifeStatus = 'Living' | 'Remembered';

export type TimelineItem = {
  year: string;
  place: string;
  title: string;
  copy: string;
};

export type Perspective = {
  speaker: string;
  relationship: string;
  source: string;
  text: string;
};

export type JourneyStop = {
  city: string;
  chinese: string;
  years: string;
  kind: 'life' | 'family';
  x: number;
  y: number;
  title: string;
  memory: string;
};

export type MomentPost = {
  id: string;
  author: string;
  relation: string;
  time: string;
  text: string;
  image?: string;
  likes: number;
  comments: { author: string; text: string }[];
};

export type RelationshipViewModel = {
  fromProjectId: number;
  toProjectId: number;
  relationType: string;
  label: string;
};

export type VoiceViewModel = {
  language: string;
  label: string;
  duration: string;
  note: string;
  src?: string;
  transcript?: string;
};

export type FilmViewModel = {
  src?: string;
  poster?: string;
  captions?: string;
  duration?: string;
  chapters?: string;
  language?: string;
  status?: string;
  heading?: string;
  description?: string;
};

export type ArchivePersonCard = {
  /** Stable UI key (demo string id or `String(projectId)` for the real backend). */
  id: string;
  /** Real ShuYi project id used to load the full person archive. */
  projectId: number;
  name: string;
  chinese: string;
  years: string;
  status: LifeStatus;
  color?: string;
  avatar?: string;
  role?: string;
  relation?: string;
};

export type PersonArchiveViewModel = {
  projectId: number;
  id: string;
  name: string;
  chinese: string;
  years: string;
  status: LifeStatus;
  color?: string;
  avatar?: string;

  // Backend-aligned fields.
  location?: string;
  overview?: string;
  timeline: TimelineItem[];
  relationships?: RelationshipViewModel[];
  media?: { images: string[]; audio: string[]; videos: string[] };
  unresolvedCount?: number;

  // Demo-only fields. Optional so the API provider can leave them empty.
  role?: string;
  relation?: string;
  occupation?: string;
  personality?: string;
  personalityNote?: string;
  interests?: string[];
  smallThings?: string[];
  quote?: string;
  storyTitle?: string;
  storyDeck?: string;
  story?: string[];
  perspectives?: Perspective[];
  letterTo?: string;
  letter?: string[];
  voice?: VoiceViewModel;
  film?: FilmViewModel;
  journey?: JourneyStop[];
  moments?: MomentPost[];
};

export type FamilyStats = {
  people: number;
  memories: number;
  recordings: number;
};

export type CollectionCard = {
  count: string;
  title: string;
  copy: string;
};

export type SourcePill = {
  icon: 'chat' | 'voice' | 'image';
  text: string;
};

export type FamilyArchiveViewModel = {
  family: { id: number; name: string };
  people: ArchivePersonCard[];
  selectedPerson: PersonArchiveViewModel | null;
  stats: FamilyStats;
  collections?: CollectionCard[];
  sources?: SourcePill[];
};
