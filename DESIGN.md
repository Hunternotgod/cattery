# cattery design direction

## Brief

A personal blog for Chinese readers, written by someone who codes and lives with cats. The site should feel like an independent publication, not a template: quiet enough to read for a long time, but with one memorable visual idea.

## Concept

**A catalogue of a small life.** The blog is presented as a precise, well-kept index: dates, titles, topics, and short notes laid out like a printed catalogue. The cat motif appears once, strongly, as a geometric cat-eye mark rather than as cute decoration everywhere.

## Tokens

| Role | Light | Dark |
|---|---|---|
| Paper | `#F1F2ED` | `#101116` |
| Raised paper | `#FBFBF7` | `#181A1F` |
| Ink | `#16171A` | `#F1F2ED` |
| Ink soft | `#5D6168` | `#B6BAC0` |
| Ink faint | `#686C73` | `#9A9FA7` |
| Line | `#D7D9D2` | `#2A2D33` |
| Cobalt | `#2B4BFF` | `#8D9EFF` |
| Mint | `#BDF4E4` | `#1E3A34` |
| Mint soft | `#E4FBF5` | `#182B27` |

## Type

- Display and UI: **Space Grotesk Variable**, self-hosted through Fontsource.
- Chinese body: system sans (`PingFang SC`, `Hiragino Sans GB`, `Microsoft YaHei`, `Noto Sans SC`).
- Code: system monospace.
- Body size 17–18px, line-height 1.85; article line length capped around 700px.

## Layout

- 12-column editorial grid, max width 1200px.
- Asymmetric hero: oversized wordmark on the left, cat-eye composition on the right.
- Posts are index rows, not cards: date / title + description / reading time + tags.
- Article pages use a 700px reading column plus a slim TOC rail.
- Archive uses a large year marker beside its list.

## Signature

- Geometric cat-eye mark, used in the header, favicon, and hero.
- The hero eye blinks once on load; this is the only non-user-triggered motion.
- Cobalt is the single accent; mint is a surface, not a second brand color.
- No warm cream + terracotta, no uppercase eyebrows, no pill-shaped card grid, no arrow appended to every link.

## Interaction

- Nav links grow a cobalt underline on hover.
- Post rows highlight with a mint wash; the title turns cobalt.
- Theme toggle rotates its icon and preserves the choice in `localStorage`.
- All motion is disabled under `prefers-reduced-motion`.

