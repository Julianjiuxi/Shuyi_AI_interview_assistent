import type { FamilyArchiveViewModel, PersonArchiveViewModel } from '@/lib/view-models/family-archive';
import { mockProvider } from './mock-provider';
import { shuyiProvider } from './shuyi-provider';

export interface ArchiveDataProvider {
  /** Family tree + aggregate stats. `selectedPerson` is pre-loaded when possible. */
  getFamily(id: number): Promise<FamilyArchiveViewModel>;
  /** Full public archive for a single person (no raw transcript, no unreviewed memories). */
  getPerson(projectId: number): Promise<PersonArchiveViewModel>;
}

export type DataSource = 'mock' | 'api';

export function dataSource(): DataSource {
  return process.env.NEXT_PUBLIC_SHUYI_DATA_SOURCE === 'api' ? 'api' : 'mock';
}

export function getArchiveProvider(): ArchiveDataProvider {
  return dataSource() === 'api' ? shuyiProvider : mockProvider;
}

export function getFamilyId(): number {
  const raw = process.env.NEXT_PUBLIC_SHUYI_FAMILY_ID;
  const id = Number(raw ?? '1');
  return Number.isFinite(id) && id > 0 ? id : 1;
}
