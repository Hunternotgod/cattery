import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '../data/site';
import { getPublishedNotes, noteHref } from '../utils/notes';

export async function GET(context: APIContext) {
  const notes = await getPublishedNotes();
  const site = context.site ?? new URL('https://cattery.example.com');

  return rss({
    title: SITE.title,
    description: SITE.description,
    site,
    items: notes.map((note) => ({
      title: note.data.title,
      pubDate: note.data.pubDate,
      description: note.data.description,
      link: new URL(noteHref(note), site).href,
    })),
    customData: `<language>zh-cn</language>`,
  });
}


