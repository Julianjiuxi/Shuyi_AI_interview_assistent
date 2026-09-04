import {
  shuyiApi,
  type ShuYiArchive,
  type ShuYiMediaAsset,
  type ShuYiTreePerson,
} from '@/lib/api-contracts';
import type {
  ArchivePersonCard,
  FamilyArchiveViewModel,
  FilmViewModel,
  PersonArchiveViewModel,
  VoiceViewModel,
} from '@/lib/view-models/family-archive';
import type { ArchiveDataProvider } from './provider';

const ARCHIVE_LANGUAGE = process.env.NEXT_PUBLIC_SHUYI_ARCHIVE_LANGUAGE || 'zh-CN';

type ArchiveProject = {
  id: number;
  subject_name: string;
  display_name: string | null;
  chinese_name: string | null;
  birth_year: number | null;
  death_year: number | null;
  birth_place: string | null;
  current_place: string | null;
  short_bio: string | null;
  avatar_url: string | null;
};

function projectOf(archive: ShuYiArchive): ArchiveProject {
  return archive.project as unknown as ArchiveProject;
}

function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function toCard(person: ShuYiTreePerson): ArchivePersonCard {
  const birth = person.birth_year;
  const death = person.death_year;
  const years = birth != null ? (death != null ? `${birth}–${death}` : `${birth}–`) : '';
  return {
    id: String(person.project_id),
    projectId: person.project_id,
    name: person.display_name || person.subject_name,
    chinese: person.chinese_name ?? '',
    years,
    status: death != null ? 'Remembered' : 'Living',
    avatar: person.avatar_url ?? undefined,
  };
}

function toVoice(asset?: ShuYiMediaAsset): VoiceViewModel | undefined {
  if (!asset) return undefined;
  return {
    language: asset.caption || asset.title || 'Mandarin',
    label: asset.title || 'Family letter · narrated reading',
    duration: asset.duration_seconds != null ? formatDuration(asset.duration_seconds) : '—',
    note: asset.caption || '',
    src: asset.url,
  };
}

function toFilm(asset?: ShuYiMediaAsset): FilmViewModel | undefined {
  if (!asset) return undefined;
  return {
    src: asset.url,
    poster: asset.asset_type === 'thumbnail' ? asset.url : undefined,
    duration: asset.duration_seconds != null ? formatDuration(asset.duration_seconds) : undefined,
    status: 'Ready to watch',
    heading: 'A life, remembered in motion.',
  };
}

function toPerson(archive: ShuYiArchive): PersonArchiveViewModel {
  const project = projectOf(archive);
  const death = project.death_year;
  const birth = project.birth_year;
  const years = birth != null ? (death != null ? `${birth}–${death}` : `${birth}–`) : '';

  const story = archive.featured_story;
  const letter = archive.family_letter;
  const quote = archive.preserved_quotes?.[0];

  return {
    projectId: project.id,
    id: String(project.id),
    name: project.display_name || project.subject_name || 'Unnamed',
    chinese: project.chinese_name ?? '',
    years,
    status: death != null ? 'Remembered' : 'Living',
    avatar: archive.media.avatar ?? project.avatar_url ?? undefined,
    location: project.current_place ?? project.birth_place ?? undefined,
    overview: project.short_bio ?? undefined,
    timeline: archive.timeline.map((item) => ({
      year: item.year != null ? String(item.year) : '',
      place: item.place ?? '',
      title: item.title,
      copy: item.detail,
    })),
    relationships: archive.relationships.map((relationship) => ({
      fromProjectId: relationship.from_project_id,
      toProjectId: relationship.to_project_id,
      relationType: relationship.relation_type,
      label: relationship.label,
    })),
    media: {
      images: archive.media.images.map((asset) => asset.url),
      audio: archive.media.audio.map((asset) => asset.url),
      videos: archive.media.videos.map((asset) => asset.url),
    },
    unresolvedCount: archive.review?.unconfirmed_memory_count ?? 0,
    storyTitle: story?.title,
    story: story?.body ? splitParagraphs(story.body) : undefined,
    letterTo: undefined,
    letter: letter?.body ? splitParagraphs(letter.body) : undefined,
    voice: toVoice(archive.media.audio[0]),
    film: toFilm(archive.media.videos[0]),
    quote: quote ? String((quote as { text?: string }).text ?? '') || undefined : undefined,
  };
}

export const shuyiProvider: ArchiveDataProvider = {
  async getFamily(id: number): Promise<FamilyArchiveViewModel> {
    const tree = await shuyiApi.getFamilyTree(id);
    const people = tree.people.map(toCard);
    const first = tree.people[0];
    const selectedPerson = first
      ? toPerson(await shuyiApi.getArchive(first.project_id, { language: ARCHIVE_LANGUAGE }))
      : null;

    return {
      family: { id: tree.family.id, name: tree.family.name },
      people,
      selectedPerson,
      // Memories/recordings are not part of the public family-tree contract;
      // leaving them at 0 lets the UI avoid inventing aggregate counts.
      stats: { people: people.length, memories: 0, recordings: 0 },
    };
  },

  async getPerson(projectId: number): Promise<PersonArchiveViewModel> {
    const archive = await shuyiApi.getArchive(projectId, { language: ARCHIVE_LANGUAGE });
    return toPerson(archive);
  },
};
