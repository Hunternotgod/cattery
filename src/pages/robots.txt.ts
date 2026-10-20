import type { APIContext } from 'astro';

export function GET({ site }: APIContext) {
  const base = site ?? new URL('https://catbok.example.com');
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap-index.xml', base).href}\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
