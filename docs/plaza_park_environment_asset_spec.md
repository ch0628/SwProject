# Plaza & Park Environment Asset Specification

> Status: **Approved Source of Truth**
>
> Scope: SWfestival ML prototype — Plaza & Park environment graphics
>
> Purpose: Define the visual asset, canvas, collision, layering, reuse, and validation rules for the Plaza & Park map.
>
> Important: **Visual graphics and gameplay collision/navigation are separate.**
> The latest `docs/map_plaza_park_spec.md` remains the source of truth for map coordinates, doors, structures, and waypoints.

---

# 1. Common Rules

## 1.1 Base Grid

- Tile size: **32 × 32 px**
- Pixel art assets are used at **1:1 source scale**
- Do not resize individual directions/objects ad hoc to make them fit
- PNG is the default format
- Transparent assets use **RGBA / Alpha**
- Pixel edges must remain crisp; no blur or unintended anti-aliasing

## 1.2 Visual Bounds vs Collision

Visual sprite bounds and physical collision are treated separately.

```text
Visual Sprite != Collision Shape
```

Examples:

- Tree canopy is large, but only the trunk area collides.
- Lamp is tall, but only the pole base collides.
- Building art does not define the building collision automatically.
- Manhole is visible but has no physical collision.

## 1.3 Depth / Ground Contact

Standing props use a bottom-center ground contact unless otherwise specified.

```text
origin = bottom-center
depth  = groundContactY
```

Low ground decorations such as flowers/manholes render below characters.

## 1.4 Shadows

Do not bake large directional shadows into environment assets.

Allowed:
- very small contact shadow when needed

Avoid:
- long sunlight shadows
- strong directional shadows
- baked nighttime lighting
- large glow effects

Lighting/effects should remain separable where possible.

## 1.5 CCTV Readability

Environment art must not dominate or obscure characters.

The environment may create short, natural occlusion, but must not create large permanent blind spots around the main CCTV gameplay routes.

---

# 2. Folder Structure

```text
assets/
└─ environment/
   ├─ terrain/
   │  ├─ grass/
   │  ├─ path/
   │  ├─ plaza/
   │  └─ road/
   │
   ├─ nature/
   │  ├─ trees/
   │  ├─ bushes/
   │  └─ flowers/
   │
   ├─ street/
   │  ├─ bench/
   │  ├─ lamp/
   │  └─ fence/
   │
   ├─ buildings/
   │  ├─ cafe/
   │  └─ public_facility/
   │
   └─ special/
      └─ manhole/
```

---

# 3. Terrain

## 3.1 Grass

Path:

```text
assets/environment/terrain/grass/
```

Files:

```text
grass_base.png
grass_detail_a.png
grass_detail_b.png
grass_detail_c.png
```

### `grass_base.png`

- Canvas: **32 × 32 px**
- Seamless / tileable on all four sides
- Collision: none
- Layer: Ground
- Natural, friendly green
- Low to medium contrast
- Low visual noise
- No flowers, rocks, branches, holes, or baked shadows

### Grass Detail A/B/C

- Canvas: **32 × 32 px**
- Transparent RGBA
- Collision: none
- Layer: Ground_Detail
- Used only to reduce visible repetition
- Recommended density: roughly **10–20% of grass tiles**
- Do not stack multiple details aggressively on one tile

Roles:

- A: small short grass blades
- B: subtle darker grass patch
- C: subtle brighter grass texture

### Validation

PASS when:

- exact 32×32 source dimensions
- seamless repetition has no obvious grid lines
- detail remains visually weaker than characters
- no large baked object/shadow is present

---

## 3.2 Park Path

Path:

```text
assets/environment/terrain/path/
```

Files:

```text
park_path_center.png

park_path_edge_top.png
park_path_edge_bottom.png
park_path_edge_left.png
park_path_edge_right.png

park_path_corner_tl.png
park_path_corner_tr.png
park_path_corner_bl.png
park_path_corner_br.png

park_path_inner_tl.png
park_path_inner_tr.png
park_path_inner_bl.png
park_path_inner_br.png
```

Total: **13 tiles**

### Common

- Each tile: **32 × 32 px**
- Collision: none
- Layer: Ground
- Material: warm light beige / light brown park walking path
- Low contrast, subtle texture
- No footprints, flowers, large stones, leaves, or strong directional pattern

### Composition

The same modular tiles are used for both:

- 2-tile Narrow/Special Path
- 3-tile Standard Public Walkway

No separate 2-tile/3-tile path graphic is created.

### Validation

Test at minimum:

- 3-tile horizontal
- 3-tile vertical
- 2-tile horizontal
- 2-tile vertical
- L-turn
- connector/junction

PASS when edges/corners connect cleanly and the path remains visually quiet beneath NPCs.

---

## 3.3 Plaza Paving

Path:

```text
assets/environment/terrain/plaza/
```

Files:

```text
plaza_paving_base.png
plaza_paving_variant_a.png
plaza_paving_variant_b.png

plaza_border_top.png
plaza_border_bottom.png
plaza_border_left.png
plaza_border_right.png

plaza_corner_tl.png
plaza_corner_tr.png
plaza_corner_bl.png
plaza_corner_br.png
```

Total: **11 tiles**

### Common

- Each tile: **32 × 32 px**
- Collision: none
- Layer: Ground
- Material: light warm-gray / slightly beige urban stone paving
- More urban and organized than Park Path
- No large logo/star/fountain floor motif in the plaza core

### Variants

Recommended distribution:

- Base: **75–85%**
- Variant A: **8–12%**
- Variant B: **8–12%**

Variants must look like the same material, with only subtle local texture differences.

### Border

- Visual boundary only
- May resemble a small curb/border stone
- Must not visually imply an impassable wall

### Validation

Large-area repetition must be checked, preferably at least 16×8 tiles and ideally near actual plaza scale.

PASS when:

- tile grid is not visually dominant
- variants do not stand out as special objects
- plaza is visually distinct from both Park Path and Main Route
- characters remain more visually salient

---

## 3.4 Main Route

Path:

```text
assets/environment/terrain/road/
```

Files:

```text
main_route_base.png
main_route_variant_a.png
main_route_variant_b.png
main_route_edge_top.png
main_route_edge_bottom.png
```

Total: **5 tiles**

### Common

- Each tile: **32 × 32 px**
- Collision: none
- Layer: Ground
- Represents a **wide urban pedestrian route**, not a vehicle road
- No lane markings, crosswalks, arrows, STOP text, or road numbers
- Tone: medium warm gray / slightly brown-gray
- Slightly darker and more utilitarian than Plaza Paving

Recommended distribution:

- Base: ~80%
- Variant A: ~10%
- Variant B: ~10%

No left/right edge or corner set is required for the current Plaza/Park map because the Main Route runs to the west/east map exits.

---

## 3.5 Separate Transition Tiles

**No separate generic Transition/Edge asset set is created.**

Existing Park Path edges, Plaza borders, and Main Route edges handle the current transitions.

If a specific junction later looks visually broken, add only the required exception tile rather than creating a large generic transition kit.

---

# 4. Buildings

## 4.1 Cafe

Path:

```text
assets/environment/buildings/cafe/
```

Files:

```text
cafe_base.png
cafe_foreground.png
```

### Canvas

Both files:

- **416 × 256 px**
- corresponds to 13 × 8 tiles
- transparent RGBA
- same canvas/alignment
- 32px grid alignment

### Map Placement

Latest approved visual area:

```text
X = 7 ~ 19
Y = 37 ~ 44
```

East-wall Door Opening:

```text
X = 19
Y = 40 ~ 41
width = 2 tiles = 64px
```

The visual doorway must agree with the 64px logical opening.

### Visual Direction

- friendly small-town animal cafe
- warm cream/beige walls
- warm brown structural elements
- muted warm accent such as red/orange awning
- windows with simple low-detail interior tone
- symbol/icon preferred over text signage

### Layer Split

`cafe_base.png`:
- building body
- walls
- windows
- base door frame
- most roof/body elements

`cafe_foreground.png`:
- forward awning/overhang
- small sign/foreground projection
- only elements that may need to render above a character near the entrance

### Collision

Building collision comes from the map logic, not the sprite.

```text
Building Graphic != Building Collision
```

### Excluded

- interior gameplay
- furniture
- food assets
- door animation
- complex sign text
- large baked shadows

---

## 4.2 Public Facility

Path:

```text
assets/environment/buildings/public_facility/
```

Files:

```text
public_facility_base.png
public_facility_foreground.png
```

### Canvas

Both files:

- **416 × 288 px**
- corresponds to 13 × 9 tiles
- transparent RGBA
- same canvas/alignment
- 32px grid alignment

### Map Placement

Latest approved visual area:

```text
X = 79 ~ 91
Y = 8 ~ 16
```

South Door Opening:

```text
X = 84 ~ 85
Y = 16
width = 2 tiles = 64px
```

Local horizontal doorway area:

```text
X = 5 ~ 6
```

within the 13-tile building canvas.

### Visual Direction

- friendly generic public/community facility
- more organized and civic than Cafe
- light stone / cream / light gray body
- muted blue-gray or desaturated teal accents
- central/south-facing entrance
- 2–4 relatively regular windows
- simple generic civic/community symbol
- no police/hospital/fire-specific symbolism

### Layer Split

`public_facility_base.png`:
- main structure
- walls/windows
- roof/body
- base entrance elements

`public_facility_foreground.png`:
- entrance canopy
- small foreground roof edge
- small sign/symbol projection where appropriate

### Excluded

- interior
- desk/staff/furniture
- door animation
- large steps
- institutional text signage
- strong glow
- large directional shadow

---

# 5. Nature Props

## 5.1 Tree

Path:

```text
assets/environment/nature/trees/
```

Files:

```text
tree_a.png
tree_b.png
```

### Common

- Canvas: **96 × 128 px**
- Visual size: about 3 × 4 tiles
- Origin: bottom-center
- Scale: 1:1
- Variant count: 2
- Animation: none

### Collision

Common collision for both variants:

```text
24 × 20 px
```

located at the bottom-center trunk/ground-contact area.

Do **not** collide against the full canopy.

### Depth

```text
depth = groundContactY
```

### Visual Direction

- same general tree family / world style
- A: rounder/wider canopy
- B: slightly more asymmetric/vertical canopy
- similar perceived scale
- medium/deep green, visually darker than grass
- warm brown trunk
- avoid dense leaf-by-leaf noise

### CCTV Constraint

Natural short occlusion is allowed.

Avoid trees that create large permanent blind spots or obscure an NPC's upper body for extended periods on important CCTV paths.

---

## 5.2 Bush

Path:

```text
assets/environment/nature/bushes/
```

Files:

```text
bush_a.png
bush_b.png
```

### Common

- Canvas: **64 × 48 px**
- Origin: bottom-center
- Scale: 1:1
- Variant count: 2
- **Impassable prop**
- Animation: none

### Collision

Common collision:

```text
36 × 18 px
```

at the bottom center.

### Placement Rule

Bush is an obstacle-style decoration placed in **non-traffic grass areas**.

Do not place it:

- inside 2-tile Narrow Paths
- inside 3-tile Standard Walkways
- on Door Openings
- on Door Approaches
- on/adjacent to critical Waypoints
- on the Main Route
- on Entry/Exit connectors

Prefer:

- grass margins
- fence areas
- beside trees in non-traffic zones
- building-side decoration zones
- park perimeter

As a default, preserve roughly **1 tile / 32px of breathing room** between bush collision and important walkable corridors where practical.

Do not form long continuous bush walls; use Fence when a real boundary is intended.

---

## 5.3 Flower Patch

Path:

```text
assets/environment/nature/flowers/
```

Files:

```text
flower_patch_a.png
flower_patch_b.png
flower_patch_c.png
```

### Common

- Canvas: **32 × 32 px**
- transparent RGBA
- collision: **none**
- interaction: none
- layer: Ground_Detail / Decoration_Low
- character renders above flower
- animation: none
- shadow: none

### Visual Bounds

Approximately:

```text
16~26px wide
10~20px tall
```

Do not fill the entire 32×32 tile.

### Variants

- A: small white/cream flowers
- B: muted yellow flowers
- C: soft pink/lavender flowers

Use low saturation relative to characters.

### Placement

Use in sparse clusters on grass and around trees/bushes/fences/benches.

Avoid:

- Main Route
- center of Plaza Paving
- Door Openings / Approaches
- critical Waypoints
- Narrow Path center
- Manhole overlap

---

# 6. Street Props

## 6.1 Bench

Path:

```text
assets/environment/street/bench/
```

File:

```text
bench.png
```

### Geometry

- Canvas: **96 × 48 px**
- Ground footprint: **96 × 32 px = 3 × 1 tiles**
- Origin: bottom-center
- Impassable
- Variant count: 1
- Horizontal orientation
- Animation: none

### Collision

```text
88 × 18 px
```

at the bottom center.

### Visual Direction

- simple friendly park bench
- warm wooden seat/back
- dark neutral metal/muted frame
- visually reusable in park/plaza/residential areas

### Future Seat Metadata

Define **2 seat points** for future sitting behavior, but do not activate them as normal navigation waypoints during current flow validation.

Approximate local positions:

```text
Seat A ≈ (30, 31)
Seat B ≈ (66, 31)
```

Exact Y may be adjusted slightly after final sprite validation.

Default sitting facing:

```text
Down
```

No sitting animation is required for the current prototype.

---

## 6.2 Lamp

Path:

```text
assets/environment/street/lamp/
```

Files:

```text
lamp_base.png
lamp_glow.png
```

### Base

- Canvas: **32 × 80 px**
- Origin: bottom-center
- Scale: 1:1
- Variant count: 1
- Impassable only at pole base
- daytime-neutral appearance

### Collision

```text
14 × 14 px
```

at the bottom center.

### Visual Direction

- friendly town/park street lamp
- reusable across Plaza/Park, Residential, Shopping
- muted neutral pole
- warm cream/pale-yellow lamp element
- should not look like AI/neon infrastructure

### Glow

`lamp_glow.png` is a separate optional visual effect aligned to the same lamp.

- disabled for ordinary daytime rendering
- available for later nighttime presentation
- no gameplay collision

### Placement

Prefer route/plaza edges rather than walkway centers.

Avoid:

- Narrow Path center
- Door Opening / Approach
- critical Waypoint
- Manhole overlap
- Bench seat/access path

---

## 6.3 Fence

Path:

```text
assets/environment/street/fence/
```

Files:

```text
fence_horizontal.png
fence_vertical.png

fence_corner_tl.png
fence_corner_tr.png
fence_corner_bl.png
fence_corner_br.png

fence_end_left.png
fence_end_right.png
fence_end_up.png
fence_end_down.png
```

Total: **10 tiles**

### Common

- Canvas: **32 × 32 px** per module
- low, friendly park/town fence
- soft blue / blue-toned visual direction approved
- intended as a true visible boundary
- no T-junction or cross-junction tile required for current prototype

### Collision

Horizontal module:

```text
32 × 8 px
```

Vertical module:

```text
8 × 32 px
```

Corner collision may be represented by the corresponding horizontal/vertical strip combination or equivalent map collision logic.

### Placement

Fence should communicate “not walkable” without occupying large visual volume.

Do not use Bush chains as a substitute for Fence.

---

# 7. Special Ground Object

## 7.1 Manhole

Path:

```text
assets/environment/special/manhole/
```

File:

```text
manhole_closed.png
```

### Common

- Canvas: **32 × 32 px**
- visual bounds: about **26–28 × 26–28 px**
- view: top-down
- collision: **none**
- normal navigation cost: same as normal ground
- layer: `Special_Ground` recommended
- renders below characters
- variant count: 1
- animation: none for current prototype
- shadow: none

### Interaction

Normal NPC:
- ignores manhole
- may freely walk over it

Special-behavior NPC:
- may select the manhole as a destination
- uses a dedicated interaction point at the **tile center**

Conceptually separate:

```text
Movement Waypoint
!=
Manhole Interaction Point
```

even if coordinates coincide.

Future `Open / Enter / Exit` assets and behavior are deferred until actually required.

---

# 8. Additional Ground Detail

For the current prototype, **no extra generic Ground Detail asset set is required** beyond:

- `grass_detail_a/b/c`
- `flower_patch_a/b/c`
- the approved terrain variants

Do not add rocks, litter, leaves, cracks, puddles, or stains merely to increase visual density.

Reason:
- current CCTV gameplay benefits from a visually quiet background
- existing details are enough to reduce obvious repetition
- additional noise can reduce character readability

Add exceptions later only if the rendered map visibly needs them.

---

# 9. Asset Summary

| Category | Assets |
|---|---:|
| Grass | 4 |
| Park Path | 13 |
| Plaza Paving | 11 |
| Main Route | 5 |
| Cafe | 2 |
| Public Facility | 2 |
| Tree | 2 |
| Bush | 2 |
| Flower | 3 |
| Bench | 1 |
| Lamp | 2 |
| Fence | 10 |
| Manhole | 1 |
| **Total** | **58** |

`lamp_glow.png` is an optional rendering layer but is counted as an asset.

---

# 10. Prototype Production Status

As of the current project state:

- Environment specifications above are approved.
- Environment images have already been created.
- Character base set is also available for all 5 species × male/female × 4 directions.
- Character animation is **not required** for the current functional prototype.
- The next environment task is **technical/visual asset validation**, not additional generation.

---

# 11. Environment Asset Validation Checklist

Before map integration, validate the created files against this specification.

## Technical

- [ ] filename matches specification
- [ ] PNG
- [ ] expected pixel dimensions
- [ ] Alpha present where required
- [ ] no accidental opaque background
- [ ] no unintended resize
- [ ] crisp pixel edges
- [ ] paired layers use identical canvas/alignment where required

## Visual

- [ ] same world/pixel-art style
- [ ] character readability preserved
- [ ] no overly strong baked shadow
- [ ] no unapproved text/logo
- [ ] object scale is plausible beside Tiger 80px
- [ ] tiles repeat without visible seams
- [ ] building doors visually match approved logical openings

## Gameplay Compatibility

- [ ] visual object does not imply a different collision than the approved logic
- [ ] Tree/Bush/Bench/Lamp collision footprint remains plausible
- [ ] Door graphics agree with map openings
- [ ] Flower/Manhole remain non-blocking
- [ ] Fence communicates true boundary
- [ ] important CCTV routes are not excessively occluded

---

# 12. Integration Rule

Do **not** modify approved Plaza/Park map geometry merely to make an environment image fit.

If an asset does not fit the approved map:

```text
Asset mismatch
→ fix/reprocess asset first
→ preserve map geometry
```

Only reconsider map coordinates if a genuine design defect is discovered and explicitly approved.

