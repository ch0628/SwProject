# Floor 1 Rendering Contract — Orientation Prototype

Status: `VISUAL_APPROVAL_REQUIRED`

This prototype does not change or integrate with the approved Floor 1 gameplay map.

## Coordinate contract

- Gameplay remains Tiled orthogonal at 32×32 px.
- World X/Y, collision, navigation, transitions, and walkable footprints are unchanged.
- Rendering uses an orthographic 3/4 top-down faux-2.5D view; it does not transform gameplay coordinates.
- A visual sprite may extend north of its collision footprint.

## Asset contract

| Asset | Visual size | Footprint | Role |
|---|---:|---:|---|
| `F1_FLOOR_PUBLIC` | 64×64 | 64×64 | 2×2 gameplay-tile slab |
| `F1_FLOOR_SERVICE` | 64×64 | 64×64 | 2×2 gameplay-tile slab |
| `F1_WALL_H_BODY` | 32×64 | 32×32 | repeatable horizontal wall face and north overhang |
| `F1_WALL_V_TOP` | 32×48 | 32×32 | vertical-run cap and height cue |
| `F1_WALL_V_BODY` | 32×32 | 32×32 | continuous mass without repeated front face |
| `F1_WALL_V_BOTTOM` | 32×32 | 32×32 | vertical-run termination with one sparse status light |
| `F1_CORNER_INNER` | 32×64 | 32×32 | orthogonal H/V connection |
| `F1_CORNER_OUTER` | 32×64 | 32×32 | orthogonal H/V connection |
| `F1_DOOR_H` | 64×64 | 64×32 | recessed horizontal door |

The former single repeated `F1_WALL_V` module is not part of this contract. Only the top and bottom terminations express a strong height cue; the body stays visually continuous.

All wall modules share a 32 px footprint, bottom-aligned sprite anchor, south-edge depth baseline, cap at sprite Y 0, face above the footprint baseline, and exact image-edge joins. The 64 px door uses the same cap/face/baseline and reserves a centered 28 px transparent opening.

### Shared join coordinates

- Phaser wall origin: `(0, 1)` for every H/V/corner/door image.
- Horizontal joins: `(x, baseline)` and `(x + width, baseline)`.
- Vertical joins: `(x + 32, baseline - 32)` and `(x + 32, baseline)`.
- Top-left corner join: `(cornerX + 32, baseline)`.
- Prototype equality: `corner(96,144) = first H left(96,144) = first V top(96,144)`.
- Door equality: previous H right `(224,144) = door left`; door right `(288,144) = next H left`.

The corner is the vertical-run termination when H turns into V. `V_TOP` is reserved for a standalone vertical run and is not stacked after a corner; doing so previously duplicated its 16 px north overhang.

### Transparent padding audit

| Asset | Alpha bounds | Padding L/T/R/B |
|---|---|---|
| `F1_WALL_H_BODY` | `0,0 → 31,42` | `0/0/0/21` |
| `F1_WALL_V_TOP` | `0,0 → 31,47` | `0/0/0/0` |
| `F1_WALL_V_BODY` | `0,0 → 31,31` | `0/0/0/0` |
| `F1_WALL_V_BOTTOM` | `0,0 → 31,31` | `0/0/0/0` |
| Corners | `0,0 → 31,63` | `0/0/0/0` |
| `F1_DOOR_H` | `0,0 → 63,63` | `0/0/0/0` |

The H-wall bottom transparency is the intentional space below its elevated face, not a left/right join gap. Every join edge has zero transparent horizontal padding.
At a corner, H owns its visible edge rows `0..42`; the V branch owns the lower intersection rows. The shared corner pixel therefore follows V, rather than forcing transparent H padding over the vertical wall.

## Prototype collision contract

The independent scene builds five continuous Arcade static rectangles: two north-wall spans separated by the door opening, two vertical side walls, and one south wall. Adjacent segment footprints are merged so character collision cannot leak through visual joins. These colliders exist only in the prototype scene and do not modify the approved Floor 1 TMJ.

## Depth contract

```text
character depth    = character feet Y
architecture depth = collision footprint south baseline Y
```

Both use bottom-aligned anchors. A character with a smaller feet Y renders behind the architecture; a character with a larger feet Y renders in front. No global WallTop layer is forced above every character.

## Style contract

- Warm ivory and soft warm-gray form the dominant mass.
- Charcoal is limited to contact edges, recesses, glass, and base trim.
- Cyan is punctuation only; the repeatable horizontal and vertical body modules contain no cyan.
- Floor seams repeat at 64 px rather than every 32 px.
- Corners remain orthogonal connections, not hero machinery or diagonal geometry.

## Review route

Run `npm run dev` and open `/?mode=reinforcement-floor1-visual`.

- Move: WASD or arrow keys; the north-center doorway is the only room-shell exit
- Toggle footprint/baseline overlay: F
- Toggle solid logical geometry: G
- Toggle named join coordinates: J
- Deterministic startup view: append `&wallDebug=geometry`, `joins`, `footprints`, or `all`
- Reset: R

Do not apply these assets to the full Floor 1 map until visual approval.
