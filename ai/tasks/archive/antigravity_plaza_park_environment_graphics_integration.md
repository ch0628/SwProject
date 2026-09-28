# Antigravity Task ??Plaza/Park Environment Graphics Integration

## ëª©ì 

?„ì¬ ê²€ì¦??„ë£Œ??Plaza/Park Graybox êµ¬ì¡° ?„ì—
`assets/environment/`??Environment Graphicsë¥??¤ì œ ê²Œì„ ?”ë©´???µí•©?œë‹¤.

?´ë²ˆ ?‘ì—…?€ **Graphics Integration**?´ë‹¤.

?¤ìŒ?€ ?˜ì? ?ŠëŠ”??

```text
Traffic tuning
Fix5
Route ?˜ì •
Waypoint ?˜ì •
Collision ?˜ì •
Door Trigger ?˜ì •
Map Geometry ?˜ì •
CCTV Gameplay êµ¬í˜„
Shopping / Residential ?•ì¥
```

?„ì¬ Prototype Operating Density??

```text
10 active movers
```

?´ë©° ?´ë²ˆ ?‘ì—…?ì„œ ë³€ê²½í•˜ì§€ ?ŠëŠ”??

---

# 1. ë¨¼ì? ?½ì„ ?Œì¼

ë°˜ë“œ???„ë˜ ?œì„œë¡??½ëŠ”??

```text
ai/RULES.md
ai/WORKFLOW.md
ai/CONTEXT_MAP.md

docs/archive/session_handoff_plaza_park_2026-09-14.md
docs/shared/maps/map_plaza_park_spec.md
docs/archive/plaza_park_environment_graphics_start.md
docs/reference/plaza_park_environment_graphics_integration_spec.md

public/maps/plaza-park.tmj

src/PlazaParkScene.ts
src/plazaPark.ts
src/plazaTraffic.ts
```

ê·??¤ìŒ ?„ì¬ project??asset loading / rendering êµ¬ì¡°ë¥??•ì¸?˜ëŠ” ???„ìš”???Œì¼ë§?ìµœì†Œ?œìœ¼ë¡?ì¶”ê?ë¡??½ëŠ”??

?€ê·œëª¨ repository ?ìƒ‰?€ ?˜ì? ?ŠëŠ”??

---

# 2. Environment Asset Source

?„ì¬ Environment Asset Source:

```text
assets/environment/
```

êµ¬ì„±:

```text
buildings/
nature/
special/
street/
terrain/
```

ì´?PNG:

```text
58
```

`terrain/plaza.zip`?€ ?¬ìš©?˜ì? ?ŠëŠ”??

Vite/Phaser?ì„œ ?„ì¬ ê²½ë¡œë¥?ì§ì ‘ ?¬ìš©?????†ë‹¤ë©?
**ê¸°ì¡´ repository asset convention??ë¨¼ì? ?•ì¸**????ê°€???‘ì? ë°©ì‹?¼ë¡œ browser-loadable ?„ì¹˜???°ê²°?œë‹¤.

ê·œì¹™:

```text
?ë³¸ asset ?? œ ê¸ˆì?
?ë³¸ ?´ë?ì§€ resize ê¸ˆì?
?´ë?ì§€ ?¬ìƒ??ê¸ˆì?
?„ì˜ pixel ?˜ì • ê¸ˆì?
```

asset copyê°€ ?„ìš”?˜ë©´ ?ë³¸?€ ê·¸ë?ë¡??ê³ ,
ë³µì‚¬??ê²½ë¡œ?€ ?´ìœ ë¥?ìµœì¢… ë³´ê³ ??ëª…ì‹œ?œë‹¤.

---

# 3. ?ˆë? ? ì???Source of Truth

Graphics Integration ?„í›„ ?¤ìŒ?€ ?™ì¼?´ì•¼ ?œë‹¤.

```text
Map Size = 96 Ã— 56 tiles
Tile Size = 32 px

W01~W22
R1~R8
Collision Objects
Door Opening
Door Trigger
Door Approach
Upper Narrow
Lower Narrow
Main Walkway
Main Route
CCTV Coverage Geometry

10 active movers policy
```

?¹íˆ ?¤ìŒ ?Œì¼??Movement semanticsë¥?ë³€ê²½í•˜ì§€ ?ŠëŠ”??

```text
src/plazaTraffic.ts
```

ê°€?¥í•˜ë©??´ë‹¹ ?Œì¼?€ ?˜ì •?˜ì? ?ŠëŠ”??

---

# 4. êµ¬í˜„ ë°©ì‹ ?ì¹™

ê¸°ì¡´ map / renderer êµ¬ì¡°ë¥??•ì¸????**ê°€???‘ì? ë³€ê²½ìœ¼ë¡?Graphicsë¥??¹ëŠ”??**

?°ì„ ?œìœ„:

```text
ê¸°ì¡´ TMJ layer/object ?œìš©
??ê¸°ì¡´ Phaser map loader ?œìš©
???„ìš”??ìµœì†Œ renderer ì¶”ê?
```

ê¸ˆì?:

```text
??Graybox ?‘ì„±
??waypoint ?‘ì„±
ê¸°ì¡´ object ì¢Œí‘œ ?¬ë°°ì¹?collision box ?¬ì„¤ê³?ê¸°ì¡´ map region resize
```

Object ?„ì¹˜ê°€ ?´ë? TMJ??ì¡´ì¬?œë‹¤ë©?ë°˜ë“œ??ê·??„ì¹˜ë¥??¬ìš©?œë‹¤.

?•í™•???„ì¹˜ markerê°€ ?†ëŠ” decorative asset?€
?´ë²ˆ 1ì°?Integration?ì„œ **?„ì˜ ì¢Œí‘œë¥?ë§Œë“¤??ë°°ì¹˜?˜ì? ?ŠëŠ”??**

ê·?ê²½ìš°:

```text
SKIPPED ??no approved placement marker
```

ë¡?ë³´ê³ ?œë‹¤.

---

# 5. Layer ?•ì±…

?¤ìŒ ?˜ë?ë¥?? ì??œë‹¤.

```text
Ground
Ground_Detail
Object_Base
Characters
Foreground
Roof
Effects
```

repository???´ë? ?™ì¼ ?˜ë???layerê°€ ì¡´ì¬?˜ë©´
???´ë¦„??ë§Œë“¤ì§€ ë§ê³  ê¸°ì¡´ ê²ƒì„ ?¬ì‚¬?©í•œ??

## Ground

```text
grass_base
park_path_*
plaza_paving_*
plaza_border_*
main_route_*
```

## Ground_Detail

```text
grass_detail_*
flower_patch_*
manhole_closed
```

Ground detail?€ non-blocking?´ë‹¤.

## Y-sort Object

```text
tree_*
bush_*
bench
lamp_base
```

NPC?€ ê°™ì? ground-contact / feetY ê¸°ì??¼ë¡œ depthë¥?ê²°ì •?œë‹¤.

```text
depth = groundContactY
```

sprite top-left Yë¥?depthë¡??¬ìš©?˜ì? ?ŠëŠ”??

## Foreground

```text
cafe_foreground
public_facility_foreground
```

Charactersë³´ë‹¤ ?„ì— ?Œë”ë§í•œ??

## Effects

```text
lamp_glow
```

---

# 6. Building Integration

## Cafe

Source:

```text
assets/environment/buildings/cafe/cafe_base.png
assets/environment/buildings/cafe/cafe_foreground.png
```

Pixel size:

```text
416 Ã— 256
```

Map footprint:

```text
13 Ã— 8 tiles
X7~19
Y37~44
```

ê·œì¹™:

```text
scale = 1.0
resize ê¸ˆì?
base / foreground ?™ì¼ ê¸°ì? ?„ì¹˜
base ??Characters ?„ë˜
foreground ??Characters ??```

Door / Trigger / Approach geometry??ë³€ê²½í•˜ì§€ ?ŠëŠ”??

## Public Facility

Source:

```text
assets/environment/buildings/public_facility/public_facility_base.png
assets/environment/buildings/public_facility/public_facility_foreground.png
```

Pixel size:

```text
416 Ã— 288
```

Map footprint:

```text
13 Ã— 9 tiles
X79~91
Y8~16
```

Cafe?€ ?™ì¼ ?ì¹™.

---

# 7. Terrain Integration

## ê¸°ë³¸ World

ë¹„ë„ë¡?/ ë¹„ê´‘??ê¸°ë³¸:

```text
grass_base
```

## Park Path

ê¸°ì¡´ approved geometry?ë§Œ ?ìš©:

```text
Main Walkway
Upper Narrow
Lower Narrow
North Entry Connector
Park connectors
Park ??Plaza Transition
```

?¬ìš© ê°€??

```text
park_path_center
park_path_edge_*
park_path_corner_*
park_path_inner_*
```

path geometryë¥?Graphics ?Œë¬¸??ë³€ê²½í•˜ì§€ ?ŠëŠ”??

## Central Plaza

ê¸°ë³¸:

```text
plaza_paving_base
```

?¸ê³½:

```text
plaza_border_*
plaza_corner_*
```

Open Core???œê°?ìœ¼ë¡œë„ ?½í????œë‹¤.

## Main Route

ê¸°ë³¸:

```text
main_route_base
```

?¸ê³½:

```text
main_route_edge_top
main_route_edge_bottom
```

West / East Exitê°€ ëª…í™•???°ê²°?˜ì–´ ë³´ì—¬???œë‹¤.

---

# 8. Variant ê·œì¹™

Variant??geometry ë³€ê²½ì´ ?„ë‹ˆ??ë°˜ë³µê°??„í™”?©ì´??

runtime random ?¬ìš© ê¸ˆì?.

deterministic placementë§??ˆìš©?œë‹¤.

## Plaza

ëª©í‘œ ë¹„ìœ¨:

```text
base ??70%
variant_a ??15%
variant_b ??15%
```

??

- exact grid position??ê¸°ì¡´ TMJ / approved tile data?ì„œ ê²°ì •?˜ì? ?Šì•˜?¤ë©´
  1ì°?structural integration?ì„œ??`plaza_paving_base`ë§??¬ìš©?´ë„ ?œë‹¤.
- variantë¥??£ê¸° ?„í•´ ?„ì˜ ì¢Œí‘œ ëª©ë¡???ˆë¡œ ë§Œë“¤ì§€ ?ŠëŠ”??

## Main Route

?™ì¼:

```text
base ??70%
variant_a ??15%
variant_b ??15%
```

exact approved placementê°€ ?†ìœ¼ë©?base-only ?ˆìš©.

## Grass Detail

?„ì²´ grass ì¤?10~20% ?˜ì???ëª©í‘œì§€ë§?
approved placement markerê°€ ?†ìœ¼ë©??´ë²ˆ 1ì°?pass?ì„œ???ëµ?œë‹¤.

---

# 9. Nature Variant Assignment

?¤ì œ ?´ë?ì§€ ?±ê²©?€ ?¤ìŒê³?ê°™ì´ ?•ì •?œë‹¤.

## Tree

```text
tree_a
???€ì¹?  / ?•ëˆ???ë‚Œ
??Plaza ê²½ê³„ / Entry / ?•ëˆ??êµ¬ì—­ ?°ì„ 

tree_b
??ë¹„ë?ì¹?  / ?ì—°?¤ëŸ¬???ë‚Œ
??Park ?´ë? ?°ì„ 
```

ëª©í‘œ ë¹„ìœ¨:

```text
A ??40%
B ??60%
```

?˜ì?ë§?ê°€??ì¤‘ìš”???ì¹™:

> ê¸°ì¡´ Tree object ì¢Œí‘œë§??¬ìš©?œë‹¤.

Tree anchor:

```text
bottom-center
origin ??(0.5, 1.0)
depth = groundContactY
```

## Bush

```text
bush_a
???¨ìˆœ / ê°€?¥ìë¦?/ fence ì£¼ë?

bush_b
??ë³¼ë¥¨ / ì½”ë„ˆ / tree ì£¼ë?
```

ëª©í‘œ:

```text
50 / 50
```

ê¸°ì¡´ Bush markerë§??¬ìš©?œë‹¤.

## Flower

```text
flower_patch_b ??ê¸°ë³¸
flower_patch_a ??ë³´ì¡°
flower_patch_c ??ê°•ì¡°
```

ëª©í‘œ:

```text
A 25%
B 50%
C 25%
```

??

```text
grass ?„ë§Œ
path ì¤‘ì•™ ê¸ˆì?
plaza ê¸ˆì?
main route ê¸ˆì?
```

ê¸°ì¡´ markerê°€ ?†ìœ¼ë©??ëµ?œë‹¤.

---

# 10. Street Objects

## Bench

```text
96 Ã— 48
ground-contact ê¸°ì?
Y-sort
```

ê¸°ì¡´ Bench ?„ì¹˜ ?¬ìš©.

## Lamp

```text
lamp_base = 32 Ã— 80
lamp_glow = 32 Ã— 80
```

ê°™ì? ê¸°ì? ì¢Œí‘œ ?¬ìš©.

```text
base ??Y-sort
glow ??Effects
```

## Fence

ê¸°ì¡´ Fence geometryë§??œê°?”í•œ??

?„ìš” asset:

```text
fence_horizontal
fence_vertical
fence_corner_*
fence_end_*
```

Graphicsë¥?ë§ì¶”ê¸??„í•´ Collision geometryë¥?ë³€ê²½í•˜ì§€ ?ŠëŠ”??

## Manhole

```text
32 Ã— 32
Ground_Detail
non-blocking
```

ê¸°ì¡´ markerê°€ ?ˆì„ ?Œë§Œ ë°°ì¹˜?œë‹¤.

---

# 11. Visual Density ë³´í˜¸

## Park

?ì—°?¤ëŸ½ê³??ë??˜ê²Œ ë³´ì´??

```text
Main Walkway
Upper Narrow
Lower Narrow
Connector
```

ê°€ ?œê°?ìœ¼ë¡?ì¢ì•„ ë³´ì´ë©????œë‹¤.

## Central Plaza

?°ì„ ?œìœ„:

```text
?•ëˆ???´ë™ ê²½ë¡œ ê°€?…ì„±
CCTV ê°€?…ì„±
```

Open Core????foreground objectë¥?ì¶”ê??˜ì? ?ŠëŠ”??

## Cafe / Facility

Doorê°€ ì¦‰ì‹œ ?ë³„ ê°€?¥í•´???œë‹¤.

Door ?ì— ??decorative objectë¥??„ì˜ ë°°ì¹˜?˜ì? ?ŠëŠ”??

## Main Route / EntryExit

?¥ì‹ë³´ë‹¤ ?´ë™ ê²½ë¡œ ê°€?…ì„±???°ì„ ?´ë‹¤.

---

# 12. CCTV ë³´í˜¸

?´ë²ˆ task?ì„œ CCTV Gameplayë¥?êµ¬í˜„?˜ì? ?ŠëŠ”??

?˜ì?ë§?Graphicsê°€ ?¤ìŒ??ë°©í•´?˜ë©´ ???œë‹¤.

```text
CCTV1 / CCTV2 ê´€ì°??€???ë³„
interaction ?„ì¹˜ ?ë³„
coverage ??NPC ?œì•¼
```

?¹íˆ ??tree crown / foregroundê°€
CCTV2??Park + Plaza ?œì•¼ë¥?ì§€?ì ?¼ë¡œ ê°€ë¦¬ì? ?Šë„ë¡??œë‹¤.

---

# 13. êµ¬í˜„ ?œì„œ

## Phase 1 ??Structural Graphics

ë¨¼ì?:

```text
grass
park path
plaza
main route
Cafe
Public Facility
Fence
```

ë¥??µí•©?œë‹¤.

???íƒœ?ì„œ:

```text
geometry alignment
door readability
path readability
building exact-fit
```

ë¥??•ì¸?œë‹¤.

## Phase 2 ??Y-sort Objects

ê·??¤ìŒ:

```text
Tree
Bush
Bench
Lamp
```

ë¥??µí•©?œë‹¤.

NPC?€ ????ê´€ê³„ë? ?•ì¸?œë‹¤.

## Phase 3 ??Detail

ë§ˆì?ë§?

```text
grass detail
flower
manhole
lamp glow
terrain variant
```

ë¥??ìš©?œë‹¤.

approved placementê°€ ë¶ˆëª…?•í•œ detail?€ skip ê°€?¥í•˜??

---

# 14. Visual Validation

ê°€?¥í•˜ë©??¤ì œ application???¤í–‰?˜ê³ 
Plaza/Park scene??ì§ì ‘ ?•ì¸?œë‹¤.

ë°˜ë“œ???•ì¸:

```text
Cafe fit
Facility fit

Cafe door visible
Facility door visible

Main Walkway visible
Upper / Lower Narrow visible
Main Route visible

Tree/NPC depth
Bush/NPC depth
Bench/NPC depth
Lamp/NPC depth

Foreground clipping
building foreground behavior

CCTV1/CCTV2 ì£¼ìš” ?œì•¼ ë°©í•´ ?¬ë?
```

ê°€?¥í•˜ë©?before / after screenshot???¨ê¸´??

---

# 15. Regression

ìµœì†Œ:

```text
npm run typecheck
npm test
npm run build
```

?„ì¬ Traffic / Harness testsë¥?Graphics ë³€ê²??Œë¬¸???½í™”?œí‚¤ì§€ ?ŠëŠ”??

ê¸°ì¡´ ?ŒìŠ¤???¤íŒ¨ê°€ ë°œìƒ?˜ë©´
expectation??ë°”ê¿” PASS?œí‚¤ì§€ ë§ê³  ?ì¸??ë³´ê³ ?œë‹¤.

---

# 16. PASS / WARN / FAIL

## FAIL

?¤ìŒ?´ë©´ ?˜ì • ?„ìš”:

```text
Door ê°€ë¦?ì£¼ìš” Path ?œê°??ì°¨ë‹¨
ëª…ë°±??depth ?? „
?¬ê°??clipping
CCTV ?€???ë³„ ë¶ˆê?
Geometry ë³€ê²?Collision ë³€ê²?Waypoint/Route ë³€ê²?Door Trigger ë³€ê²?Traffic regression
```

## WARN

ì§„í–‰ ê°€??

```text
minor pixel alignment
small shadow mismatch
?½ê°„??visual overlap
detail ë°˜ë³µê°??¥ì‹ ë°€???½ê°„ ?´ìƒ‰
```

?ì¹™:

```text
Prototype??ë§‰ëŠ” FAILë§??˜ì •
WARN?€ ê¸°ë¡?˜ê³  ì§„í–‰
```

---

# 17. ë³€ê²?ë²”ìœ„

ê°€?¥í•œ ë³€ê²?

```text
Plaza/Park graphics renderer / loader
TMJ visual-only layer / tileset references
asset manifest / preload
graphics-specific helper
```

?„ìš”??ê²½ìš° ìµœì†Œ ë²”ìœ„ë¡œë§Œ ?˜ì •?œë‹¤.

ê°€ê¸‰ì  ?˜ì •?˜ì? ?Šì„ ê²?

```text
src/plazaTraffic.ts
collision code
route code
Full Flow Harness
```

---

# 18. ë¬¸ì„œ ?…ë°?´íŠ¸

?´ë²ˆ ?‘ì—…?ì„œ??Source-of-Truth ë¬¸ì„œë¥??ë™?¼ë¡œ ?¤ì‹œ ?‘ì„±?˜ì? ?ŠëŠ”??

êµ¬í˜„ ê²°ê³¼ë¥?ë³´ê³ ?????¬ìš©??ê²€????ë¬¸ì„œë¥?ê°±ì‹ ?œë‹¤.

---

# 19. ìµœì¢… ë³´ê³  ?•ì‹

## 1. ë³€ê²??Œì¼

## 2. Asset ?°ê²° ë°©ì‹

??

```text
?ë³¸ ê²½ë¡œ
runtime ê²½ë¡œ
copy ?¬ë?
```

## 3. Structural Graphics

```text
Grass
Path
Plaza
Road
Cafe
Facility
Fence
```

ê°ê° êµ¬í˜„ ?¬ë?.

## 4. Y-sort

```text
Tree
Bush
Bench
Lamp
```

anchor / depth ë°©ì‹.

## 5. Detail

```text
Flower
Grass Detail
Manhole
Lamp Glow
Variants
```

?ìš© / skip ë°??´ìœ .

## 6. Source-of-Truth ë³´ì¡´

ëª…ì‹œ:

```text
Geometry
Collision
W01~W22
R1~R8
Door
10 active movers policy
```

ë³€ê²??¬ë?.

## 7. Regression

```text
typecheck
tests
build
```

## 8. Visual Validation

```text
Cafe fit
Facility fit
Door readability
Path readability
Y-sort
Foreground
CCTV visibility
```

PASS / WARN / FAIL.

## 9. ?¨ì? WARN

## 10. ìµœì¢… ?ì •

```text
PASS
PASS with WARN
FAIL
```

## 11. ì¤‘ë‹¨

ë³´ê³  ??ë©ˆì¶˜??

?¤ìŒ ?¨ê³„??

```text
Graphics Regression ë³´ì™„
CCTV1 / CCTV2
```

ë¡??ë™ ì§„í–‰?˜ì? ?ŠëŠ”??
