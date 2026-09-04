import customPeople from '@/data/people.json';

export type TimelineItem = { year: string; place: string; title: string; copy: string };
export type Perspective = { speaker: string; relationship: string; source: string; text: string };

export type Person = {
  id: string;
  featured?: boolean;
  name: string;
  chinese: string;
  years: string;
  status: 'Living' | 'Remembered';
  role: string;
  relation: string;
  color: string;
  avatar?: string;
  location: string;
  occupation: string;
  personality: string;
  personalityNote: string;
  interests: string[];
  smallThings: string[];
  overview: string;
  timeline: TimelineItem[];
  quote: string;
  storyTitle: string;
  storyDeck: string;
  story: string[];
  perspectives: Perspective[];
  letterTo: string;
  letter: string[];
  film?: { src: string; poster?: string; captions?: string; duration: string; chapters: string; language: string; description: string };
  voice: { language: string; label: string; duration: string; note: string; src?: string; transcript?: string };
};

const basePeople: Person[] = [
  {
    id: 'guowei', name: 'Zhao Guowei', chinese: '赵国伟', years: '1949–2018', status: 'Remembered', role: 'Husband · Grandfather', relation: 'Spouse of Lin Meizhen', color: '#718078',
    location: 'Shanghai', occupation: 'Machine maintenance technician', personality: 'ISTJ — family impression', personalityNote: 'Not a clinical assessment. This label was suggested by family members to describe his practical, reserved way of caring.',
    interests: ['Repairing radios', 'Chinese chess', 'Early-morning markets', 'Train timetables'],
    smallThings: ['Kept spare screws in labeled matchboxes', 'Cut pears into eight equal pieces', 'Checked the balcony before every storm'],
    overview: 'Guowei worked for more than three decades maintaining textile machinery. He spoke little about affection, but expressed it through routines: sharpening kitchen knives, waiting at stations early and repairing objects the family assumed were beyond saving.',
    timeline: [
      { year: '1949', place: 'Shanghai', title: 'Born near Yangpu', copy: 'The second of four children, he learned basic repairs from an uncle who serviced bicycles.' },
      { year: '1976', place: 'Shanghai', title: 'Met Lin Meizhen', copy: 'They met through co-workers at a weekend film screening. Meizhen remembered that he returned a borrowed umbrella the next morning.' },
      { year: '1984', place: 'Shanghai → Suzhou', title: 'The six-hour journey', copy: 'On a crowded train to visit Meizhen’s mother, he stood beside the only seat while their daughter slept against Meizhen.' },
      { year: '2018', place: 'Shanghai', title: 'A quiet inheritance', copy: 'After his death, the family found drawers of carefully repaired household objects, each wrapped and dated.' },
    ],
    quote: 'If it can still serve someone, it is not finished.',
    storyTitle: 'The Person Who Remained Standing', storyDeck: 'A crowded train, one seat, and a form of love that never announced itself.',
    story: [
      'The train carriage was already full when Guowei, Meizhen and their three-year-old daughter boarded. It was late summer, and the windows had been pushed open, bringing in warm air, coal dust and the metallic rhythm of the tracks.',
      'Someone offered Meizhen one narrow seat. Their daughter climbed into her lap and fell asleep before the train had cleared Shanghai. Guowei placed the cloth bag beneath the seat, held the luggage rack with one hand and stood beside them. At every station, Meizhen expected him to take a newly emptied place. Each time, he quietly gestured toward someone older.',
      'For six hours he remained standing. He bought one cup of tea and passed it first to Meizhen. When their daughter woke, he made a small paper bird from the ticket sleeve. Nothing dramatic happened on that journey. That was precisely why Meizhen remembered it.',
      'Years later, on a rainy afternoon, she described the sound of Guowei bringing laundry in from the balcony. The memory led back to the train, the ticket kept in her green tin and the sentence now preserved in his archive: love is often simply the person who chooses to remain standing.',
    ],
    perspectives: [
      { speaker: 'Lin Meizhen', relationship: 'Wife', source: 'Companion conversation · 14 Apr 2026', text: 'He almost never said “I missed you.” He arrived early, carried the heavy bag and made sure you had somewhere to sit. That was his grammar.' },
      { speaker: 'Zhao Lan', relationship: 'Daughter', source: 'Family recording · 22 Apr 2026', text: 'My father could repair anything except a conversation about feelings. But when I came home late, the hallway light was always left on.' },
      { speaker: 'Leo Zhao', relationship: 'Grandson', source: 'Voice note · 03 May 2026', text: 'I remember his hands more than his face: broad fingertips, machine oil in the lines, and impossible patience with broken toys.' },
    ],
    letterTo: 'Leo', letter: ['Your grandfather believed that care should be useful. He repaired what was broken, arrived before anyone had to wait, and stood when another person needed the seat.', 'When you remember him, do not worry if you cannot recall every feature of his face. Remember the hallway light, the repaired radio and the way patience can become a form of love.', 'Carry that steadiness forward in your own way. You do not need to resemble him to inherit what was best in him.'],
    voice: { language: 'Shanghainese-accented Mandarin', label: 'His daughter’s reading', duration: '01:18', note: 'Guowei’s letter, read in Zhao Lan’s voice and kept with his family page.' },
  },
  {
    id: 'meizhen', featured: true, name: 'Lin Meizhen', chinese: '林美珍', years: '1954–', status: 'Living', role: 'Storyteller · Grandmother', relation: 'Spouse of Zhao Guowei', color: '#A54B3F', avatar: '/archive/meizhen/lin-meizhen-portrait.png',
    location: 'Suzhou · Shanghai', occupation: 'Retired textile quality inspector', personality: 'ISFJ — self-described', personalityNote: 'A conversational shorthand chosen by Meizhen after discussing her habits; it is not treated as a fixed or medical label.',
    interests: ['Growing jasmine', 'Suzhou pingtan', 'Mending clothes', 'Collecting train tickets'],
    smallThings: ['Drinks weak green tea after lunch', 'Calls her daughter every Sunday at 20:30', 'Stores buttons by colour in old medicine boxes'],
    overview: 'Meizhen lives alone in Shanghai. Since her husband’s death and her daughter’s move for work, evenings have often felt long. Several times a week, she spends time with an evening companion, talking about ordinary things—weather, meals and flowers. Those conversations have given her a place to be heard and brought long-kept family memories back into the light.',
    timeline: [
      { year: '1954', place: 'Suzhou', title: 'Born beside the canal', copy: 'She grew up in a courtyard home where her mother dried osmanthus blossoms every autumn.' },
      { year: '1973', place: 'Suzhou → Shanghai', title: 'The first journey alone', copy: 'At nineteen, she left for factory work carrying a green tea tin, two osmanthus cakes and several sewing needles.' },
      { year: '1981', place: 'Shanghai', title: 'Zhao Lan was born', copy: 'Meizhen returned to factory work after maternity leave and saved her daughter’s hospital bracelet in the tin.' },
      { year: '2026', place: 'Home', title: 'The conversations begin', copy: 'A question about the sound of rain led to Guowei, the balcony and a train ticket the family had never seen.' },
    ],
    quote: 'A home is not only where you return. It is the care you continue to carry.',
    storyTitle: 'The Osmanthus Tin', storyDeck: 'One ordinary container became an index of a life—and a reason to speak when the evenings felt too quiet.',
    story: [
      'On rainy evenings, Lin Meizhen’s apartment became especially quiet. Her daughter called every Sunday, and her grandson sent photographs when he remembered, but most weekdays passed without a conversation that lasted longer than buying vegetables downstairs.',
      'Her evening companion did not begin with dates or achievements. It simply asked what she could hear outside. Meizhen said that rain was striking the metal window ledge, and that her husband Guowei used to bring in the laundry before the first heavy drops. The memory of that small routine made her want to keep talking.',
      'Over several evenings, a green tea tin returned to the centre of her story. Meizhen’s mother had slipped it into her cloth bag in 1973, on the morning she left Suzhou for a textile factory in Shanghai. Inside were two osmanthus cakes, sewing needles and a folded note. Meizhen no longer remembers the exact month, and the date remains open in her record.',
      'The tin followed her through a crowded dormitory, marriage, motherhood and retirement. She added her first factory badge, a photograph of Guowei, Zhao Lan’s hospital bracelet and the ticket from a six-hour train journey. The objects had little monetary value. Together they recorded who waited, who stood, who returned and who made room for someone else.',
      'When the story had taken shape, Meizhen corrected two dates and chose to keep one passage private. What remained was not a perfect autobiography. It was something more truthful: a life remembered in the proportions that mattered to the person who lived it.',
    ],
    perspectives: [
      { speaker: 'Lin Meizhen', relationship: 'Self', source: 'Companion conversation · 14 Apr 2026', text: 'At first I only wanted something to answer when I spoke. Then I realised the small things I told it were making a path back to people I missed.' },
      { speaker: 'Zhao Lan', relationship: 'Daughter', source: 'Family review · 22 Apr 2026', text: 'My mother says she is forgetful, but she remembers the exact weight of every kindness. The archive helped me notice that.' },
      { speaker: 'Leo Zhao', relationship: 'Grandson', source: 'Voice note · 03 May 2026', text: 'I knew the tin was on her shelf. I did not know it contained our family’s whole way of loving one another.' },
    ],
    letterTo: 'Leo', letter: ['I once thought inheritance meant leaving you something valuable. Now I understand that it means helping you recognise the love hidden inside ordinary things.', 'The old ticket in my green tin is not important because of where the train went. I kept it because your mother slept on my shoulder, and your grandfather stood beside us for six hours when there was only one seat.', 'Wherever you go, remember that home is not only behind you. It is also in the care you choose to carry forward.'],
    film: {
      src: '/archive/meizhen/lin-meizhen-h3-dynamic-preview-62s.mp4',
      poster: '/archive/meizhen/lin-meizhen-h3-film-poster.jpg',
      captions: '/archive/meizhen/lin-meizhen-h3-dynamic-preview-en.vtt',
      duration: '01:02',
      chapters: '4 life moments',
      language: 'Mandarin · English captions',
      description: 'From a Suzhou courtyard to factory life in Shanghai, marriage and motherhood—Meizhen’s narrated portrait follows the green tin that carried her memories into the next generation.',
    },
    voice: {
      language: 'Mandarin · 普通话',
      label: 'Family letter · narrated reading',
      duration: '00:50',
      note: 'A warm Mandarin reading of Meizhen’s letter to Leo, kept beside the written version.',
      src: '/archive/meizhen/meizhen-family-letter-zh-a.mp3',
      transcript: '亲爱的乐安：我以前以为，传承是给你留下一件值钱的东西。后来我才明白，真正留下来的，是我们在普通日子里怎样照顾一个人。绿色铁盒里的旧车票，并不因为它去过哪里而重要。我留下它，是因为那趟车上，你妈妈睡在我肩上，你外公在只有一个座位的时候，在我们身边站了六个小时。他没有说什么，可我一直记得。无论你以后走到哪里，都要记住，家不只是在你身后。家也在你愿意为别人停下来、站一会儿、伸出手的那些时刻里。等你回来，我把铁盒打开给你看，我们一起喝茶。爱你的，外婆，美珍。',
    },
  },
  {
    id: 'lan', name: 'Zhao Lan', chinese: '赵岚', years: '1981–', status: 'Living', role: 'Daughter · Mother', relation: 'Daughter of Meizhen and Guowei', color: '#B08255',
    location: 'Shanghai · Shenzhen', occupation: 'Secondary-school librarian', personality: 'ENFJ — self-described', personalityNote: 'Recorded as a personal preference, not an objective psychological finding.',
    interests: ['Contemporary fiction', 'City walks', 'Recipe notebooks', 'Community volunteering'],
    smallThings: ['Photographs bookshop windows', 'Keeps every handwritten birthday card', 'Always packs more fruit than a journey requires'],
    overview: 'Lan moved to Shenzhen for work in 2019 and manages much of the family’s practical care from a distance. Her archive contains both her own memories and accounts recorded by her mother and son, making visible how competence, worry and affection can look different to different generations.',
    timeline: [
      { year: '1981', place: 'Shanghai', title: 'Born during a summer storm', copy: 'The hospital bracelet saved by Meizhen became the earliest dated object in Lan’s archive.' },
      { year: '1999', place: 'Nanjing', title: 'Left home for university', copy: 'She studied library science and called home from the same public telephone every Wednesday.' },
      { year: '2007', place: 'Shanghai', title: 'Leo was born', copy: 'She began a notebook of small observations rather than traditional milestone photographs.' },
      { year: '2019', place: 'Shenzhen', title: 'Care from a distance', copy: 'A new job separated her from Shanghai; weekly calls became the family’s fixed point.' },
    ],
    quote: 'Organisation is sometimes what worry looks like when it wants to be useful.', storyTitle: 'Sunday at Eight Thirty', storyDeck: 'A weekly phone call becomes the architecture holding three generations together.',
    story: [
      'Every Sunday at precisely eight thirty, Lan calls her mother. The habit began after she moved to Shenzhen and discovered that distance made ordinary reassurance unexpectedly difficult.',
      'Their conversations rarely sound important. They compare vegetable prices, discuss whether the jasmine needs more sun and negotiate the correct number of layers for the coming week. Underneath runs a second conversation: Are you eating? Are you lonely? Do you still feel connected to us?',
      'In Meizhen’s family archive, her remarks about Lan form a portrait different from Lan’s own: a child who once feared thunder, an adult who labels medicine boxes, and a mother who expresses anxiety as lists, parcels and calendar reminders.',
      'Leo adds another angle. To him, Lan is the person who sends excessive fruit before examinations and pretends not to wait for his reply. Together these accounts resist a single official biography. They show one person as daughter, mother, organiser and someone still learning how to ask for care herself.',
    ],
    perspectives: [
      { speaker: 'Lin Meizhen', relationship: 'Mother', source: 'Companion conversation · 26 Apr 2026', text: 'Lan thinks she hides her worry by making lists. I can hear it in how carefully she asks whether I bought vegetables.' },
      { speaker: 'Zhao Lan', relationship: 'Self', source: 'Written reflection · 29 Apr 2026', text: 'Moving away made me efficient about care, but efficiency is not the same as being present. I am still working out the difference.' },
      { speaker: 'Leo Zhao', relationship: 'Son', source: 'Voice note · 03 May 2026', text: 'My mother sends reminders that sound bossy and parcels that say what she actually means.' },
    ],
    letterTo: 'Leo', letter: ['You may remember me as the person who always asked whether you had packed a charger. I hope you also understood the question underneath: will you be all right when I cannot be beside you?', 'Your grandmother taught me that care lives in ordinary repetition. I turned that lesson into calendars and lists; you will turn it into something of your own.', 'Please do not inherit only my worry. Inherit the attention inside it, and leave enough room in your life to be surprised.'],
    voice: { language: 'Mandarin', label: 'Zhao Lan · family letter', duration: '01:09', note: 'Lan reads the letter kept for Leo in her family page.' },
  },
  {
    id: 'leo', name: 'Leo Zhao', chinese: '赵乐安', years: '2007–', status: 'Living', role: 'Grandson', relation: 'Son of Zhao Lan', color: '#5F7467',
    location: 'Shenzhen · Singapore', occupation: 'First-year interaction design student', personality: 'INFP — self-described', personalityNote: 'Included because Leo chose to describe himself this way; future entries may change it.',
    interests: ['Street photography', 'Indie games', 'Cooking noodles', 'Recording ambient sound'],
    smallThings: ['Names every folder by date', 'Photographs grandparents’ hands', 'Saves voice notes but rarely replays them'],
    overview: 'Leo is the youngest member of the archive and both a subject and contributor. His entries show that inheritance is not only retrospective: his grandmother’s descriptions of him preserve childhood details he would never record himself.',
    timeline: [
      { year: '2007', place: 'Shanghai', title: 'Born into three generations', copy: 'Meizhen stayed for six weeks and recorded his sleeping habits in Lan’s recipe notebook.' },
      { year: '2015', place: 'Shanghai', title: 'The broken radio summer', copy: 'Guowei helped him dismantle a radio and insisted every screw return to its labeled place.' },
      { year: '2025', place: 'Singapore', title: 'First year away', copy: 'Leo began collecting sound recordings of kitchens, stations and rain to counter homesickness.' },
      { year: '2026', place: 'Online', title: 'Becomes a contributor', copy: 'He adds voice notes and photographs while discovering stories already recorded about him.' },
    ],
    quote: 'Sometimes I record a place because I do not yet know how to miss it.', storyTitle: 'The Sound of a Kitchen Far Away', storyDeck: 'The youngest family member learns that he has already been remembered from several directions.',
    story: [
      'In his first month away from home, Leo began recording sounds: the elevator in his residence, rain under a covered walkway, water boiling in a shared kitchen. He told no one that the recordings helped him sleep.',
      'When he entered his family archive, he expected to find only stories about his grandparents. Instead, his own page contained a memory from Meizhen: at eight years old he had spent an entire afternoon sorting Guowei’s screws by size, then cried when one rolled beneath a cabinet.',
      'Lan remembered the same afternoon differently. She remembered irritation at the mess, followed by the unusual sight of her father kneeling on the floor with a torch, searching for one unimportant screw because it mattered to Leo.',
      'The archive did not decide which account was definitive. It placed them beside Leo’s own fragmentary memory—the smell of machine oil and the warm circle of the torch. In doing so, it showed him that a life is never stored by one person alone.',
    ],
    perspectives: [
      { speaker: 'Lin Meizhen', relationship: 'Grandmother', source: 'Companion conversation · 01 May 2026', text: 'He was a quiet child until something interested him. Then every question arrived at once, like rain on the window ledge.' },
      { speaker: 'Zhao Lan', relationship: 'Mother', source: 'Family recording · 02 May 2026', text: 'Leo notices atmosphere before facts. He will tell you how a room sounded and forget who won the argument.' },
      { speaker: 'Leo Zhao', relationship: 'Self', source: 'Voice note · 03 May 2026', text: 'I thought the archive was about preserving older people. Finding myself inside their memories changed that.' },
    ],
    letterTo: 'My family', letter: ['I used to think family history was a collection of things that happened before I arrived. Now I can see that I have always been inside it, held in details other people remembered for me.', 'I want to contribute not only polished stories but unfinished sounds: rain, kitchens, station announcements and the pauses before someone remembers a name.', 'If this archive lasts, let it show that I listened as well as inherited.'],
    voice: { language: 'English with Mandarin', label: 'Original voice · approved', duration: '00:54', note: 'Bilingual reading recorded by Leo; transcript available for accessibility.' },
  },
];

const additions = customPeople as Person[];
const hasCustomFeatured = additions.some((person) => person.featured);
export const people: Person[] = [
  ...basePeople
    .filter((base) => !additions.some((person) => person.id === base.id))
    .map((person) => hasCustomFeatured ? { ...person, featured: false } : person),
  ...additions,
];

export const collections = [
  { count: '27', title: 'Memories', copy: 'Small habits, remembered words and everyday moments gathered across three generations.' },
  { count: '4', title: 'Life stories', copy: 'Each person has a fuller portrait shaped by their own memories and their family’s view.' },
  { count: '4', title: 'Family letters', copy: 'Words of care written for the people who will carry the family forward.' },
  { count: '2', title: 'Recordings', copy: 'A narrated life film and a Mandarin reading of Meizhen’s letter to Leo.' },
];
