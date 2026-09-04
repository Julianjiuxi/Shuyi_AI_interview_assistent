import FamilyArchive from './family-archive';
import { requireChatGPTUser } from './chatgpt-auth';
import { getArchiveProvider, getFamilyId } from '@/lib/data/provider';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await requireChatGPTUser('/');
  const family = await getArchiveProvider().getFamily(getFamilyId());
  return <FamilyArchive family={family} />;
}
