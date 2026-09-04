'use client';

import { useState } from 'react';
import { ArrowDown, BookOpen, CalendarDays, Check, ChevronRight, CircleUserRound, Film, Flower2, Headphones, Heart, HeartHandshake, Image as ImageIcon, LetterText, MapPin, MessageCircle, MessageCircleMore, Mic2, Navigation, Play, Plus, Quote, Send, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getArchiveProvider } from '@/lib/data/provider';
import type { ArchivePersonCard, CollectionCard, FamilyArchiveViewModel, FilmViewModel, MomentPost, PersonArchiveViewModel } from '@/lib/view-models/family-archive';

export default function FamilyArchive({ family }: { family: FamilyArchiveViewModel }) {
  const initial = family.selectedPerson;
  const [persons, setPersons] = useState<Record<string, PersonArchiveViewModel>>(
    initial ? { [initial.id]: initial } : {},
  );
  const [selected, setSelected] = useState(initial?.id ?? family.people[0]?.id ?? '');

  const active = persons[selected] ?? null;

  const selectPerson = async (id: string) => {
    setSelected(id);
    window.setTimeout(() => document.getElementById('profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    if (persons[id]) return;
    const card = family.people.find((person) => person.id === id);
    if (!card) return;
    try {
      const person = await getArchiveProvider().getPerson(card.projectId);
      setPersons((current) => ({ ...current, [id]: person }));
    } catch {
      // Keep the current selection; the detail will stay empty rather than fabricate data.
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <WelcomeCover />
      <header className="sticky top-0 z-40 border-b border-[#d9cebb]/75 bg-[#f8f3e8]/94 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 md:px-10">
          <a href="#welcome" className="flex items-center gap-3" aria-label="Everroot home"><span className="grid size-10 place-items-center rounded-full bg-[#a34f42] text-[#fffaf0]"><Flower2 size={20} strokeWidth={1.7} /></span><div><p className="font-serif text-xl font-semibold tracking-[.08em] text-[#392f28]">Everroot</p><p className="text-[10px] uppercase tracking-[.24em] text-[#8b7563]">Companionship becomes legacy</p></div></a>
          <nav className="hidden items-center gap-5 text-[13px] text-[#6f6256] lg:flex" aria-label="Main navigation"><a href="#family">Family</a><a href="#profile">Life</a><a href="#journey">Map</a><a href="#story">Story</a><a href="#film">Film</a><a href="#letter">Letter</a><a href="#voice">Voice</a><a href="#moments">Moments</a></nav>
          <span className="rounded-full border border-[#b8aa94] bg-white/40 px-3 py-1.5 text-xs text-[#796956]">Private family space</span>
        </div>
      </header>

      <FamilySection family={family} people={family.people} selected={selected} onSelect={selectPerson} />

      {active ? <ProfileSection person={active} /> : null}
      {active && active.journey?.length ? <LifeMap person={active} /> : null}
      {active && active.story?.length ? <StorySection person={active} /> : null}
      {active && active.film ? <FilmSection person={active} /> : null}
      {active && active.letter?.length ? <LetterSection person={active} /> : null}
      {active ? <VoiceSection person={active} collections={family.collections} /> : null}
      {active && (active.moments?.length || active.perspectives?.length) ? <FamilyMoments person={active} /> : null}

      <footer className="border-t border-[#cfc0aa] bg-[#f3ecde] py-10"><div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-6 text-center sm:flex-row sm:text-left"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#a34f42] text-white"><Flower2 size={17} /></span><div><p className="font-serif text-lg">Everroot</p><p className="text-[10px] uppercase tracking-[.2em] text-[#8d7967]">Companionship · Continuity</p></div></div><p className="text-xs leading-5 text-[#8a7766]">{family.family.name} archive<br />Private memories, shared with care.</p></div></footer>
    </main>
  );
}

function FamilySection({ family, people, selected, onSelect }: { family: FamilyArchiveViewModel; people: ArchivePersonCard[]; selected: string; onSelect: (id: string) => void }) {
  const { stats } = family;
  const memoriesLabel = stats.memories > 0 ? ` · ${stats.memories} memories` : '';
  return (
    <section id="family" className="paper-texture border-b border-[#d8cbb8] py-16 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[.72fr_1.28fr]">
        <div className="lg:sticky lg:top-28 lg:self-start"><p className="eyebrow"><Users size={14} /> {family.family.name}</p><h1 className="font-serif text-5xl leading-[1.06] tracking-[-.025em] text-[#332b25] md:text-6xl">One family.<br /><em className="font-normal text-[#9c4b40]">Many witnesses.</em></h1><p className="mt-6 max-w-md leading-7 text-[#726458]">Every person is remembered from more than one direction. Their own words sit beside the memories of parents, partners, children and grandchildren.</p><div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#d8c7ad] bg-[#fffaf0]/70 p-4 text-sm leading-6 text-[#67594e]"><HeartHandshake className="mt-1 shrink-0 text-[#9c4b40]" size={18} /><p><strong className="font-semibold text-[#44382f]">Always someone to talk to.</strong><br />Ordinary evenings become a place to feel heard, remember and stay close to family.</p></div></div>
        <div className="rounded-[32px] border border-[#d6c6ae] bg-[#fffaf0]/80 p-6 shadow-[0_24px_80px_rgba(92,66,42,.09)] md:p-10"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="font-serif text-2xl text-[#3d332b]">Three generations</p><p className="mt-1 text-xs tracking-wide text-[#8a796a]">Select a person to open their complete archive</p></div><span className="rounded-full bg-[#e7eee8] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-[#51655b]">{stats.people} profiles{memoriesLabel}</span></div><div className="tree-grid" aria-label="Interactive family tree"><div className="tree-couple">{people.slice(0, 2).map((person) => <PersonNode key={person.id} person={person} selected={selected === person.id} onSelect={onSelect} />)}</div>{people.length > 2 && <div className="tree-line line-one" />}{people.length > 2 && <div className="tree-child"><PersonNode person={people[2]} selected={selected === people[2].id} onSelect={onSelect} /></div>}{people.length > 3 && <div className="tree-line" />}{people.length > 3 && <div className="tree-grandchild"><PersonNode person={people[3]} selected={selected === people[3].id} onSelect={onSelect} /></div>}</div>{family.sources?.length ? <div className="mt-8 border-t border-[#ded0bd] pt-6"><p className="mb-3 text-[10px] font-semibold uppercase tracking-[.2em] text-[#957c67]">Memory sources in this family</p><div className="flex flex-wrap gap-2 text-xs text-[#65584d]">{family.sources.map((source) => <SourcePill key={source.text} icon={source.icon === 'chat' ? MessageCircleMore : source.icon === 'voice' ? Mic2 : ImageIcon} text={source.text} />)}</div></div> : null}</div>
      </div>
    </section>
  );
}

function ProfileSection({ person }: { person: PersonArchiveViewModel }) {
  const hasDetails = Boolean(person.interests?.length || person.smallThings?.length || person.personalityNote);
  const hasPerspectives = Boolean(person.perspectives?.length);
  const hasTimeline = person.timeline.length > 0;
  return (
    <section id="profile" className="scroll-mt-20 bg-[#eee4d5] py-20 md:py-28"><div className="mx-auto max-w-7xl px-6">
      <div className="profile-header grid overflow-hidden rounded-[34px] border border-white/60 bg-[#fbf6ec] shadow-[0_28px_90px_rgba(75,53,37,.13)] lg:grid-cols-[320px_1fr]"><div className="relative min-h-[330px] bg-[#d8c9b4]">{person.avatar ? <img src={person.avatar} alt={`Portrait of ${person.name}`} className="absolute inset-0 size-full object-cover" /> : <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_35%,#f2e9da,transparent_30%),linear-gradient(150deg,#d8cab7,#aa9780)]"><CircleUserRound size={112} strokeWidth={1} className="text-white/80" /></div>}<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2d2824]/75 to-transparent p-6 pt-20 text-white"><span className="rounded-full border border-white/30 bg-black/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.16em]">{person.status}</span></div></div><div className="p-7 md:p-11"><div className="flex flex-wrap items-start justify-between gap-6"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#9b4b40]">Family portrait</p><h2 className="mt-3 font-serif text-5xl text-[#392f28]">{person.name}</h2><p className="mt-2 font-serif text-2xl text-[#8c5a4b]">{person.chinese} · {person.years}</p></div>{person.role ? <div className="rounded-2xl border border-[#d8c8b2] bg-[#f5ecdd] px-4 py-3 text-right"><p className="text-[10px] uppercase tracking-[.17em] text-[#927d69]">Family role</p><p className="mt-1 text-sm font-medium text-[#52453a]">{person.role}</p></div> : null}</div>{person.overview ? <p className="mt-7 max-w-3xl text-base leading-8 text-[#65574c]">{person.overview}</p> : null}<div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{person.relation ? <Info label="Relationship" value={person.relation} /> : null}{person.location ? <Info label="Home" value={person.location} /> : null}{person.occupation ? <Info label="Occupation" value={person.occupation} /> : null}{person.personality ? <Info label="Personality" value={person.personality} /> : null}</div></div></div>
      {(hasDetails || hasPerspectives || hasTimeline) && <div className="mt-8 grid gap-8 lg:grid-cols-[.85fr_1.15fr]"><aside className="space-y-8">{hasDetails ? <section className="archive-card"><SectionLabel icon={Sparkles} text="Personal details" /><h3 className="font-serif text-2xl text-[#42362e]">The texture of an ordinary life</h3><p className="mt-3 text-xs leading-5 text-[#8a796b]">Specific details are retained because personality often lives in habits rather than summaries.</p>{person.interests?.length ? <><h4 className="detail-heading">Interests</h4><div className="flex flex-wrap gap-2">{person.interests.map((item) => <span key={item} className="detail-chip">{item}</span>)}</div></> : null}{person.smallThings?.length ? <><h4 className="detail-heading">Small things the family remembers</h4><ul className="space-y-3">{person.smallThings.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-[#65574c]"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#a25346]" />{item}</li>)}</ul></> : null}{person.personalityNote ? <p className="mt-6 border-t border-[#ded0bd] pt-5 text-xs italic leading-5 text-[#8a7868]">{person.personalityNote}</p> : null}</section> : null}{hasPerspectives ? <section className="archive-card"><SectionLabel icon={Users} text="Family perspectives" /><h3 className="font-serif text-2xl text-[#42362e]">No life has one narrator</h3><div className="mt-6 space-y-5">{person.perspectives!.map((view) => <article key={view.speaker} className="perspective"><div className="flex items-baseline justify-between gap-4"><h4 className="font-serif text-lg text-[#493c33]">{view.speaker}</h4><span className="text-[10px] uppercase tracking-[.14em] text-[#9a7d68]">{view.relationship}</span></div><p className="mt-3 text-sm leading-6 text-[#65574c]">“{view.text}”</p><p className="mt-3 text-[10px] tracking-wide text-[#a08c7a]">{view.source}</p></article>)}</div></section> : null}</aside>{hasTimeline ? <section className="archive-card"><SectionLabel icon={CalendarDays} text="Life record" /><div className="flex flex-wrap items-end justify-between gap-4"><div><h3 className="font-serif text-3xl text-[#42362e]">Life and timeline</h3><p className="mt-2 max-w-lg text-sm leading-6 text-[#79695d]">The places, dates and turning points this family wants to remember, with uncertain details left honestly open.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-[#e7eee8] px-3 py-1.5 text-xs text-[#567063]"><Check size={13} /> Kept by the family</span></div><div className="mt-10 space-y-0">{person.timeline.map((item) => <div key={`${person.id}-${item.year}`} className="timeline-item"><div className="timeline-dot" /><div className="pb-10"><div className="mb-2 flex flex-wrap items-center gap-3"><span className="font-serif text-xl text-[#9a4c41]">{item.year}</span><span className="text-[10px] uppercase tracking-[.17em] text-[#9a8877]">{item.place}</span></div><h4 className="font-serif text-xl text-[#45382f]">{item.title}</h4><p className="mt-2 max-w-2xl text-sm leading-7 text-[#79695d]">{item.copy}</p></div></div>)}</div>{person.quote ? <div className="mt-2 rounded-2xl border-l-2 border-[#a95a4d] bg-[#f6ecdf] p-6"><Quote size={20} className="text-[#a95a4d]" /><p className="mt-3 font-serif text-2xl leading-9 text-[#5a463a]">“{person.quote}”</p><p className="mt-3 text-[10px] uppercase tracking-[.17em] text-[#9a8270]">In their own words</p></div> : null}</section> : null}</div>}
    </div></section>
  );
}

function LifeMap({ person }: { person: PersonArchiveViewModel }) {
  const stops = person.journey!;
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedStop = stops[activeIndex] ?? stops[0];

  return <section id="journey" className="memory-map-section py-24 text-[#f7efdf] md:py-28">
    <div className="mx-auto max-w-7xl px-6">
      <div className="mb-12 grid gap-6 md:grid-cols-[.75fr_1.25fr] md:items-end">
        <div><p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.23em] text-[#dda783]"><Navigation size={15} /> Life map</p><h2 className="font-serif text-5xl leading-tight md:text-6xl">Places that<br />hold a life.</h2></div>
        <p className="max-w-2xl border-l border-white/20 pl-7 text-base leading-8 text-[#d9d1c1]">Follow {person.name} through the homes, journeys and family connections that gave each memory its setting. Select a place to open the story it carries.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
        <div className="memory-map relative min-h-[520px] overflow-hidden rounded-[32px] border border-white/15 p-5 shadow-[0_30px_90px_rgba(10,20,16,.25)] md:p-8">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4"><div className="flex flex-wrap gap-4 text-xs text-white/65"><span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full bg-[#d99b76]" /> Lived experience</span><span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full border border-[#dbcdb5] bg-[#71877b]" /> Family connection</span></div><span className="text-[10px] uppercase tracking-[.18em] text-white/40">Memory geography · not to scale</span></div>
          <div className="absolute inset-8 top-20 overflow-hidden rounded-[24px] border border-white/10 bg-[#233a32]/55">
            <div className="map-contours absolute inset-0" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true"><polyline points={stops.map((stop) => `${stop.x},${stop.y}`).join(' ')} fill="none" stroke="rgba(225,172,132,.7)" strokeWidth=".7" strokeDasharray="2.2 1.8" vectorEffect="non-scaling-stroke" /></svg>
            {stops.map((stop, index) => <button key={`${person.id}-${stop.city}-${index}`} type="button" onClick={() => setActiveIndex(index)} aria-pressed={activeIndex === index} className={`map-marker ${activeIndex === index ? 'is-active' : ''}`} style={{ left: `${stop.x}%`, top: `${stop.y}%` }}><span className={`map-marker-dot ${stop.kind === 'family' ? 'is-family' : ''}`}><MapPin size={15} /></span><span className="map-marker-label"><strong>{stop.city}</strong>{stop.chinese && <small>{stop.chinese}</small>}</span></button>)}
          </div>
        </div>
        <aside className="rounded-[32px] border border-white/15 bg-[#f7efe0] p-6 text-[#44382f] md:p-8">
          {selectedStop && <div className="border-b border-[#d9cab5] pb-7"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#a05447]">{selectedStop.years}</p><h3 className="mt-3 font-serif text-3xl">{selectedStop.city} {selectedStop.chinese && <span className="text-xl text-[#927968]">· {selectedStop.chinese}</span>}</h3><h4 className="mt-6 font-serif text-xl text-[#5f493c]">{selectedStop.title}</h4><p className="mt-3 text-sm leading-7 text-[#75665a]">{selectedStop.memory}</p></div>}
          <div className="mt-6 space-y-2">{stops.map((stop, index) => <button key={`list-${person.id}-${stop.city}-${index}`} type="button" onClick={() => setActiveIndex(index)} className={`map-stop-row ${activeIndex === index ? 'is-active' : ''}`}><span className="font-serif text-lg">{String(index + 1).padStart(2, '0')}</span><span><strong>{stop.city}</strong><small>{stop.years}</small></span><ChevronRight size={16} /></button>)}</div>
        </aside>
      </div>
    </div>
  </section>;
}

function StorySection({ person }: { person: PersonArchiveViewModel }) {
  const voiceCount = person.perspectives?.length ?? 0;
  return <section id="story" className="paper-texture py-24 md:py-32"><div className="mx-auto max-w-5xl px-6"><div className="mb-14 grid gap-8 md:grid-cols-[.8fr_1.2fr] md:items-end"><div><p className="eyebrow"><BookOpen size={14} /> Complete story</p><h2 className="font-serif text-5xl leading-tight text-[#352c26] md:text-6xl">{person.storyTitle}</h2></div>{person.storyDeck ? <p className="border-l border-[#c7b59d] pl-7 font-serif text-2xl leading-9 text-[#6a5142]">{person.storyDeck}</p> : null}</div><article className="story-manuscript">{voiceCount > 0 ? <p className="mb-8 text-xs font-semibold uppercase tracking-[.22em] text-[#8f493f]">Remembered in {voiceCount} voices</p> : null}{person.story!.map((paragraph, index) => <p key={`${person.id}-story-${index}`} className={index === 0 ? 'dropcap' : ''}>{paragraph}</p>)}</article></div></section>;
}

function FilmSection({ person }: { person: PersonArchiveViewModel }) {
  const film = person.film!;
  return <section id="film" className="bg-[#33483f] py-24 text-[#f8f0df] md:py-28">
    <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-[1.08fr_.92fr]">
      <MemoryFilm person={person} film={film} />
      <div><p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.23em] text-[#d9a27e]"><Film size={14} /> Life film</p><h2 className="font-serif text-4xl leading-tight md:text-5xl">{film.heading ?? (film.src ? 'A life told in one minute.' : 'A life, remembered in motion.')}</h2>{film.description ? <p className="mt-6 max-w-lg text-base leading-7 text-[#d8d1c3]">{film.description}</p> : null}<div className="mt-8 grid grid-cols-2 gap-3 text-xs text-[#d2c8b8]"><MediaStat label="Duration" value={film.duration ?? '—'} /><MediaStat label="Chapters" value={film.chapters ?? '—'} /><MediaStat label="Language" value={film.language ?? '—'} /><MediaStat label="Status" value={film.status ?? (film.src ? 'Ready to watch' : 'No film yet')} /></div></div>
    </div>
  </section>;
}

function LetterSection({ person }: { person: PersonArchiveViewModel }) {
  const letterTo = person.letterTo ?? 'the next generation';
  return <section id="letter" className="relative overflow-hidden bg-[#e8ddca] py-24 md:py-32"><div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_20%_10%,#fff9e9,transparent_35%)]" /><div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-[.68fr_1.32fr]"><div><p className="eyebrow"><LetterText size={14} /> A letter across generations</p><h2 className="font-serif text-4xl leading-tight text-[#3d3027] md:text-5xl">What a life<br />wants to pass on.</h2><p className="mt-6 max-w-sm text-base leading-7 text-[#756457]">A family letter holds more than events. It carries the meaning one generation hopes the next will recognise in ordinary objects, repeated habits and acts of care.</p><div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#bfa990] bg-[#f7efdf]/70 px-4 py-2 text-xs text-[#765f50]"><Check size={14} className="text-[#697c68]" /> Kept in {person.name}’s archive</div></div><article className="letter-paper rotate-[.25deg] p-9 md:p-14"><p className="mb-10 text-sm text-[#8b6d58]">Dear {letterTo},</p><div className="space-y-6 font-serif text-lg leading-8 text-[#514238]">{person.letter!.map((paragraph, index) => <p key={`${person.id}-letter-${index}`}>{paragraph}</p>)}</div><div className="mt-10 flex items-end justify-between"><div><p className="font-serif text-lg text-[#514238]">With love,</p><p className="mt-2 font-serif text-2xl text-[#974b40]">{person.name} · {person.chinese}</p></div><span className="seal">{person.chinese.slice(0, 1) || person.name.slice(0, 1)}</span></div></article></div></section>;
}

function VoiceSection({ person, collections }: { person: PersonArchiveViewModel; collections?: CollectionCard[] }) {
  const voice = person.voice;
  return <section id="voice" className="paper-texture py-24 md:py-28"><div className="mx-auto max-w-6xl px-6"><div className="grid gap-10 rounded-[32px] border border-[#d4c4ad] bg-[#fffaf0]/80 p-7 shadow-[0_24px_70px_rgba(84,61,43,.08)] md:p-12 lg:grid-cols-[.82fr_1.18fr]"><div><p className="eyebrow"><Headphones size={14} /> Voice archive</p><h2 className="font-serif text-4xl leading-tight text-[#392f28]">A letter can still<br />sound like home.</h2><p className="mt-5 max-w-md leading-7 text-[#726458]">Listen when reading is not enough. Each recording stays beside its letter, language and written transcript so the whole family can return to it.</p></div><div className="rounded-[26px] bg-[#3b4e45] p-6 text-[#f8f0df] md:p-8">{voice ? <><div><p className="text-[10px] uppercase tracking-[.2em] text-[#d7a583]">{voice.label}</p><h3 className="mt-2 font-serif text-2xl">{voice.language}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-white/65">{voice.note}</p></div>{voice.src ? <><audio key={person.id} className="archive-audio mt-8 w-full" controls preload="metadata"><source src={voice.src} type="audio/mpeg" />Your browser does not support embedded audio.</audio><div className="mt-5 flex flex-wrap gap-2"><span className="audio-pill">{voice.duration}</span><span className="audio-pill">Transcript included</span><span className="audio-pill">Mandarin reading</span></div>{voice.transcript && <details className="mt-6 rounded-2xl border border-white/15 bg-black/10 p-4"><summary className="cursor-pointer text-sm text-[#f4e6d0]">Read the Chinese transcript</summary><p lang="zh-CN" className="mt-4 text-sm leading-7 text-white/70">{voice.transcript}</p></details>}</> : <div className="mt-8 rounded-2xl border border-white/15 bg-black/10 p-5 text-sm leading-6 text-white/65">This person’s family-letter reading has not been added yet.</div>}</> : <div className="rounded-2xl border border-white/15 bg-black/10 p-5 text-sm leading-6 text-white/65">No voice recording has been added to this archive yet.</div>}</div></div>{collections?.length ? <div className="mt-20"><div className="mx-auto max-w-2xl text-center"><p className="justify-center eyebrow"><Sparkles size={14} /> Inside this family archive</p><h2 className="font-serif text-4xl text-[#392e27] md:text-5xl">A family kept in more than names and dates.</h2></div><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">{collections.map((item, index) => <a key={item.title} href={['#profile', '#story', '#letter', '#voice'][index]} className="process-card group block"><p className="font-serif text-4xl text-[#9c4b40]">{item.count}</p><div className="mt-6 flex items-center justify-between gap-3"><h3 className="font-serif text-xl text-[#43362e]">{item.title}</h3><ChevronRight size={18} className="text-[#a88670] transition-transform group-hover:translate-x-1" /></div><p className="mt-3 text-sm leading-6 text-[#7b6b5f]">{item.copy}</p></a>)}</div></div> : null}</div></section>;
}

function FamilyMoments({ person }: { person: PersonArchiveViewModel }) {
  const posts: MomentPost[] = person.moments?.length
    ? person.moments
    : (person.perspectives ?? []).map((view, index) => ({ id: `${person.id}-${index}`, author: view.speaker, relation: view.relationship, time: view.source, text: view.text, likes: 6 + index * 5, comments: [] }));
  const [draft, setDraft] = useState('');
  const [sharedPosts, setSharedPosts] = useState<MomentPost[]>([]);

  const shareMemory = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setSharedPosts((current) => [{ id: `shared-${Date.now()}`, author: 'You', relation: 'Family member', time: 'Just now', text, likes: 0, comments: [] }, ...current]);
    setDraft('');
  };

  return <section id="moments" className="moments-section py-24 md:py-28">
    <div className="mx-auto max-w-7xl px-6">
      <div className="grid gap-10 lg:grid-cols-[.62fr_1.38fr]">
        <div className="lg:sticky lg:top-28 lg:self-start"><p className="eyebrow"><MessageCircleMore size={15} /> Family moments</p><h2 className="font-serif text-5xl leading-tight text-[#382e27] md:text-6xl">The family,<br /><em className="font-normal text-[#9c4b40]">still talking.</em></h2><p className="mt-6 max-w-md text-base leading-8 text-[#746458]">Stories do not have to arrive as finished biographies. A remembered sentence, a reply from another city or one ordinary photograph can keep the archive alive.</p>
          <form onSubmit={shareMemory} className="mt-9 rounded-[26px] border border-[#d6c5ae] bg-[#fffaf0]/85 p-5 shadow-[0_18px_50px_rgba(76,55,39,.08)]"><label htmlFor="memory-draft" className="text-xs font-semibold uppercase tracking-[.17em] text-[#945347]">Add something you remember</label><textarea id="memory-draft" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Write a memory about ${person.name}…`} className="mt-4 min-h-28 w-full resize-none rounded-2xl border border-[#ddcfbd] bg-white/55 p-4 text-sm leading-6 text-[#50433a] outline-none transition focus:border-[#a65a4d]" /><div className="mt-3 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-xs text-[#907d6d]"><Plus size={14} /> Text memory</span><Button type="submit" disabled={!draft.trim()} className="rounded-full bg-[#9f5044] px-5 text-[#fff8ec] hover:bg-[#884238]"><Send size={14} /> Share with family</Button></div></form>
        </div>
        <div className="space-y-5">{sharedPosts.map((post) => <MomentCard key={post.id} post={post} person={person} />)}{posts.map((post) => <MomentCard key={post.id} post={post} person={person} />)}</div>
      </div>
    </div>
  </section>;
}

function MomentCard({ post, person }: { post: MomentPost; person: PersonArchiveViewModel }) {
  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const ownPost = post.author === person.name;
  return <article className="moment-card">
    <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border border-[#d4c2ab] bg-[#eee0cd] font-serif text-[#8f4c42]">{ownPost && person.avatar ? <img src={person.avatar} alt="" className="size-full object-cover" /> : post.author.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><div><h3 className="font-serif text-xl text-[#43372f]">{post.author}</h3><p className="mt-0.5 text-[11px] uppercase tracking-[.13em] text-[#9a7e69]">{post.relation}</p></div><time className="text-xs text-[#9b8a7c]">{post.time}</time></div><p className="mt-5 text-[15px] leading-7 text-[#66574c]">{post.text}</p>{post.image && <img src={post.image} alt={`A remembered scene shared by ${post.author}`} className="mt-5 aspect-video w-full rounded-[22px] object-cover" />}
      <div className="mt-5 flex items-center gap-5 border-t border-[#e0d3c1] pt-4"><button type="button" onClick={() => setLiked((value) => !value)} aria-pressed={liked} className={`moment-action ${liked ? 'is-liked' : ''}`}><Heart size={17} fill={liked ? 'currentColor' : 'none'} />{post.likes + (liked ? 1 : 0)}</button><button type="button" onClick={() => setShowComments((value) => !value)} aria-expanded={showComments} className="moment-action"><MessageCircle size={17} />{post.comments.length || 'Reply'}</button><span className="ml-auto text-[11px] text-[#a08f80]">Kept with {person.name}</span></div>
      {showComments && <div className="mt-4 space-y-3 rounded-2xl bg-[#f2e8da] p-4">{post.comments.length ? post.comments.map((comment) => <p key={`${post.id}-${comment.author}`} className="text-sm leading-6 text-[#67584d]"><strong className="font-semibold text-[#8e4d43]">{comment.author}</strong> · {comment.text}</p>) : <p className="text-sm text-[#8a7869]">Be the first family member to reply.</p>}</div>}
    </div></div>
  </article>;
}

function PersonNode({ person, selected, onSelect }: { person: ArchivePersonCard; selected: boolean; onSelect: (id: string) => void }) { return <Button type="button" variant="ghost" onClick={() => onSelect(person.id)} className={`person-node h-auto justify-start whitespace-normal ${selected ? 'is-selected' : ''}`} aria-pressed={selected}><span className="avatar-ring overflow-hidden" style={{ '--avatar-color': person.color ?? '#9c8a75' } as React.CSSProperties}>{person.avatar ? <img src={person.avatar} alt="" className="size-full object-cover" /> : <span>{person.chinese.slice(-1) || person.name.slice(0, 1)}</span>}</span><span className="min-w-0 flex-1 text-left"><span className="block truncate font-serif text-[15px] text-[#3c322b]">{person.name}</span><span className="block text-[10px] uppercase tracking-[.12em] text-[#927d6c]">{person.years} · {person.status}</span></span><ChevronRight size={14} className="text-[#a48d78]" /></Button>; }
function MemoryFilm({ person, film }: { person: PersonArchiveViewModel; film: FilmViewModel }) {
  if (film.src) return <div className="relative aspect-video overflow-hidden rounded-[28px] border border-white/15 bg-[#21342d] shadow-[0_30px_80px_rgba(20,27,24,.3)]"><video className="size-full object-cover" controls preload="metadata" poster={film.poster}><source src={film.src} type="video/mp4" />{film.captions ? <track kind="subtitles" src={film.captions} srcLang="en" label="English" default /> : null}Your browser does not support embedded video.</video><span className="pointer-events-none absolute left-5 top-5 rounded-full border border-white/25 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[.2em]">Life film · {film.duration ?? ''}</span></div>;
  return <div className="video-frame relative aspect-video overflow-hidden rounded-[28px] border border-white/15 shadow-[0_30px_80px_rgba(20,27,24,.3)]"><div className="absolute inset-0 bg-gradient-to-t from-[#17241f]/90 via-[#17241f]/25 to-black/10" /><div className="absolute inset-0 grid place-items-center"><span className="grid size-16 place-items-center rounded-full border border-white/30 bg-[#f4e9d3] text-[#8f483d]"><Play className="ml-1" size={24} /></span></div><div className="absolute bottom-6 left-7"><p className="font-serif text-2xl">{person.storyTitle ?? person.name}</p><p className="mt-2 text-xs uppercase tracking-[.16em] text-white/60">No life film added yet</p></div></div>;
}
function SourcePill({ icon: Icon, text }: { icon: typeof Mic2; text: string }) { return <span className="inline-flex items-center gap-2 rounded-full border border-[#d8c9b4] bg-white/50 px-3 py-2"><Icon size={13} className="text-[#9b5549]" />{text}</span>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#ded0bd] bg-[#fffaf0]/70 p-4"><p className="text-[9px] font-semibold uppercase tracking-[.17em] text-[#9a816d]">{label}</p><p className="mt-2 text-sm leading-5 text-[#50443a]">{value}</p></div>; }
function SectionLabel({ icon: Icon, text }: { icon: typeof Sparkles; text: string }) { return <p className="eyebrow"><Icon size={14} />{text}</p>; }
function MediaStat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/15 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-[.17em] text-white/50">{label}</p><p className="mt-1.5 text-sm text-[#f4ead9]">{value}</p></div>; }

function WelcomeCover() {
  return <section id="welcome" className="welcome-cover" aria-labelledby="welcome-title">
    <div className="welcome-image" aria-hidden="true" />
    <div className="welcome-shade" aria-hidden="true" />
    <div className="welcome-grain" aria-hidden="true" />
    <div className="welcome-orbit orbit-one" aria-hidden="true" />
    <div className="welcome-orbit orbit-two" aria-hidden="true" />

    <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[1440px] flex-col px-6 pb-8 pt-7 md:px-10 md:pb-10 md:pt-9">
      <div className="flex items-center justify-between text-[#f8efdf]">
        <a href="#welcome" className="flex items-center gap-3" aria-label="Everroot home">
          <span className="grid size-11 place-items-center rounded-full border border-white/25 bg-[#a64f43]/85 shadow-[0_10px_30px_rgba(0,0,0,.18)] backdrop-blur"><Flower2 size={21} strokeWidth={1.6} /></span>
          <div><p className="font-serif text-xl font-semibold tracking-[.12em]">Everroot</p><p className="text-[9px] uppercase tracking-[.3em] text-white/60">Family memory archive</p></div>
        </a>
        <p className="hidden text-[11px] uppercase tracking-[.28em] text-white/55 sm:block">陪伴当下 · 留住一生 · 传给未来</p>
      </div>

      <div className="my-auto max-w-[760px] py-20 text-[#fff8ea]">
        <p className="welcome-kicker"><span /> For every voice in the family</p>
        <h1 id="welcome-title" className="welcome-title">Stay for the conversation.<br /><em>Keep what matters.</em></h1>
        <p className="mt-7 max-w-[620px] text-base leading-8 text-[#eee5d8]/88 md:text-lg md:leading-9">Some memories arrive as stories. Others begin with a small question on an ordinary evening. Everroot gives every generation a place to be heard—and every family a way to carry those voices forward.</p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <a href="#family" className="welcome-primary">Enter a family archive <ChevronRight size={17} /></a>
          <a href="#memory-promise" className="welcome-secondary">See how a memory lives <ArrowDown size={16} /></a>
        </div>
      </div>

      <div id="memory-promise" className="welcome-promise">
        <div><span className="promise-number">01</span><p><strong>Be heard</strong><small>A familiar voice has time for the whole story.</small></p></div>
        <div><span className="promise-number">02</span><p><strong>Be remembered</strong><small>Small details find their place in a life.</small></p></div>
        <div><span className="promise-number">03</span><p><strong>Stay connected</strong><small>Stories keep moving between generations.</small></p></div>
      </div>
    </div>

    <a href="#family" className="welcome-scroll" aria-label="Continue to the family archive"><span>Discover the archive</span><ArrowDown size={15} /></a>
  </section>;
}
