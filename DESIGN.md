# cattery design direction

## Brief

A personal portfolio for 肥猫叉烧, made for Chinese readers. It should feel like a small independent publication and a place you can walk into, not a template blog. The cat, pig, and corgi are permanent residents, not decoration.

## Concept

**A 3D room for a small life.** The homepage is a scroll-through studio: a cat engineer at the workbench, a pig boss at the bookshelf, and a corgi troublemaker in the notes corner. The 2D layer is screen-print inspired; the 3D characters are smooth cartoon objects living inside it.

## Tokens

| Role | Light | Dark |
|---|---|---|
| Paper | `#F2EBDD` | `#171310` |
| Raised paper | `#FAF4E8` | `#211B16` |
| Ink | `#191714` | `#F4EDE1` |
| Ink soft | `#5F5A52` | `#C9BFAE` |
| Ink faint | `#746D62` | `#A99E8D` |
| Line | `#D8CEBD` | `#3A2F26` |
| Tomato | `#D9472B` | `#FF6B4A` |
| Cat | `#F39A3D` | `#F5A44D` |
| Pig | `#F3A7B9` | `#F3A7B9` |
| Corgi | `#E8792B` | `#EF8A38` |
| Corgi cream | `#F7E8D4` | `#F7E8D4` |

## Type

- Display: **Archivo Variable**, 750–850 for the wordmark and headings.
- Body/UI: **Public Sans Variable** + system Chinese sans.
- Code: system monospace.
- Body size 17px, line-height 1.75; article column capped at 700px.

## Layout

- 3D room only on the homepage; all other pages use the same screen-print system without WebGL.
- Five homepage stations: entry, cat workbench, pig shelf, corgi notes, window/about.
- Sticky canvas with HTML paper panels in normal document flow.
- Project pages are long-form case studies; notes are index rows; archive uses large year markers.

## Characters

- **猫工程师**: orange cat, goggles and cap, workbench and 喵秘书.
- **猪老板**: pink pig, tie and clipboard, repo shelf and review.
- **柯基捣蛋鬼**: orange/cream corgi, scattered paper, notes and surprises.

## Motion

- GSAP ScrollTrigger drives the camera through the room.
- Idle loops: cat typing/tail, pig nodding, corgi bouncing.
- Pointer parallax on desktop.
- One tomato page-wipe transition; desktop cursor ring; primary CTA magnetic shift.
- `prefers-reduced-motion` disables all motion and shows the static poster.

## Constraints

- Mobile keeps the full 3D scene at lower quality; WebGL failure or sustained low performance falls back to the poster.
- No runtime Gitee request: the build reads a synced JSON snapshot.
- No comments, analytics, audio, or backend.
- All meaningful content must remain readable HTML.
