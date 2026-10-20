import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '../consts';
import { getPublishedPosts, postHref } from '../utils/posts';

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();
  const site = context.site ?? new URL('https://catbok.example.com');

  return rss({
    title: SITE.title,
    description: SITE.description,
    site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: new URL(postHref(post), site).href,
    })),
    customData: `<language>zh-cn</language>`,
  });
}
