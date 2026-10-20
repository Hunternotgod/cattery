import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { PROJECT_STATUSES } from './data/projects';

const notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    cover: z.string().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    summary: z.string(),
    role: z.string(),
    year: z.string(),
    status: z.enum(PROJECT_STATUSES).default('active'),
    stack: z.array(z.string()).default([]),
    links: z
      .object({
        repo: z.string().url().optional(),
        download: z.string().url().optional(),
        demo: z.string().url().optional(),
      })
      .default({}),
    screenshots: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string(),
          caption: z.string().optional(),
        }),
      )
      .default([]),
    cover: z.string().optional(),
    featured: z.boolean().default(false),
    order: z.number().default(0),
    draft: z.boolean().default(false),
  }),
});

export const collections = { notes, projects };
