'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, BookOpen, CalendarDays, Check, ChevronRight, CircleUserRound, ClipboardList, Film, Flower2, Headphones, Heart, HeartHandshake, Image as ImageIcon, LetterText, MapPin, MessageCircle, MessageCircleMore, Mic2, Navigation, Play, Plus, Quote, Send, Sparkles, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFamilyId, getProviderForMode, type AppMode } from '@/lib/data/provider';
import type { ArchivePersonCard, CollectionCard, FamilyArchiveViewModel, FilmViewModel, MomentPost, PersonArchiveViewModel, RelationshipViewModel } from '@/lib/view-models/family-archive';
import { useI18n } from '@/lib/i18n';
import { useMode } from '@/lib/mode';

const API_BASE = process.env.NEXT_PUBLIC_SHUYI_API_BASE_URL ?? 'http://127.0.0.1:8000';
const API = API_BASE.replace(/\/$/, '');

function areSpouses(a: ArchivePersonCard, b: ArchivePersonCard, relationships: RelationshipViewModel[]): boolean {
  return relationships.some((r) =>
    r.relationType === 'spouse' &&
    ((r.fromProjectId === a.projectId && r.toProjectId === b.projectId) ||
     (r.fromProjectId === b.projectId && r.toProjectId === a.projectId)),
  );
}

function computeGenerations(people: ArchivePersonCard[], relationships: RelationshipViewModel[]): ArchivePersonCard[][] {
  const byId = new Map(people.map((p) => [p.projectId, p]));
  const children = new Map<number, number[]>();
  const parents = new Map<number, number>();
  for (const r of relationships) {
    if (r.relationType !== 'parent') continue;
    if (!byId.has(r.fromProjectId) || !byId.has(r.toProjectId)) continue;
    const list = children.get(r.fromProjectId) ?? [];
    list.push(r.toProjectId);
    children.set(r.fromProjectId, list);
    if (!parents.has(r.toProjectId)) parents.set(r.toProjectId, r.fromProjectId);
  }
  const roots = people.filter((p) => !parents.has(p.projectId));
  const startNodes = roots.length ? roots : [people[0]];
  const generation = new Map<number, number>();
  const queue: number[] = [];
  for (const node of startNodes) { generation.set(node.projectId, 0); queue.push(node.projectId); }
  while (queue.length) {
    const id = queue.shift()!;
    const g = generation.get(id)!;
    for (const childId of children.get(id) ?? []) {
      if (!generation.has(childId)) { generation.set(childId, g + 1); queue.push(childId); }
    }
  }
  const maxGen = generation.size ? Math.max(...generation.values()) : 0;
  const levels: ArchivePersonCard[][] = Array.from({ length: maxGen + 1 }, () => []);
  for (const p of people) {
    const g = generation.get(p.projectId) ?? 0;
    levels[g].push(p);
  }
  return levels.filter((level) => level.length > 0);
}

export default function FamilyArchive({ family }: { family: FamilyArchiveViewModel }) {
  const { t, lang, setLang } = useI18n();
  const { mode, setMode } = useMode();
  const [data, setData] = useState<FamilyArchiveViewModel>(family);
  const [loading, setLoading] = useState(false);
  const [persons, setPersons] = useState<Record<string, PersonArchiveViewModel>>(
    family.selectedPerson ? { [family.selectedPerson.id]: family.selectedPerson } : {},
  );
  const [selected, setSelected] = useState(family.selectedPerson?.id ?? family.people[0]?.id ?? '');
  const [familyId, setFamilyId] = useState<number>(getFamilyId());
  const yearNow = String(new Date().getFullYear());

  const loadData = useCallback(async (m: AppMode, fid: number) => {
    setLoading(true);
    try {
      const fam = await getProviderForMode(m).getFamily(fid);
      setData(fam);
      setPersons(fam.selectedPerson ? { [fam.selectedPerson.id]: fam.selectedPerson } : {});
      setSelected(fam.selectedPerson?.id ?? fam.people[0]?.id ?? '');
    } catch {
      // In realtime mode, never fall back to demo content: show the empty
      // realtime hint instead. In demo mode, keep whatever we already had.
      if (m === 'RT') {
        setData({ family: { id: fid, name: '' }, people: [], selectedPerson: null, stats: { people: 0, memories: 0, recordings: 0 }, relationships: [] });
        setPersons({});
        setSelected('');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(mode, familyId);
  }, [mode, familyId, loadData]);

  const handleDataChanged = useCallback((fid?: number) => {
    const target = fid ?? familyId;
    if (fid != null) setFamilyId(fid);
    if (mode === 'RT') loadData('RT', target);
  }, [mode, familyId, loadData]);

  const uiLangSwitch = (
    <div className="welcome-lang-switch" role="group" aria-label="Language">
      <button type="button" className={lang === 'zh-CN' ? 'is-active' : ''} onClick={() => setLang('zh-CN')}>{t('welcome.lang.zh')}</button>
      <button type="button" className={lang === 'en-US' ? 'is-active' : ''} onClick={() => setLang('en-US')}>{t('welcome.lang.en')}</button>
    </div>
  );
  const uiModeSwitch = (
    <div className="welcome-mode-switch" role="group" aria-label={t('mode.group.aria')}>
      <button type="button" className={mode === 'DM' ? 'is-active' : ''} onClick={() => setMode('DM')} title={t('mode.dm.label')}>DM</button>
      <button type="button" className={mode === 'RT' ? 'is-active' : ''} onClick={() => setMode('RT')} title={t('mode.rt.label')}>RT</button>
    </div>
  );
  const switchers = (
    <div className="flex items-center gap-2">
      {uiModeSwitch}
      {uiLangSwitch}
    </div>
  );

  const active = persons[selected] ?? null;

  const sections = [
    { id: 'chatting', key: 'nav.chat', visible: true },
    { id: 'family', key: 'nav.family', visible: data.people.length > 0 },
    { id: 'profile', key: 'nav.life', visible: !!active },
    { id: 'journey', key: 'nav.map', visible: !!(active?.journey?.length) },
    { id: 'story', key: 'nav.story', visible: !!(active?.story?.length) },
    { id: 'film', key: 'nav.film', visible: !!active?.film },
    { id: 'letter', key: 'nav.letter', visible: !!(active?.letter?.length) },
    { id: 'voice', key: 'nav.voice', visible: !!(active?.voice || active?.media?.audio?.length) },
    { id: 'moments', key: 'nav.moments', visible: !!(active && (active.moments?.length || active.perspectives?.length)) },
  ];

  const selectPerson = async (id: string) => {
    setSelected(id);
    window.setTimeout(() => document.getElementById('profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    if (persons[id]) return;
    const card = data.people.find((person) => person.id === id);
    if (!card) return;
    try {
      const person = await getProviderForMode(mode).getPerson(card.projectId);
      setPersons((current) => ({ ...current, [id]: person }));
    } catch {
      // Keep the current selection; the detail will stay empty rather than fabricate data.
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <WelcomeCover switcher={switchers} t={t} />

      <ChattingSection family={data} t={t} onDataChanged={handleDataChanged} />

      {loading ? <div className="fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded-full bg-[#a64f43] px-4 py-1.5 text-xs text-white shadow-lg">{t('chat.people.loading')}</div> : null}

      <header className="sticky top-0 z-40 border-b border-[#d9cebb]/75 bg-[#f8f3e8]/94 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 md:px-10">
          <a href="#welcome" className="flex items-center gap-3" aria-label={t('nav.home')}><span className="grid size-10 place-items-center rounded-full bg-[#a34f42] text-[#fffaf0]"><Flower2 size={20} strokeWidth={1.7} /></span><div><p className="font-serif text-xl font-semibold tracking-[.08em] text-[#392f28]">Everroot</p><p className="text-[10px] uppercase tracking-[.24em] text-[#8b7563]">{t('nav.tagline')}</p></div></a>
          <nav className="hidden items-center gap-5 text-[13px] text-[#6f6256] lg:flex" aria-label="Main navigation">{sections.map((section) => section.visible ? <a key={section.id} href={`#${section.id}`}>{t(section.key)}</a> : null)}</nav>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#b8aa94] bg-white/40 px-3 py-1.5 text-xs text-[#796956]">{t('nav.private')}</span>
            {switchers}
          </div>
        </div>
      </header>

      {mode === 'RT' && data.people.length === 0 ? (
        <section id="family" className="paper-texture border-b border-[#d8cbb8] py-16 md:py-20">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <p className="eyebrow justify-center"><Sparkles size={14} /> {t('mode.rt.hint.title')}</p>
            <p className="mt-4 text-base leading-8 text-[#726458]">{t('mode.rt.hint.copy')}</p>
          </div>
        </section>
      ) : data.people.length > 0 ? (
        <FamilySection family={data} people={data.people} selected={selected} onSelect={selectPerson} t={t} />
      ) : null}

      {active ? <ProfileSection person={active} t={t} /> : null}
      {active && active.journey?.length ? <LifeMap person={active} t={t} /> : null}
      {active && active.story?.length ? <StorySection person={active} t={t} /> : null}
      {active && active.film ? <FilmSection person={active} t={t} /> : null}
      {active && active.letter?.length ? <LetterSection person={active} t={t} /> : null}
      {active && (active.voice || active.media?.audio?.length) ? <VoiceSection person={active} collections={data.collections} t={t} /> : null}
      {active && (active.moments?.length || active.perspectives?.length) ? <FamilyMoments person={active} t={t} /> : null}

      <footer className="border-t border-[#cfc0aa] bg-[#f3ecde] py-10"><div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-6 text-center sm:flex-row sm:text-left"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#a34f42] text-white"><Flower2 size={17} /></span><div><p className="font-serif text-lg">Everroot</p><p className="text-[10px] uppercase tracking-[.2em] text-[#8d7967]">{t('footer.tagline')}</p></div></div><p className="text-xs leading-5 text-[#8a7766]">{t('footer.copy', { year: yearNow, family: data.family.name })}</p></div></footer>
    </main>
  );
}

function FamilySection({ family, people, selected, onSelect, t }: { family: FamilyArchiveViewModel; people: ArchivePersonCard[]; selected: string; onSelect: (id: string) => void; t: (k: string, v?: Record<string, string | number>) => string }) {
  const { stats } = family;
  const memoriesLabel = stats.memories > 0 ? ` · ${stats.memories} memories` : '';
  const generations = computeGenerations(people, family.relationships);
  return (
    <section id="family" className="paper-texture border-b border-[#d8cbb8] py-16 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[.72fr_1.28fr]">
        <div className="lg:sticky lg:top-28 lg:self-start"><p className="eyebrow"><Users size={14} /> {t('family.eyebrow')} · {family.family.name}</p><h1 className="font-serif text-5xl leading-[1.06] tracking-[-.025em] text-[#332b25] md:text-6xl">{t('family.title').split('\n').map((line, i) => i === 1 ? <em key={i} className="font-normal text-[#9c4b40]">{line}</em> : <span key={i}>{line}{i !== (t('family.title').split('\n').length - 1) ? <br /> : null}</span>)}</h1><p className="mt-6 max-w-md leading-7 text-[#726458]">{t('family.copy1')}<br />{t('family.copy2')}</p><div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#d8c7ad] bg-[#fffaf0]/70 p-4 text-sm leading-6 text-[#67594e]"><HeartHandshake className="mt-1 shrink-0 text-[#9c4b40]" size={18} /><p><strong className="font-semibold text-[#44382f]">Always someone to talk to.</strong><br />Ordinary evenings become a place to feel heard, remember and stay close to family.</p></div><div className="mt-8 grid grid-cols-3 gap-3">{[
          { v: String(stats.people ?? 0), k: 'family.stats.people' },
          { v: String(stats.memories ?? 0), k: 'family.stats.memories' },
          { v: String(stats.recordings ?? 0), k: 'family.stats.recordings' },
        ].map((stat) => <div key={stat.k} className="rounded-2xl border border-[#ded0bd] bg-[#fffaf0]/55 p-4"><p className="font-serif text-3xl text-[#9c4b40]">{stat.v}</p><p className="mt-2 text-xs leading-5 text-[#877768]">{t(stat.k)}</p></div>)}</div></div>
        <div className="rounded-[32px] border border-[#d6c6ae] bg-[#fffaf0]/80 p-6 shadow-[0_24px_80px_rgba(92,66,42,.09)] md:p-10"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="font-serif text-2xl text-[#3d332b]">{t('family.sources.title')}</p><p className="mt-1 text-xs tracking-wide text-[#8a796a]">{people.length > 0 ? t('family.collections.title') + ' · ' + people.length : ''}</p></div><span className="rounded-full bg-[#e7eee8] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-[#51655b]">{stats.people} profiles{memoriesLabel}</span></div><div className="tree-grid" aria-label="Interactive family tree">{generations.map((generation, gi) => { const isCouple = generation.length === 2 && areSpouses(generation[0], generation[1], family.relationships); return <div className="tree-generation" key={gi}>{gi > 0 ? <div className="tree-line" /> : null}<div className={isCouple ? 'tree-couple' : 'tree-row'}>{generation.map((person) => isCouple ? <PersonNode key={person.id} person={person} selected={selected === person.id} onSelect={onSelect} t={t} /> : <div className="tree-child" key={person.id}><PersonNode person={person} selected={selected === person.id} onSelect={onSelect} t={t} /></div>)}</div></div>; })}</div>{family.sources?.length ? <div className="mt-8 border-t border-[#ded0bd] pt-6"><p className="mb-3 text-[10px] font-semibold uppercase tracking-[.2em] text-[#957c67]">{t('family.sources.title')}</p><div className="flex flex-wrap gap-2 text-xs text-[#65584d]">{family.sources.map((source) => <SourcePill key={source.text} icon={source.icon === 'chat' ? MessageCircleMore : source.icon === 'voice' ? Mic2 : ImageIcon} text={source.text} />)}</div></div> : null}</div>
      </div>
    </section>
  );
}

function ProfileSection({ person, t }: { person: PersonArchiveViewModel; t: (k: string, v?: Record<string, string | number>) => string }) {
  const hasDetails = Boolean(person.interests?.length || person.smallThings?.length || person.personalityNote);
  const hasPerspectives = Boolean(person.perspectives?.length);
  const hasTimeline = person.timeline.length > 0;
  return (
    <section id="profile" className="scroll-mt-20 bg-[#eee4d5] py-20 md:py-28"><div className="mx-auto max-w-7xl px-6">
      <div className="profile-header grid overflow-hidden rounded-[34px] border border-white/60 bg-[#fbf6ec] shadow-[0_28px_90px_rgba(75,53,37,.13)] lg:grid-cols-[320px_1fr]"><div className="relative min-h-[330px] bg-[#d8c9b4]">{person.avatar ? <img src={person.avatar} alt={`Portrait of ${person.name}`} className="absolute inset-0 size-full object-cover" /> : <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_35%,#f2e9da,transparent_30%),linear-gradient(150deg,#d8cab7,#aa9780)]"><CircleUserRound size={112} strokeWidth={1} className="text-white/80" /></div>}<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2d2824]/75 to-transparent p-6 pt-20 text-white"><span className="rounded-full border border-white/30 bg-black/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.16em]">{person.status === 'Living' ? t('person.status.living') : t('person.status.remembered')}</span></div></div><div className="p-7 md:p-11"><div className="flex flex-wrap items-start justify-between gap-6"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#9b4b40]">{t('life.overview.title')}</p><h2 className="mt-3 font-serif text-5xl text-[#392f28]">{person.name || t('common.unknown')}</h2><p className="mt-2 font-serif text-2xl text-[#8c5a4b]">{person.chinese}{person.chinese ? ' · ' : ''}{person.years || t('common.unknown')}</p></div>{person.role ? <div className="rounded-2xl border border-[#d8c8b2] bg-[#f5ecdd] px-4 py-3 text-right"><p className="text-[10px] uppercase tracking-[.17em] text-[#927d69]">{t('family.sources.title')}</p><p className="mt-1 text-sm font-medium text-[#52453a]">{person.role}</p></div> : null}</div>{person.overview ? <p className="mt-7 max-w-3xl text-base leading-8 text-[#65574c]">{person.overview}</p> : null}<div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{person.relation ? <Info label={t('person.relation.other')} value={person.relation} /> : null}{person.location ? <Info label={t('life.hometown.based')} value={person.location} /> : null}{person.occupation ? <Info label={t('family.stats.recordings')} value={person.occupation} /> : null}{person.personality ? <Info label={t('life.character.title')} value={person.personality} /> : null}</div></div></div>
      {(hasDetails || hasPerspectives || hasTimeline) && <div className="mt-8 grid gap-8 lg:grid-cols-[.85fr_1.15fr]"><aside className="space-y-8">{hasDetails ? <section className="archive-card"><SectionLabel icon={Sparkles} text={t('life.character.title')} /><h3 className="font-serif text-2xl text-[#42362e]">The texture of an ordinary life</h3><p className="mt-3 text-xs leading-5 text-[#8a796b]">{t('life.character.empty')}</p>{person.interests?.length ? <><h4 className="detail-heading">{t('life.interests.title')}</h4><div className="flex flex-wrap gap-2">{person.interests.map((item) => <span key={item} className="detail-chip">{item}</span>)}</div></> : null}{person.smallThings?.length ? <><h4 className="detail-heading">{t('life.interests.title')}</h4><ul className="space-y-3">{person.smallThings.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-[#65574c]"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#a25346]" />{item}</li>)}</ul></> : null}{person.personalityNote ? <p className="mt-6 border-t border-[#ded0bd] pt-5 text-xs italic leading-5 text-[#8a7868]">{t('life.character.note')}：{person.personalityNote}</p> : null}</section> : null}{hasPerspectives ? <section className="archive-card"><SectionLabel icon={Users} text={t('life.perspectives.title')} /><h3 className="font-serif text-2xl text-[#42362e]">No life has one narrator</h3><div className="mt-6 space-y-5">{person.perspectives!.map((view) => <article key={view.speaker} className="perspective"><div className="flex items-baseline justify-between gap-4"><h4 className="font-serif text-lg text-[#493c33]">{view.speaker}</h4><span className="text-[10px] uppercase tracking-[.14em] text-[#9a7d68]">{view.relationship}</span></div><p className="mt-3 text-sm leading-6 text-[#65574c]">“{view.text}”</p><p className="mt-3 text-[10px] tracking-wide text-[#a08c7a]">{t('story.perspectives.source')}：{view.source}</p></article>)}</div></section> : null}</aside>{hasTimeline ? <section className="archive-card"><SectionLabel icon={CalendarDays} text={t('life.timeline.title')} /><div className="flex flex-wrap items-end justify-between gap-4"><div><h3 className="font-serif text-3xl text-[#42362e]">{t('life.timeline.title')}</h3><p className="mt-2 max-w-lg text-sm leading-6 text-[#79695d]">The places, dates and turning points this family wants to remember, with uncertain details left honestly open.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-[#e7eee8] px-3 py-1.5 text-xs text-[#567063]"><Check size={13} /> Kept by the family</span></div><div className="mt-10 space-y-0">{person.timeline.map((item) => <div key={`${person.id}-${item.year}`} className="timeline-item"><div className="timeline-dot" /><div className="pb-10"><div className="mb-2 flex flex-wrap items-center gap-3"><span className="font-serif text-xl text-[#9a4c41]">{item.year}</span><span className="text-[10px] uppercase tracking-[.17em] text-[#9a8877]">{item.place}</span></div><h4 className="font-serif text-xl text-[#45382f]">{item.title}</h4><p className="mt-2 max-w-2xl text-sm leading-7 text-[#79695d]">{item.copy}</p></div></div>)}</div>{person.quote ? <div className="mt-2 rounded-2xl border-l-2 border-[#a95a4d] bg-[#f6ecdf] p-6"><Quote size={20} className="text-[#a95a4d]" /><p className="mt-3 font-serif text-2xl leading-9 text-[#5a463a]">“{person.quote}”</p><p className="mt-3 text-[10px] uppercase tracking-[.17em] text-[#9a8270]">In their own words</p></div> : null}</section> : null}</div>}
    </div></section>
  );
}

function LifeMap({ person, t }: { person: PersonArchiveViewModel; t: (k: string, v?: Record<string, string | number>) => string }) {
  const stops = person.journey!;
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedStop = stops[activeIndex] ?? stops[0];

  return <section id="journey" className="memory-map-section py-24 text-[#f7efdf] md:py-28">
    <div className="mx-auto max-w-7xl px-6">
      <div className="mb-12 grid gap-6 md:grid-cols-[.75fr_1.25fr] md:items-end">
        <div><p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.23em] text-[#dda783]"><Navigation size={15} /> {t('journey.eyebrow')}</p><h2 className="font-serif text-5xl leading-tight md:text-6xl">{t('journey.title').split('\n').map((line, i) => <span key={i}>{line}{i < t('journey.title').split('\n').length - 1 ? <br /> : null}</span>)}</h2></div>
        <p className="max-w-2xl border-l border-white/20 pl-7 text-base leading-8 text-[#d9d1c1]">{t('journey.copy1')}<br />{t('journey.copy2')}</p>
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
          {selectedStop && <div className="border-b border-[#d9cab5] pb-7"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#a05447]">{t('journey.sidebar.years', { years: selectedStop.years })}</p><h3 className="mt-3 font-serif text-3xl">{selectedStop.city} {selectedStop.chinese && <span className="text-xl text-[#927968]">· {selectedStop.chinese}</span>}</h3><h4 className="mt-6 font-serif text-xl text-[#5f493c]">{selectedStop.title}</h4><p className="mt-3 text-sm leading-7 text-[#75665a]">{selectedStop.memory}</p></div>}
          <div className="mt-6"><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#8a594b]">{t('journey.sidebar.title')}</p><p className="mt-2 text-xs text-[#7b6a5c]">{t('journey.sidebar.sub')}</p><div className="mt-5 space-y-2">{stops.map((stop, index) => <button key={`list-${person.id}-${stop.city}-${index}`} type="button" onClick={() => setActiveIndex(index)} className={`map-stop-row ${activeIndex === index ? 'is-active' : ''}`}><span className="font-serif text-lg">{String(index + 1).padStart(2, '0')}</span><span><strong>{stop.city}</strong><small>{stop.years}</small></span><ChevronRight size={16} /></button>)}</div></div>
        </aside>
      </div>
    </div>
  </section>;
}

function StorySection({ person, t }: { person: PersonArchiveViewModel; t: (k: string, v?: Record<string, string | number>) => string }) {
  const voiceCount = person.perspectives?.length ?? 0;
  return <section id="story" className="paper-texture py-24 md:py-32"><div className="mx-auto max-w-5xl px-6"><div className="mb-14 grid gap-8 md:grid-cols-[.8fr_1.2fr] md:items-end"><div><p className="eyebrow"><BookOpen size={14} /> {t('story.eyebrow')}</p><h2 className="font-serif text-5xl leading-tight text-[#352c26] md:text-6xl">{person.storyTitle}</h2></div>{person.storyDeck ? <p className="border-l border-[#c7b59d] pl-7 font-serif text-2xl leading-9 text-[#6a5142]">{person.storyDeck}</p> : null}</div><article className="story-manuscript">{voiceCount > 0 ? <p className="mb-8 text-xs font-semibold uppercase tracking-[.22em] text-[#8f493f]">{t('story.perspectives.title').replace('家人回忆', '')} Remembered in {voiceCount} voices</p> : null}{person.story!.map((paragraph, index) => <p key={`${person.id}-story-${index}`} className={index === 0 ? 'dropcap' : ''}>{paragraph}</p>)}</article></div>{person.perspectives?.length ? <div className="mx-auto mt-20 max-w-5xl px-6"><SectionLabel icon={Users} text={t('story.perspectives.title')} /><h3 className="font-serif text-3xl text-[#3e322a]">{t('story.perspectives.sub')}</h3><div className="mt-8 grid gap-5 md:grid-cols-2">{person.perspectives.map((view) => <article key={view.speaker} className="rounded-2xl border border-[#d9c8b1] bg-[#fffaf0]/70 p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="font-serif text-xl text-[#463931]">{view.speaker}</p><p className="mt-1 text-[11px] uppercase tracking-[.14em] text-[#977a65]">{view.relationship}</p></div></div><p className="mt-4 text-sm leading-7 text-[#67564a]">“{view.text}”</p><p className="mt-4 text-[11px] tracking-wide text-[#a28872]">{t('story.perspectives.source')}：{view.source}</p></article>)}</div></div> : null}</section>;
}

function FilmSection({ person, t }: { person: PersonArchiveViewModel; t: (k: string, v?: Record<string, string | number>) => string }) {
  const film = person.film!;
  const heading = film.heading ?? (film.src ? 'A life told in one minute.' : t('film.empty.heading'));
  const description = film.description ?? t('film.empty.description', { name: person.name });
  return <section id="film" className="bg-[#33483f] py-24 text-[#f8f0df] md:py-28">
    <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-[1.08fr_.92fr]">
      <MemoryFilm person={person} film={film} t={t} />
      <div><p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.23em] text-[#d9a27e]"><Film size={14} /> {t('film.eyebrow')}</p><h2 className="font-serif text-4xl leading-tight md:text-5xl">{heading.split('\n').map((line, i) => <span key={i}>{line}{i < heading.split('\n').length - 1 ? <br /> : null}</span>)}</h2>{description ? <p className="mt-6 max-w-lg text-base leading-7 text-[#d8d1c3]">{description}</p> : null}<div className="mt-8 grid grid-cols-2 gap-3 text-xs text-[#d2c8b8]"><MediaStat label={t('film.stats.duration')} value={film.duration ?? '—'} /><MediaStat label={t('film.stats.chapters')} value={film.chapters ?? '—'} /><MediaStat label={t('film.stats.language')} value={film.language ?? '—'} /><MediaStat label={t('family.sources.title')} value={film.status ?? (film.src ? 'Ready to watch' : t('film.empty.status'))} /></div></div>
    </div>
  </section>;
}

function LetterSection({ person, t }: { person: PersonArchiveViewModel; t: (k: string, v?: Record<string, string | number>) => string }) {
  const letterTo = person.letterTo ?? 'the next generation';
  return <section id="letter" className="relative overflow-hidden bg-[#e8ddca] py-24 md:py-32"><div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_20%_10%,#fff9e9,transparent_35%)]" /><div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-[.68fr_1.32fr]"><div><p className="eyebrow"><LetterText size={14} /> {t('letter.eyebrow')}</p><h2 className="font-serif text-4xl leading-tight text-[#3d3027] md:text-5xl">{t('letter.title').split('\n').map((line, i) => <span key={i}>{line}{i < t('letter.title').split('\n').length - 1 ? <br /> : null}</span>)}</h2><p className="mt-6 max-w-sm text-base leading-7 text-[#756457]">{t('letter.copy')}</p><div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#bfa990] bg-[#f7efdf]/70 px-4 py-2 text-xs text-[#765f50]"><Check size={14} className="text-[#697c68]" /> {t('life.character.note')}：{person.name}’s archive</div></div><article className="letter-paper rotate-[.25deg] p-9 md:p-14"><p className="mb-10 text-sm text-[#8b6d58]">Dear {letterTo},</p><div className="space-y-6 font-serif text-lg leading-8 text-[#514238]">{person.letter!.map((paragraph, index) => <p key={`${person.id}-letter-${index}`}>{paragraph}</p>)}</div><div className="mt-10 flex items-end justify-between"><div><p className="font-serif text-lg text-[#514238]">With love,</p><p className="mt-2 font-serif text-2xl text-[#974b40]">{person.name} · {person.chinese}</p></div><span className="seal">{person.chinese.slice(0, 1) || person.name.slice(0, 1)}</span></div></article></div></section>;
}

function VoiceSection({ person, collections, t }: { person: PersonArchiveViewModel; collections?: CollectionCard[]; t: (k: string, v?: Record<string, string | number>) => string }) {
  const voice = person.voice;
  const labelEmpty = 'No voice recording has been added to this archive yet.';
  return <section id="voice" className="paper-texture py-24 md:py-28"><div className="mx-auto max-w-6xl px-6"><div className="grid gap-10 rounded-[32px] border border-[#d4c4ad] bg-[#fffaf0]/80 p-7 shadow-[0_24px_70px_rgba(84,61,43,.08)] md:p-12 lg:grid-cols-[.82fr_1.18fr]"><div><p className="eyebrow"><Headphones size={14} /> {t('voice.eyebrow')}</p><h2 className="font-serif text-4xl leading-tight text-[#392f28]">{t('voice.title').split('\n').map((line, i) => <span key={i}>{line}{i < t('voice.title').split('\n').length - 1 ? <br /> : null}</span>)}</h2><p className="mt-5 max-w-md leading-7 text-[#726458]">{t('voice.copy1')}<br />{t('voice.copy2')}</p></div><div className="rounded-[26px] bg-[#3b4e45] p-6 text-[#f8f0df] md:p-8">{voice ? <><div><p className="text-[10px] uppercase tracking-[.2em] text-[#d7a583]">{voice.label}</p><h3 className="mt-2 font-serif text-2xl">{voice.language}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-white/65">{voice.note}</p></div>{voice.src ? <><audio key={person.id} className="archive-audio mt-8 w-full" controls preload="metadata"><source src={voice.src} type="audio/mpeg" />Your browser does not support embedded audio.</audio><div className="mt-5 flex flex-wrap gap-2"><span className="audio-pill">{voice.duration}</span><span className="audio-pill">{t('voice.transcript')} included</span><span className="audio-pill">{t('life.hometown.born')} in this voice</span></div>{voice.transcript && <details className="mt-6 rounded-2xl border border-white/15 bg-black/10 p-4"><summary className="cursor-pointer text-sm text-[#f4e6d0]">{t('voice.transcript')}</summary><p lang="zh-CN" className="mt-4 text-sm leading-7 text-white/70">{voice.transcript}</p></details>}</> : <div className="mt-8 rounded-2xl border border-white/15 bg-black/10 p-5 text-sm leading-6 text-white/65">{labelEmpty}</div>}</> : <div className="rounded-2xl border border-white/15 bg-black/10 p-5 text-sm leading-6 text-white/65">{labelEmpty}</div>}</div></div>{collections?.length ? <div className="mt-20"><div className="mx-auto max-w-2xl text-center"><p className="justify-center eyebrow"><Sparkles size={14} /> {t('voice.collections.title')}</p><h2 className="font-serif text-4xl text-[#392e27] md:text-5xl">{t('family.title').split('\n')[0]}</h2></div><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">{collections.map((item, index) => <a key={item.title} href={['#profile', '#story', '#letter', '#voice'][index]} className="process-card group block"><p className="font-serif text-4xl text-[#9c4b40]">{item.count}</p><div className="mt-6 flex items-center justify-between gap-3"><h3 className="font-serif text-xl text-[#43362e]">{item.title}</h3><ChevronRight size={18} className="text-[#a88670] transition-transform group-hover:translate-x-1" /></div><p className="mt-3 text-sm leading-6 text-[#7b6b5f]">{item.copy}</p></a>)}</div></div> : null}</div></section>;
}

function FamilyMoments({ person, t }: { person: PersonArchiveViewModel; t: (k: string, v?: Record<string, string | number>) => string }) {
  const posts: MomentPost[] = person.moments?.length
    ? person.moments
    : (person.perspectives ?? []).map((view, index) => ({ id: `${person.id}-${index}`, author: view.speaker, relation: view.relationship, time: view.source, text: view.text, likes: 6 + index * 5, comments: [] }));
  const [draft, setDraft] = useState('');
  const [sharedPosts, setSharedPosts] = useState<MomentPost[]>([]);

  const shareMemory = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setSharedPosts((current) => [{ id: `shared-${Date.now()}`, author: 'You', relation: t('person.relation.other'), time: 'Just now', text, likes: 0, comments: [] }, ...current]);
    setDraft('');
  };

  return <section id="moments" className="moments-section py-24 md:py-28">
    <div className="mx-auto max-w-7xl px-6">
      <div className="grid gap-10 lg:grid-cols-[.62fr_1.38fr]">
        <div className="lg:sticky lg:top-28 lg:self-start"><p className="eyebrow"><MessageCircleMore size={15} /> {t('moments.eyebrow')}</p><h2 className="font-serif text-5xl leading-tight text-[#382e27] md:text-6xl">{t('moments.title').split('\n').map((line, i) => i === 1 ? <em key={i} className="font-normal text-[#9c4b40]">{line}</em> : <span key={i}>{line}{i < t('moments.title').split('\n').length - 1 ? <br /> : null}</span>)}</h2><p className="mt-6 max-w-md text-base leading-8 text-[#746458]">{t('moments.copy')}</p>
          <form onSubmit={shareMemory} className="mt-9 rounded-[26px] border border-[#d6c5ae] bg-[#fffaf0]/85 p-5 shadow-[0_18px_50px_rgba(76,55,39,.08)]"><label htmlFor="memory-draft" className="text-xs font-semibold uppercase tracking-[.17em] text-[#945347]">{t('moments.ctaShare')}</label><textarea id="memory-draft" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('moments.placeholderText', { name: person.name })} className="mt-4 min-h-28 w-full resize-none rounded-2xl border border-[#ddcfbd] bg-white/55 p-4 text-sm leading-6 text-[#50433a] outline-none transition focus:border-[#a65a4d]" /><div className="mt-3 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-xs text-[#907d6d]"><Plus size={14} /> {t('moments.placeholderAuthor')}</span><Button type="submit" disabled={!draft.trim()} className="rounded-full bg-[#9f5044] px-5 text-[#fff8ec] hover:bg-[#884238]"><Send size={14} /> {t('moments.submit')}</Button></div></form>
        </div>
        <div className="space-y-5">{sharedPosts.map((post) => <MomentCard key={post.id} post={post} person={person} t={t} />)}{posts.map((post) => <MomentCard key={post.id} post={post} person={person} t={t} />)}</div>
      </div>
    </div>
  </section>;
}

function MomentCard({ post, person, t }: { post: MomentPost; person: PersonArchiveViewModel; t: (k: string, v?: Record<string, string | number>) => string }) {
  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const ownPost = post.author === person.name;
  return <article className="moment-card">
    <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border border-[#d4c2ab] bg-[#eee0cd] font-serif text-[#8f4c42]">{ownPost && person.avatar ? <img src={person.avatar} alt="" className="size-full object-cover" /> : post.author.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><div><h3 className="font-serif text-xl text-[#43372f]">{post.author}</h3><p className="mt-0.5 text-[11px] uppercase tracking-[.13em] text-[#9a7e69]">{post.relation}</p></div><time className="text-xs text-[#9b8a7c]">{post.time}</time></div><p className="mt-5 text-[15px] leading-7 text-[#66574c]">{post.text}</p>{post.image && <img src={post.image} alt={`A remembered scene shared by ${post.author}`} className="mt-5 aspect-video w-full rounded-[22px] object-cover" />}
      <div className="mt-5 flex items-center gap-5 border-t border-[#e0d3c1] pt-4"><button type="button" onClick={() => setLiked((value) => !value)} aria-pressed={liked} className={`moment-action ${liked ? 'is-liked' : ''}`}><Heart size={17} fill={liked ? 'currentColor' : 'none'} />{post.likes + (liked ? 1 : 0)}</button><button type="button" onClick={() => setShowComments((value) => !value)} aria-expanded={showComments} className="moment-action"><MessageCircle size={17} />{post.comments.length || t('moments.postComment')}</button><span className="ml-auto text-[11px] text-[#a08f80]">Kept with {person.name}</span></div>
      {showComments && <div className="mt-4 space-y-3 rounded-2xl bg-[#f2e8da] p-4">{post.comments.length ? post.comments.map((comment) => <p key={`${post.id}-${comment.author}`} className="text-sm leading-6 text-[#67584d]"><strong className="font-semibold text-[#8e4d43]">{comment.author}</strong> · {comment.text}</p>) : <p className="text-sm text-[#8a7869]">{t('moments.commentsEmpty')}</p>}</div>}
    </div></div>
  </article>;
}

function PersonNode({ person, selected, onSelect, t }: { person: ArchivePersonCard; selected: boolean; onSelect: (id: string) => void; t: (k: string, v?: Record<string, string | number>) => string }) { const name = person.name || t('common.unknown'); const years = person.years || t('common.unknown'); return <Button type="button" variant="ghost" onClick={() => onSelect(person.id)} className={`person-node h-auto justify-start whitespace-normal ${selected ? 'is-selected' : ''}`} aria-pressed={selected}><span className="avatar-ring overflow-hidden" style={{ '--avatar-color': person.color ?? '#9c8a75' } as React.CSSProperties}>{person.avatar ? <img src={person.avatar} alt="" className="size-full object-cover" /> : <span>{(person.chinese || person.name).slice(-1) || '?'}</span>}</span><span className="min-w-0 flex-1 text-left"><span className="block truncate font-serif text-[15px] text-[#3c322b]">{name}</span><span className="block text-[10px] uppercase tracking-[.12em] text-[#927d6c]">{years} · {person.status}</span></span><ChevronRight size={14} className="text-[#a48d78]" /></Button>; }
function MemoryFilm({ person, film, t }: { person: PersonArchiveViewModel; film: FilmViewModel; t: (k: string, v?: Record<string, string | number>) => string }) {
  if (film.src) return <div className="relative aspect-video overflow-hidden rounded-[28px] border border-white/15 bg-[#21342d] shadow-[0_30px_80px_rgba(20,27,24,.3)]"><video className="size-full object-cover" controls preload="metadata" poster={film.poster}><source src={film.src} type="video/mp4" />{film.captions ? <track kind="subtitles" src={film.captions} srcLang="en" label="English" default /> : null}Your browser does not support embedded video.</video><span className="pointer-events-none absolute left-5 top-5 rounded-full border border-white/25 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[.2em]">Life film · {film.duration ?? ''}</span></div>;
  return <div className="video-frame relative aspect-video overflow-hidden rounded-[28px] border border-white/15 shadow-[0_30px_80px_rgba(20,27,24,.3)]"><div className="absolute inset-0 bg-gradient-to-t from-[#17241f]/90 via-[#17241f]/25 to-black/10" /><div className="absolute inset-0 grid place-items-center"><span className="grid size-16 place-items-center rounded-full border border-white/30 bg-[#f4e9d3] text-[#8f483d]"><Play className="ml-1" size={24} /></span></div><div className="absolute bottom-6 left-7"><p className="font-serif text-2xl">{person.storyTitle ?? person.name}</p><p className="mt-2 text-xs uppercase tracking-[.16em] text-white/60">{t('film.empty.status')}</p></div></div>;
}
function SourcePill({ icon: Icon, text }: { icon: typeof Mic2; text: string }) { return <span className="inline-flex items-center gap-2 rounded-full border border-[#d8c9b4] bg-white/50 px-3 py-2"><Icon size={13} className="text-[#9b5549]" />{text}</span>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#ded0bd] bg-[#fffaf0]/70 p-4"><p className="text-[9px] font-semibold uppercase tracking-[.17em] text-[#9a816d]">{label}</p><p className="mt-2 text-sm leading-5 text-[#50443a]">{value}</p></div>; }
function SectionLabel({ icon: Icon, text }: { icon: typeof Sparkles; text: string }) { return <p className="eyebrow"><Icon size={14} />{text}</p>; }
function MediaStat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/15 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-[.17em] text-white/50">{label}</p><p className="mt-1.5 text-sm text-[#f4ead9]">{value}</p></div>; }

function WelcomeCover({ switcher, t }: { switcher: React.ReactNode; t: (k: string, v?: Record<string, string | number>) => string }) {
  return <section id="welcome" className="welcome-cover" aria-labelledby="welcome-title">
    <div className="welcome-image" aria-hidden="true" />
    <div className="welcome-shade" aria-hidden="true" />
    <div className="welcome-grain" aria-hidden="true" />
    <div className="welcome-orbit orbit-one" aria-hidden="true" />
    <div className="welcome-orbit orbit-two" aria-hidden="true" />

    <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[1440px] flex-col px-6 pb-8 pt-7 md:px-10 md:pb-10 md:pt-9">
      <div className="flex items-center justify-between text-[#f8efdf]">
        <a href="#welcome" className="flex items-center gap-3" aria-label={t('nav.home')}>
          <span className="grid size-11 place-items-center rounded-full border border-white/25 bg-[#a64f43]/85 shadow-[0_10px_30px_rgba(0,0,0,.18)] backdrop-blur"><Flower2 size={21} strokeWidth={1.6} /></span>
          <div><p className="font-serif text-xl font-semibold tracking-[.12em]">Everroot</p><p className="text-[9px] uppercase tracking-[.3em] text-white/60">{t('nav.tagline')}</p></div>
        </a>
        {switcher}
      </div>

      <div className="my-auto max-w-[760px] py-20 text-[#fff8ea]">
        <p className="welcome-kicker"><span /> {t('welcome.eyebrow')}</p>
        <h1 id="welcome-title" className="welcome-title">{t('welcome.title.part1')}<br /><em>{t('welcome.title.part2')}</em></h1>
        <p className="mt-7 max-w-[620px] text-base leading-8 text-[#eee5d8]/88 md:text-lg md:leading-9">{t('welcome.copy')}</p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <a href="#family" className="welcome-primary">{t('welcome.cta.archive')} <ChevronRight size={17} /></a>
          <a href="#chatting" className="welcome-secondary welcome-secondary--chat">{t('welcome.cta.chat')} <MessageCircle size={16} /></a>
          <a href="#memory-promise" className="welcome-secondary">{t('welcome.cta.memory')} <ArrowDown size={16} /></a>
        </div>
      </div>

      <div id="memory-promise" className="welcome-promise">
        <div><span className="promise-number">01</span><p><strong>{t('welcome.promise.1.title')}</strong><small>{t('welcome.promise.1.copy')}</small></p></div>
        <div><span className="promise-number">02</span><p><strong>{t('welcome.promise.2.title')}</strong><small>{t('welcome.promise.2.copy')}</small></p></div>
        <div><span className="promise-number">03</span><p><strong>{t('welcome.promise.3.title')}</strong><small>{t('welcome.promise.3.copy')}</small></p></div>
      </div>
    </div>

    <a href="#family" className="welcome-scroll" aria-label={t('welcome.scroll')}><span>{t('welcome.scroll')}</span><ArrowDown size={15} /></a>
  </section>;
}

type ChatMsg = { id: number; role: 'user' | 'assistant'; text: string; created_at: string };
type ChatProject = { id: number; subject_name: string; chinese_name: string | null; display_name: string | null; pinned: boolean; archive_status: string };
type ChatSession = { id: number; started_at: string };

async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}
async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
async function apiPatch<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function ChattingSection({ family, t, onDataChanged }: { family: FamilyArchiveViewModel; t: (k: string, v?: Record<string, string | number>) => string; onDataChanged?: (fid?: number) => void }) {
  const [projects, setProjects] = useState<ChatProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newChinese, setNewChinese] = useState('');
  const [newBirth, setNewBirth] = useState('');
  const [creating, setCreating] = useState(false);

  const [showOrchestrate, setShowOrchestrate] = useState(false);

  const scrollBottom = () => {
    setTimeout(() => {
      const el = streamRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
  };

  const reloadProjects = async () => {
    setLoadingProjects(true);
    setProjectError(null);
    try {
      const list = await apiGet<ChatProject[]>('/api/projects');
      setProjects(list);
      if (!activeProjectId && list[0]) await openProject(list[0].id);
    } catch (e: any) {
      setProjectError(e?.message ?? '');
    } finally {
      setLoadingProjects(false);
    }
  };

  const openProject = async (pid: number) => {
    setActiveProjectId(pid);
    try {
      const detail = await apiGet<any>(`/api/projects/${pid}`);
      const sessionId = detail?.session_id ?? null;
      setActiveSessionId(sessionId);
      const msgs = (detail?.messages ?? []).map((m: any, i: number): ChatMsg => ({
        id: i + 1,
        role: m.role === 'interviewer' || m.role === 'assistant' ? 'assistant' : 'user',
        text: m.text ?? '',
        created_at: m.created_at ?? new Date().toISOString(),
      }));
      setMessages(msgs);
      scrollBottom();
    } catch (e: any) {
      setActiveSessionId(null);
      setMessages([]);
    }
  };

  const createProject = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await apiPost<any>('/api/projects', {
        subject_name: newName.trim(),
        chinese_name: newChinese.trim() || null,
        birth_year: newBirth ? Number(newBirth) : null,
      });
      setNewName(''); setNewChinese(''); setNewBirth(''); setShowCreate(false);
      await reloadProjects();
      onDataChanged?.();
      if (res?.project_id) await openProject(res.project_id);
    } finally {
      setCreating(false);
    }
  };

  const pinProject = async (pid: number) => {
    try { await apiPost(`/api/projects/${pid}/pin`); await reloadProjects(); } catch {}
  };
  const deleteProject = async (pid: number) => {
    if (!confirm(t('chat.people.confirmDelete'))) return;
    try { await fetch(`${API}/api/projects/${pid}`, { method: 'DELETE' }); if (activeProjectId === pid) { setActiveProjectId(null); setActiveSessionId(null); setMessages([]); } await reloadProjects(); onDataChanged?.(); } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeProjectId || !activeSessionId || sending) return;
    const userText = input.trim();
    setInput('');
    setSending(true);
    const now = new Date().toISOString();
    const userMsg: ChatMsg = { id: Date.now(), role: 'user', text: userText, created_at: now };
    setMessages((m) => [...m, userMsg]);
    scrollBottom();
    try {
      const resp = await apiPost<any>('/api/interview/turn', {
        project_id: activeProjectId, session_id: activeSessionId, answer: userText,
      });
      const reply: ChatMsg = {
        id: Date.now() + 1, role: 'assistant',
        text: resp?.next_question ?? '',
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, reply]);
      scrollBottom();
    } catch (e: any) {
      const fail: ChatMsg = { id: Date.now() + 1, role: 'assistant', text: t('chat.chat.fail', { msg: e?.message ?? '' }), created_at: new Date().toISOString() };
      setMessages((m) => [...m, fail]);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    reloadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section id="chatting" className="chatting-shell">
      <div className="mx-auto flex max-w-[1520px] flex-col gap-4 px-4 pb-12 pt-10 md:px-8 lg:pb-20 lg:pt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-[#9b5549]"><MessageCircleMore size={14} /> {t('chat.eyebrow')}</p>
            <h2 className="mt-3 font-serif text-3xl leading-tight text-[#392f28] md:text-4xl">{t('chat.title')}</h2>
            <p className="mt-3 max-w-[680px] text-sm leading-7 text-[#6f6256] md:text-base">{t('chat.copy')}</p>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Button variant="outline" size="sm" onClick={() => reloadProjects()} className="gap-2"><ClipboardList size={14} />{t('chat.refresh')}</Button>
            <Button variant="default" size="sm" onClick={() => setShowOrchestrate((s) => !s)} className="gap-2">{showOrchestrate ? t('chat.closeOrchestrate') : t('chat.openOrchestrate')} <ChevronRight size={14} className={`transition-transform ${showOrchestrate ? 'rotate-90' : ''}`} /></Button>
          </div>
        </div>

        <div className="chatting-grid">
          {/* Left: people */}
          <aside className="chatting-col chatting-col--left">
            <div className="chatting-card chatting-card--left">
              <div className="flex items-center justify-between px-4 pt-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.17em] text-[#8d7967]"><Users size={14} /> {t('chat.people.title')}</p>
                <button onClick={() => setShowCreate((s) => !s)} className="grid size-8 place-items-center rounded-lg border border-[#d8c9b4] bg-white/50 text-[#8d7967] hover:bg-[#f3ecde]" aria-label={t('chat.people.newAria')}><Plus size={15} /></button>
              </div>
              {showCreate ? (
                <div className="mx-4 mt-3 rounded-xl border border-[#d8c9b4] bg-[#fffaf0]/70 p-3">
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('chat.create.placeholder.name')} className="chatting-input mb-2" />
                  <input value={newChinese} onChange={(e) => setNewChinese(e.target.value)} placeholder={t('chat.create.placeholder.zh')} className="chatting-input mb-2" />
                  <input value={newBirth} onChange={(e) => setNewBirth(e.target.value)} placeholder={t('chat.create.placeholder.birth')} inputMode="numeric" className="chatting-input mb-3" />
                  <div className="flex gap-2">
                    <Button disabled={creating || !newName.trim()} size="sm" onClick={createProject} className="flex-1">{creating ? t('chat.create.creating') : t('chat.create.submit')}</Button>
                    <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>{t('chat.create.cancel')}</Button>
                  </div>
                </div>
              ) : null}
              <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto px-4 pb-4">
                {loadingProjects ? <p className="px-2 py-4 text-xs text-[#8d7967]">{t('chat.people.loading')}</p> : null}
                {(!loadingProjects) && (projectError || projects.length === 0) ? (
                  <div className={`px-2 py-4 text-xs ${projectError ? 'text-red-700' : 'text-[#8d7967]'}`}>
                    {projectError && <span className="block mb-1">{projectError}</span>}
                    {projectError
                      ? <>{t('chat.people.error1')}<br />{t('chat.people.error2')}</>
                      : projects.length === 0 ? t('chat.people.empty') : null}
                  </div>
                ) : null}
                {[...projects]
                  .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
                  .map((p) => (
                    <button key={p.id} onClick={() => openProject(p.id)} className={`chatting-person ${activeProjectId === p.id ? 'is-active' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#392f28]">{p.chinese_name || p.display_name || p.subject_name}</p>
                          <p className="mt-0.5 truncate text-[11px] uppercase tracking-[.17em] text-[#8d7967]">#{p.id} · {p.subject_name}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#f1e5d1] px-2 py-0.5 text-[10px] text-[#7a5c42]">{p.archive_status}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-1">
                        <span className="chatting-person__pin" role="button" onClick={(e) => { e.stopPropagation(); pinProject(p.id); }} title={t('chat.people.pin')}>{p.pinned ? '↓' : '↑'}</span>
                        <span className="chatting-person__del" role="button" onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }} title={t('chat.people.delete')}>×</span>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </aside>

          {/* Middle: chat */}
          <section className="chatting-col chatting-col--mid">
            <div className="chatting-card chatting-card--mid">
              <div className="flex items-center justify-between border-b border-[#e8dcc6] px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#392f28]">{activeProjectId ? t('chat.chat.title.hasProject', { id: activeProjectId }) : t('chat.chat.title.noProject')}</p>
                  <p className="text-xs text-[#8d7967]">{activeSessionId ? t('chat.chat.sub.hasSession', { id: activeSessionId }) : t('chat.chat.sub.noSession')}</p>
                </div>
                <div className="flex items-center gap-2 md:hidden">
                  <Button variant="outline" size="sm" onClick={() => setShowOrchestrate((s) => !s)}>{showOrchestrate ? t('chat.closeOrchestrate') : t('chat.orchestrateToggle')}</Button>
                </div>
              </div>

              <div ref={streamRef} className="chatting-stream">
                {!activeProjectId ? (
                  <div className="grid h-full place-items-center px-6 py-16 text-center">
                    <div className="mx-auto grid size-14 place-items-center rounded-full bg-[#f1e5d1] text-[#a64f43]"><MessageCircle size={22} /></div>
                    <h3 className="mt-5 font-serif text-2xl text-[#392f28]">{t('chat.chat.emptyTitle')}</h3>
                    <p className="mt-3 max-w-[520px] text-sm leading-7 text-[#6f6256]">{t('chat.chat.emptyCopy')}</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="grid h-full place-items-center px-6 py-16 text-center">
                    <p className="max-w-[520px] text-sm leading-7 text-[#6f6256]">{t('chat.chat.noMessages')}</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {messages.map((m) => (
                      <li key={m.id} className={`chatting-msg ${m.role}`}>
                        <div className="chatting-msg__bubble">
                          <span className="chatting-msg__who">{t(m.role === 'user' ? 'chat.chat.role.user' : 'chat.chat.role.ai')}</span>
                          <p className="whitespace-pre-wrap text-[14.5px] leading-7 text-[#392f28]">{m.text || '…'}</p>
                        </div>
                      </li>
                    ))}
                    {sending ? <li className="chatting-msg assistant"><div className="chatting-msg__bubble chatting-msg--typing">{t('chat.chat.thinking')}</div></li> : null}
                  </ul>
                )}
              </div>

              <div className="border-t border-[#e8dcc6] bg-[#fbf6ea]/70 px-5 py-3">
                <div className="flex items-end gap-3">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    rows={2}
                    placeholder={activeProjectId ? t('chat.placeholder.hasProject') : t('chat.placeholder.noProject')}
                    disabled={!activeProjectId || sending}
                    className="chatting-textarea"
                  />
                  <Button onClick={sendMessage} disabled={!activeProjectId || sending || !input.trim()} className="h-11 gap-2 bg-[#a64f43] hover:bg-[#95423a]"><Send size={15} /> {t('chat.send')}</Button>
                </div>
                <p className="mt-2 text-[11px] text-[#8d7967]">{t('chat.disclaimer1', { api: API })}<br />{t('chat.disclaimer2')}</p>
              </div>
            </div>
          </section>

          {/* Right: family orchestration */}
          {showOrchestrate ? (
            <FamilyOrchestrator
              currentFamilyId={family.family.id}
              t={t}
              onDataChanged={onDataChanged}
              onClose={() => setShowOrchestrate(false)}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

const RELATION_TYPES = ['parent', 'child', 'spouse', 'sibling', 'grandparent', 'grandchild', 'other'] as const;

type OrchFamily = { id: number; name: string; member_count?: number };
type OrchProject = { id: number; subject_name: string; chinese_name: string | null; display_name: string | null; family_id: number | null };

function FamilyOrchestrator({
  currentFamilyId,
  t,
  onDataChanged,
  onClose,
}: {
  currentFamilyId: number;
  t: (k: string, v?: Record<string, string | number>) => string;
  onDataChanged?: (fid?: number) => void;
  onClose: () => void;
}) {
  const [families, setFamilies] = useState<OrchFamily[]>([]);
  const [projects, setProjects] = useState<OrchProject[]>([]);
  const [relationships, setRelationships] = useState<{ id: number; from_project_id: number; to_project_id: number; relation_type: string }[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<number | null>(currentFamilyId);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [relFrom, setRelFrom] = useState('');
  const [relTo, setRelTo] = useState('');
  const [relType, setRelType] = useState<string>('parent');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectName = (p: { id: number; subject_name: string; chinese_name: string | null; display_name: string | null }) =>
    p.chinese_name || p.display_name || p.subject_name || `#${p.id}`;

  const memberName = (id: number) => {
    const p = projects.find((x) => x.id === id);
    return p ? projectName(p) : `#${id}`;
  };

  const loadFamilies = async () => {
    try {
      const data = await apiGet<{ items: OrchFamily[] }>('/api/families?limit=50');
      setFamilies(data.items ?? []);
    } catch { /* keep existing list */ }
  };

  const loadProjects = async () => {
    try {
      const list = await apiGet<OrchProject[]>('/api/projects');
      setProjects(list);
    } catch { /* keep existing list */ }
  };

  const loadRelationships = async (fid: number) => {
    if (!fid) { setRelationships([]); return; }
    try {
      const data = await apiGet<{ relationships: { id: number; from_project_id: number; to_project_id: number; relation_type: string }[] }>(`/api/families/${fid}/tree`);
      setRelationships(data.relationships ?? []);
    } catch { setRelationships([]); }
  };

  useEffect(() => { loadFamilies(); loadProjects(); }, []);
  useEffect(() => {
    if (selectedFamilyId != null) loadRelationships(selectedFamilyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFamilyId]);

  const members = projects.filter((p) => p.family_id === selectedFamilyId);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e: any) { setError(e?.message ?? ''); }
    finally { setBusy(false); }
  };

  const createFamily = () => run(async () => {
    const name = newFamilyName.trim();
    if (!name) return;
    const fam = await apiPost<{ id: number }>('/api/families', { name });
    setNewFamilyName('');
    await loadFamilies();
    if (fam?.id) setSelectedFamilyId(fam.id);
  });

  const addToFamily = (pid: number) => run(async () => {
    if (!selectedFamilyId) return;
    await apiPatch(`/api/projects/${pid}`, { family_id: selectedFamilyId });
    await Promise.all([loadProjects(), loadRelationships(selectedFamilyId)]);
  });

  const removeFromFamily = (pid: number) => run(async () => {
    await apiPatch(`/api/projects/${pid}`, { family_id: null });
    await loadProjects();
    if (selectedFamilyId != null) await loadRelationships(selectedFamilyId);
  });

  const addRelationship = () => run(async () => {
    if (!selectedFamilyId || !relFrom || !relTo || relFrom === relTo) return;
    await apiPost(`/api/families/${selectedFamilyId}/relationships`, {
      from_project_id: Number(relFrom),
      to_project_id: Number(relTo),
      relation_type: relType,
    });
    setRelFrom('');
    setRelTo('');
    await loadRelationships(selectedFamilyId);
  });

  const generate = () => run(async () => {
    if (selectedFamilyId != null) onDataChanged?.(selectedFamilyId);
  });

  return (
    <aside className="chatting-col chatting-col--right">
      <div className="chatting-card chatting-card--right">
        <div className="flex items-center justify-between border-b border-[#e8dcc6] px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.17em] text-[#8d7967]"><Users size={14} /> {t('orch.title')}</p>
          <button onClick={onClose} className="grid size-7 place-items-center rounded-md text-[#8d7967] hover:bg-[#f1e5d1]" aria-label={t('chat.closeOrchestrate')}><X size={14} /></button>
        </div>

        <div className="orch-body px-4 pb-4 pt-3">
          <div className="orch-block">
            <label className="orch-label">{t('orch.family.title')}</label>
            <select className="chatting-input" value={selectedFamilyId ?? ''} onChange={(e) => setSelectedFamilyId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{t('orch.family.none')}</option>
              {families.map((f) => <option key={f.id} value={f.id}>{f.name}{f.member_count != null ? ` (${f.member_count})` : ''}</option>)}
            </select>
            <div className="mt-2 flex gap-2">
              <input className="chatting-input" value={newFamilyName} onChange={(e) => setNewFamilyName(e.target.value)} placeholder={t('orch.family.newName')} />
              <Button size="sm" disabled={busy || !newFamilyName.trim()} onClick={createFamily}>{t('orch.family.create')}</Button>
            </div>
          </div>

          <div className="orch-block">
            <label className="orch-label">{t('orch.members.title')}</label>
            {projects.length === 0 ? (
              <p className="orch-empty">{t('orch.members.empty')}</p>
            ) : (
              <div className="orch-list">
                {projects.map((p) => {
                  const inFamily = p.family_id === selectedFamilyId;
                  return (
                    <div key={p.id} className="orch-row">
                      <span className="orch-row__name">{projectName(p)}</span>
                      {inFamily
                        ? <button className="orch-chip is-in" onClick={() => removeFromFamily(p.id)} disabled={busy}>{t('orch.members.inFamily')}</button>
                        : <button className="orch-chip" onClick={() => addToFamily(p.id)} disabled={busy || !selectedFamilyId}>{t('orch.members.add')}</button>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="orch-block">
            <label className="orch-label">{t('orch.relationships.title')}</label>
            <div className="grid gap-2">
              <select className="chatting-input" value={relFrom} onChange={(e) => setRelFrom(e.target.value)}>
                <option value="">{t('orch.relationships.from')}</option>
                {members.map((p) => <option key={p.id} value={p.id}>{projectName(p)}</option>)}
              </select>
              <select className="chatting-input" value={relType} onChange={(e) => setRelType(e.target.value)}>
                {RELATION_TYPES.map((rt) => <option key={rt} value={rt}>{t(`person.relation.${rt}`)}</option>)}
              </select>
              <select className="chatting-input" value={relTo} onChange={(e) => setRelTo(e.target.value)}>
                <option value="">{t('orch.relationships.to')}</option>
                {members.map((p) => <option key={p.id} value={p.id}>{projectName(p)}</option>)}
              </select>
            </div>
            <Button size="sm" className="mt-2 w-full" disabled={busy || !selectedFamilyId || !relFrom || !relTo || relFrom === relTo} onClick={addRelationship}>{t('orch.relationships.add')}</Button>
            {relationships.length ? (
              <ul className="orch-rels mt-2">
                {relationships.map((r) => (
                  <li key={r.id} className="text-[11px] text-[#6f6256]">{memberName(r.from_project_id)} <span className="text-[#9c4b40]">{t(`person.relation.${r.relation_type}`)}</span> {memberName(r.to_project_id)}</li>
                ))}
              </ul>
            ) : (
              <p className="orch-empty">{t('orch.relationships.empty')}</p>
            )}
          </div>

          {error ? <p className="text-xs text-red-700">{error}</p> : null}

          <Button className="mt-1 w-full bg-[#a64f43] hover:bg-[#95423a]" disabled={busy || !selectedFamilyId} onClick={generate}>{busy ? t('orch.generate.busy') : t('orch.generate')}</Button>
        </div>
      </div>
    </aside>
  );
}
