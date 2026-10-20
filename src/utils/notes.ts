import { getCollection, type CollectionEntry } from 'astro:content';

export type Note = CollectionEntry<'notes'>;

export async function getPublishedNotes(): Promise<Note[]> {
  const notes = await getCollection('notes', ({ data }) => !data.draft);
  return sortNotes(notes);
}

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}

export function formatDate(date: Date, style: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: style === 'long' ? 'long' : '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatDateDot(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}.${get('month')}.${get('day')}`;
}

export function formatMonthDayDot(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('month')}.${get('day')}`;
}

export function readingTime(body: string): number {
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~\-|]/g, ' ');
  const chineseChars = (plain.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const words = (plain.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length;
  return Math.max(1, Math.ceil(chineseChars / 400 + words / 200));
}

export function getAllTags(notes: Note[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const note of notes) {
    for (const tag of note.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'),
  );
}

export function tagHref(tag: string): string {
  return `/tags/${encodeURIComponent(tag)}/`;
}

export function noteHref(note: Note): string {
  return `/notes/${note.id}/`;
}
