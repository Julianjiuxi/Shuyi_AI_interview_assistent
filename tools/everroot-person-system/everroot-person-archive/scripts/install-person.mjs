#!/usr/bin/env node

import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

function argumentsFrom(argv) {
  const args = { replace: false, featured: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--replace') args.replace = true;
    else if (value === '--featured') args.featured = true;
    else if (value === '--input' || value === '--site') args[value.slice(2)] = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.input || !args.site) throw new Error('Usage: install-person.mjs --input PERSON.json --site WEBSITE [--featured] [--replace]');
  return args;
}

function requireString(object, key, context = 'person') {
  if (typeof object?.[key] !== 'string' || !object[key].trim()) throw new Error(`${context}.${key} must be a non-empty string`);
}

function requireStringArray(object, key, context = 'person') {
  if (!Array.isArray(object?.[key]) || object[key].length === 0 || object[key].some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${context}.${key} must be a non-empty string array`);
  }
}

function validate(person) {
  for (const key of ['id', 'name', 'chinese', 'years', 'role', 'relation', 'color', 'location', 'occupation', 'personality', 'personalityNote', 'overview', 'quote', 'storyTitle', 'storyDeck', 'letterTo']) requireString(person, key);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(person.id)) throw new Error('person.id must use lowercase letters, digits, and single hyphens');
  if (!['Living', 'Remembered'].includes(person.status)) throw new Error('person.status must be Living or Remembered');
  if (!/^#[0-9a-f]{6}$/i.test(person.color)) throw new Error('person.color must be a six-digit hexadecimal colour');
  for (const key of ['interests', 'smallThings', 'story', 'letter']) requireStringArray(person, key);
  if (!Array.isArray(person.timeline) || person.timeline.length === 0) throw new Error('person.timeline must contain at least one entry');
  person.timeline.forEach((item, index) => ['year', 'place', 'title', 'copy'].forEach((key) => requireString(item, key, `person.timeline[${index}]`)));
  if (!Array.isArray(person.perspectives) || person.perspectives.length === 0) throw new Error('person.perspectives must contain at least one attributed perspective');
  person.perspectives.forEach((item, index) => ['speaker', 'relationship', 'source', 'text'].forEach((key) => requireString(item, key, `person.perspectives[${index}]`)));
  for (const key of ['language', 'label', 'duration', 'note']) requireString(person.voice, key, 'person.voice');
  if (person.film) for (const key of ['duration', 'chapters', 'language', 'description']) requireString(person.film, key, 'person.film');
}

async function copyDeclaredFile({ source, inputDirectory, mediaDirectory, publicDirectory }) {
  if (!source) return undefined;
  const absoluteSource = resolve(inputDirectory, source);
  await access(absoluteSource);
  const filename = basename(absoluteSource);
  await copyFile(absoluteSource, resolve(mediaDirectory, filename));
  return `${publicDirectory}/${filename}`;
}

const args = argumentsFrom(process.argv.slice(2));
const inputPath = resolve(args.input);
const sitePath = resolve(args.site);
const inputDirectory = dirname(inputPath);
const person = JSON.parse(await readFile(inputPath, 'utf8'));
validate(person);

const mediaDirectory = resolve(sitePath, 'public', 'archive', person.id);
const publicDirectory = `/archive/${person.id}`;
await mkdir(mediaDirectory, { recursive: true });

person.featured = args.featured || Boolean(person.featured);
if (person.avatarFile) person.avatar = await copyDeclaredFile({ source: person.avatarFile, inputDirectory, mediaDirectory, publicDirectory });
delete person.avatarFile;

if (person.film?.sourceFile) person.film.src = await copyDeclaredFile({ source: person.film.sourceFile, inputDirectory, mediaDirectory, publicDirectory });
if (person.film?.posterFile) person.film.poster = await copyDeclaredFile({ source: person.film.posterFile, inputDirectory, mediaDirectory, publicDirectory });
if (person.film?.captionsFile) person.film.captions = await copyDeclaredFile({ source: person.film.captionsFile, inputDirectory, mediaDirectory, publicDirectory });
if (person.film) {
  delete person.film.sourceFile;
  delete person.film.posterFile;
  delete person.film.captionsFile;
  requireString(person.film, 'src', 'person.film');
}

if (person.voice?.sourceFile) person.voice.src = await copyDeclaredFile({ source: person.voice.sourceFile, inputDirectory, mediaDirectory, publicDirectory });
if (person.voice) delete person.voice.sourceFile;

const peoplePath = resolve(sitePath, 'data', 'people.json');
await access(peoplePath);
const people = JSON.parse(await readFile(peoplePath, 'utf8'));
if (!Array.isArray(people)) throw new Error('website/data/people.json must contain an array');
const existingIndex = people.findIndex((entry) => entry.id === person.id);
if (existingIndex >= 0 && !args.replace) throw new Error(`Person ${person.id} already exists; add --replace to update it intentionally`);
if (person.featured) people.forEach((entry) => { entry.featured = false; });
if (existingIndex >= 0) people[existingIndex] = person;
else people.push(person);
await writeFile(peoplePath, `${JSON.stringify(people, null, 2)}\n`);

console.log(`Installed ${person.name} (${person.id}) in ${sitePath}`);
