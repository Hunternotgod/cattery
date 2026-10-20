# cattery design direction

## Brief

A personal portfolio for 肥猫叉烧, built as a cyberpunk esports room for three character companions: an orange cat engineer, a pink pig boss, and a red/white corgi troublemaker. The site should feel like an authored game scene, not a generic blog template.

## Concept

**A neon room for a small life.** The homepage is a dark esports studio with a cyberpunk river window, gaming desk, RGB hardware, shelves, and a character on every station. The 2D layer is dark glass and neon UI; the light theme is the room with the lights on.

## Tokens

| Role | Dark neon | Lights on |
|---|---|---|
| Background | `#070A12` | `#0B1725` |
| Panel | `#0C1320` | `#132335` |
| Text | `#E9F7FF` | `#F1FBFF` |
| Text soft | `#9BB0C5` | `#B3C8D8` |
| Cyan | `#4DEBFF` | `#4DEBFF` |
| Magenta | `#FF3EA5` | `#FF3EA5` |
| Cat | `#FF9A3D` | `#FF9A3D` |
| Pig | `#FF6FAE` | `#FF6FAE` |
| Corgi | `#FF9A3D` + `#F4FBFF` | `#FF9A3D` + `#F4FBFF` |

## Type

- Display/UI: **Chakra Petch**.
- Body: **Public Sans Variable** + system Chinese sans.
- Code: system monospace.

## Layout And Camera

- Five homepage stations: establishing, cat workbench, pig shelf, corgi corner, about.
- Establishing shot shows all three characters.
- Station camera presets use character bounding boxes to frame the full body with 3/4 front views.
- Desktop characters sit in the open half beside the panel; compact layouts put them above a collapsible bottom panel.

## Characters

- **Cat engineer**: chubby orange cat, white muzzle/chest/paws, goggles, cap, cyan collar.
- **Pig boss**: round pink pig, tie, clipboard, lighter belly.
- **Corgi troublemaker**: orange back/head/ears and eye sides; white blaze from forehead to muzzle, white chest/belly, white front legs and paws; cyan collar.

## Room And Lighting

- Dark walls, acoustic panels, LED strips, gaming desk, triple monitors, RGB PC tower, bookshelf, rug, cat tree, plants, cables, rain and a cyberpunk river window.
- Dark mode: monitor/neon/window light, stronger bloom.
- Lights-on mode: ceiling and desk lights raise ambient warmth; window remains cyberpunk.
- Bloom, rain, shadows and pixel ratio scale down on mobile.

## Motion

- GSAP station camera transitions; idle character animations; pointer parallax; poke reactions.
- Collapsible mobile/tablet panels with accessible controls.
- `prefers-reduced-motion` disables camera/motion and exposes all panel content.

## Constraints

- No runtime backend.
- Gitee latest release API is used only for the download button; a synced direct URL is the fallback.
- Tripo GLB generation is future work and requires `TRIPO_API_KEY`; procedural characters are the current source.
