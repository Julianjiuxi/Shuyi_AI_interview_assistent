import { collections, people, type Person } from '@/lib/family-data';
import type {
  ArchivePersonCard,
  CollectionCard,
  FamilyArchiveViewModel,
  JourneyStop,
  MomentPost,
  PersonArchiveViewModel,
  SourcePill,
} from '@/lib/view-models/family-archive';
import type { ArchiveDataProvider } from './provider';

// Stable demo project ids so the mock provider speaks the same numeric
// `projectId` contract as the real ShuYi provider.
const PROJECT_IDS: Record<string, number> = {
  guowei: 1,
  meizhen: 2,
  lan: 3,
  leo: 4,
};

// Demo-only journey coordinates. These live here — not in the UI — because the
// backend has no equivalent yet.
const journeys: Record<string, JourneyStop[]> = {
  meizhen: [
    { city: 'Suzhou', chinese: '苏州', years: '1954–1973', kind: 'life', x: 34, y: 23, title: 'A courtyard scented with osmanthus', memory: 'Childhood began beside the canal. Every autumn, Meizhen helped her mother spread golden blossoms across bamboo trays.' },
    { city: 'Shanghai', chinese: '上海', years: '1973–today', kind: 'life', x: 58, y: 31, title: 'Work, family and the green tin', memory: 'At nineteen she arrived for textile work. The city became the setting for marriage, motherhood, ordinary routines and the memories she now keeps.' },
    { city: 'Shenzhen', chinese: '深圳', years: 'Family today', kind: 'family', x: 45, y: 69, title: 'A daughter caring from a distance', memory: 'Zhao Lan now works here. Their Sunday evening call has become a dependable bridge between two homes.' },
    { city: 'Singapore', chinese: '新加坡', years: 'Next generation', kind: 'family', x: 40, y: 91, title: 'The stories travel to Leo', memory: 'Her grandson studies here. Voice notes, photographs and the family letter allow everyday memories to cross another border.' },
  ],
  guowei: [
    { city: 'Shanghai', chinese: '上海', years: '1949–2018', kind: 'life', x: 58, y: 31, title: 'A life built through useful care', memory: 'Guowei grew up, worked and raised a family in Shanghai, expressing affection through repairs, preparation and reliable routines.' },
    { city: 'Suzhou', chinese: '苏州', years: '1984 journey', kind: 'life', x: 34, y: 23, title: 'The person who remained standing', memory: 'On the crowded journey to Suzhou, he stood beside Meizhen and their sleeping daughter for six hours.' },
  ],
  lan: [
    { city: 'Shanghai', chinese: '上海', years: '1981–', kind: 'life', x: 58, y: 31, title: 'The first family home', memory: 'Lan was born in Shanghai. Her hospital bracelet became the earliest dated object kept in her archive.' },
    { city: 'Nanjing', chinese: '南京', years: '1999', kind: 'life', x: 39, y: 32, title: 'University and the Wednesday call', memory: 'She studied library science and called home from the same public telephone each Wednesday.' },
    { city: 'Shenzhen', chinese: '深圳', years: '2019–today', kind: 'life', x: 45, y: 69, title: 'Care organised across distance', memory: 'A new job moved her south. Lists, parcels and fixed weekly calls became the practical shape of care.' },
    { city: 'Singapore', chinese: '新加坡', years: 'Leo today', kind: 'family', x: 40, y: 91, title: 'A son beginning his own archive', memory: 'Leo contributes sounds and photographs while discovering how his family has remembered him.' },
  ],
  leo: [
    { city: 'Shanghai', chinese: '上海', years: '2007', kind: 'life', x: 58, y: 31, title: 'Born into three generations', memory: 'His earliest page is held in other people’s memories: a hospital bracelet, a recipe notebook and six weeks with his grandmother.' },
    { city: 'Shenzhen', chinese: '深圳', years: 'Family home', kind: 'life', x: 45, y: 69, title: 'The everyday sounds of home', memory: 'Kitchen noise, reminders and overpacked fruit parcels form the background of the home he later learned to miss.' },
    { city: 'Singapore', chinese: '新加坡', years: '2025–today', kind: 'life', x: 40, y: 91, title: 'Listening from far away', memory: 'Away at university, Leo records rain, kitchens and station announcements, adding his own layer to the family archive.' },
  ],
};

const meizhenMoments: MomentPost[] = [
  { id: 'tin', author: 'Zhao Lan', relation: 'Daughter', time: 'Today · 08:30', text: 'Mum opened the green tin again during our Sunday call. I had seen it on the shelf all my life, but never knew why she kept the old train ticket.', likes: 12, comments: [{ author: 'Leo', text: 'Please keep the ticket out next time I call. I want to hear the whole journey from her.' }] },
  { id: 'courtyard', author: 'Leo Zhao', relation: 'Grandson', time: 'Yesterday · Singapore', text: 'The beginning of Grandma’s life film made Suzhou feel less like a place name. Now I can picture the courtyard, the bamboo trays and her running in with a basket.', image: '/generated/lin-meizhen-h3-film-poster.jpg', likes: 18, comments: [{ author: 'Zhao Lan', text: 'She still sneezes whenever the osmanthus is especially strong.' }] },
  { id: 'rain', author: 'Lin Meizhen', relation: 'Grandmother', time: '14 Apr · Shanghai', text: 'It rained tonight. I remembered how Guowei always brought the laundry in before the first heavy drops. Such a small thing, but the room still remembers it.', likes: 24, comments: [{ author: 'Zhao Lan', text: 'I remember the sound of the bamboo pole against the balcony rail.' }] },
];

const demoSources: SourcePill[] = [
  { icon: 'chat', text: '11 companion conversations' },
  { icon: 'voice', text: '7 voice notes' },
  { icon: 'image', text: '9 reviewed photographs' },
];

function yearsFor(person: Person): string {
  return person.years;
}

function adaptPerson(person: Person): PersonArchiveViewModel {
  const projectId = PROJECT_IDS[person.id] ?? 0;
  const film =
    person.id === 'meizhen'
      ? {
          src: '/generated/lin-meizhen-h3-dynamic-preview-62s.mp4',
          poster: '/generated/lin-meizhen-h3-film-poster.jpg',
          captions: '/generated/lin-meizhen-h3-dynamic-preview-en.vtt',
          duration: '01:02',
          chapters: '4 life moments',
          language: 'Mandarin · English captions',
          status: 'Ready to watch',
          heading: 'A life told in one minute.',
          description:
            'From a Suzhou courtyard to factory life in Shanghai, marriage and motherhood—Meizhen’s narrated portrait follows the green tin that carried her memories into the next generation.',
        }
      : {
          status: 'No film yet',
          heading: 'A life, remembered in motion.',
          description: `No life film has been added to ${person.name}’s family page yet. Their written story, timeline and family perspectives remain available above.`,
        };

  return {
    projectId,
    id: person.id,
    name: person.name,
    chinese: person.chinese,
    years: yearsFor(person),
    status: person.status,
    color: person.color,
    avatar: person.avatar,
    location: person.location,
    overview: person.overview,
    timeline: person.timeline,
    role: person.role,
    relation: person.relation,
    occupation: person.occupation,
    personality: person.personality,
    personalityNote: person.personalityNote,
    interests: person.interests,
    smallThings: person.smallThings,
    quote: person.quote,
    storyTitle: person.storyTitle,
    storyDeck: person.storyDeck,
    story: person.story,
    perspectives: person.perspectives,
    letterTo: person.letterTo,
    letter: person.letter,
    voice: person.voice,
    film,
    journey: journeys[person.id],
    moments: person.id === 'meizhen' ? meizhenMoments : undefined,
  };
}

function adaptCard(person: Person): ArchivePersonCard {
  return {
    id: person.id,
    projectId: PROJECT_IDS[person.id] ?? 0,
    name: person.name,
    chinese: person.chinese,
    years: person.years,
    status: person.status,
    color: person.color,
    avatar: person.avatar,
    role: person.role,
    relation: person.relation,
  };
}

const adaptedPeople = people.map(adaptPerson);
const cards = people.map(adaptCard);

export const mockProvider: ArchiveDataProvider = {
  async getFamily(): Promise<FamilyArchiveViewModel> {
    return {
      family: { id: 1, name: 'The Zhao · Lin family' },
      people: cards,
      selectedPerson: adaptedPeople.find((p) => p.id === 'meizhen') ?? adaptedPeople[0] ?? null,
      stats: { people: 4, memories: 27, recordings: 2 },
      collections: collections as CollectionCard[],
      sources: demoSources,
    };
  },

  async getPerson(projectId: number): Promise<PersonArchiveViewModel> {
    const person = adaptedPeople.find((p) => p.projectId === projectId) ?? adaptedPeople[0];
    if (!person) throw new Error(`No mock person for project ${projectId}`);
    return person;
  },
};
