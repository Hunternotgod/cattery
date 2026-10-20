import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 部署前把 SITE_URL 改成你的正式域名，例如 https://cattery.com
const site = process.env.SITE_URL || 'https://cattery.asia';

export default defineConfig({
  site,
  output: 'static',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});

