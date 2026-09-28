# Antigravity Task ??Character Visual Integration (40 Directional PNGs)

## ëª©ì 

?„ì¬ Plaza/Park Prototype???„ì‹œ ?„í˜• NPCë¥??¬ìš©?ê? ì§ì ‘ ?œì‘??5 Species Ã— Male/Female Ã— 4 Direction
?•ì  ìºë¦­??PNGë¡?êµì²´?œë‹¤.

?´ë²ˆ ?‘ì—…?€ **Character Visual Integration**ë§??˜í–‰?œë‹¤.

?„ì¬ Traffic v1 / Map / Collision / Route / Waypoint / CCTV Gameplayë¥??˜ì •?˜ì? ?ŠëŠ”??

---

# 1. ë¨¼ì? ?•ì¸???Œì¼

?„ë˜ë¥?ë¨¼ì? ?½ê³  ?„ì¬ ìµœì‹  repository ?íƒœë¥??•ì¸?œë‹¤.

```text
ai/RULES.md
ai/WORKFLOW.md
ai/CONTEXT_MAP.md

docs/archive/session_handoff_plaza_park_2026-09-14.md
docs/archive/plaza_park_npc_traffic_known_issue.md
docs/validation/plaza_park_v1/plaza_park_graphics_integration_report.md
docs/graphics_character_asset_spec.md

src/PlazaParkScene.ts
src/ScaleValidationScene.ts
src/plazaTraffic.ts
src/config.ts
```

ì¶”ê? ?Œì¼?€ Character loading/rendering êµ¬ì¡° ?•ì¸???„ìš”??ìµœì†Œ ë²”ìœ„ë§??½ëŠ”??

---

# 2. Character Asset Source

?ë³¸:

```text
assets/characters/
```

Species:

```text
rabbit
cat
fox
dog
tiger
```

ê°?Species??Male / Female???ˆê³ ,
?¤ì œ runtime???¬ìš©???´ë?ì§€??**4ë°©í–¥ ê°œë³„ PNG**??

?„ì¬ repository tree ê¸°ì? ê°œë³„ PNG ?„ì¹˜??

```text
assets/characters/<species>/base/<gender>/<species>_<gender>_down.png
assets/characters/<species>/base/<gender>/<species>_<gender>_left.png
assets/characters/<species>/base/<gender>/<species>_<gender>_right.png
assets/characters/<species>/base/<gender>/<species>_<gender>_up.png
```

ì´?

```text
5 species Ã— 2 gender Ã— 4 direction = 40 PNG
```

??

```text
assets/characters/rabbit/base/male/rabbit_male_down.png
assets/characters/rabbit/base/female/rabbit_female_left.png
...
assets/characters/tiger/base/female/tiger_female_up.png
```

---

# 3. ?ˆë? ?¬ìš©?˜ì? ?Šì„ ?Œì¼

?¤ìŒ ì¢…ë¥˜??Sheet??runtime character textureë¡??¬ìš©?˜ì? ?ŠëŠ”??

```text
game_ready_sheet_*.png
game_sheet_*.png
game_sheets_*.png
```

?„ì¬ tree?ì„œ:

```text
assets/characters/<species>/reference/game_ready_sheet_male.png
assets/characters/<species>/reference/game_ready_sheet_female.png
```

??4ë°©í–¥?????¥ì— ?¤ì–´ ?ˆëŠ” reference / sheet ?´ë?ì§€?´ë?ë¡??´ë²ˆ Runtime Integration?ì„œ ?¬ìš©?˜ì? ?ŠëŠ”??

Sheet crop / frame slicing???˜ì? ?ŠëŠ”??

ë°˜ë“œ??**ê°œë³„ directional PNG 40ê°?*ë¥??¬ìš©?œë‹¤.

ì£¼ì˜:
?„ì¬ ?¤ì œ tree?€ ??ê²½ë¡œê°€ ?¤ë¥´?¤ë©´ ?„ì˜ ì¶”ì •?˜ì? ë§ê³ 
ê°œë³„ directional PNGê°€ ?¤ì œ ?´ë”” ?ˆëŠ”ì§€ ?•ì¸????ë³´ê³ ?œë‹¤.

---

# 4. ?ë³¸ Asset ë³´ì¡´

ê¸ˆì?:

```text
?ë³¸ PNG ?? œ
?ë³¸ PNG resize
?ë³¸ PNG trim
?ë³¸ PNG crop
?ë³¸ PNG padding ë³€ê²??ë³¸ PNG alpha ë³€ê²?sheet?ì„œ sprite ?¬ì¶”ì¶??´ë?ì§€ ?¬ìƒ??```

browser runtime??ë³µì‚¬ê°€ ?„ìš”?˜ë©´:

```text
public/assets/characters/
```

?„ë˜??êµ¬ì¡°ë¥?ë³´ì¡´?´ì„œ ë³µì‚¬?œë‹¤.

??

```text
public/assets/characters/rabbit/base/male/rabbit_male_down.png
```

?ë³¸ `assets/characters/`??ê·¸ë?ë¡?ë³´ì¡´?œë‹¤.

---

# 5. Runtime Manifest

?Œì¼ ê²½ë¡œë¥?`PlazaParkScene.ts` ?¬ëŸ¬ ê³³ì— ì§ì ‘ ?˜ë“œì½”ë”©?˜ì? ?ŠëŠ”??

Character visual lookup???„í•œ ?¨ì¼ manifest/helperë¥?ë§Œë“ ??

ê¶Œì¥ ê°œë…:

```ts
type Species = 'rabbit' | 'cat' | 'fox' | 'dog' | 'tiger'
type Gender = 'male' | 'female'
type Facing = 'down' | 'left' | 'right' | 'up'

characterTexture(species, gender, facing)
```

?ëŠ” ?™ë“±??ìµœì†Œ êµ¬ì¡°.

ëª©í‘œ:

```text
NPC visual identity
??manifest
??texture key / runtime PNG
```

?¥í›„ PNG êµì²´ ??Traffic ì½”ë“œ??Gameplay ì½”ë“œë¥??˜ì •?˜ì? ?Šì•„???˜ê²Œ ?œë‹¤.

---

# 6. ?„ì¬ 10 NPC Visual Assignment

?„ì¬ Limited Prototype?ëŠ” 10 active moversê°€ ì¡´ì¬?˜ì?ë§?`SmokeNpc` ?ì²´???„ì¬ species / gender gameplay dataë¥?ê°–ê³  ?ˆì? ?Šì„ ???ˆë‹¤.

?´ë²ˆ ?‘ì—…?ì„œ??Traffic data model??ë°”ê¾¸ì§€ ?ŠëŠ”??

?„ìš”?˜ë‹¤ë©?**renderer-only temporary visual assignment**ë¥?ë³„ë„ helperë¡??”ë‹¤.

10ê°?visual????ë²ˆì”© ?¬ìš©?˜ëŠ” deterministic assignment:

```text
NPC 1  ??rabbit male
NPC 2  ??rabbit female
NPC 3  ??cat male
NPC 4  ??cat female
NPC 5  ??fox male
NPC 6  ??fox female
NPC 7  ??dog male
NPC 8  ??dog female
NPC 9  ??tiger male
NPC 10 ??tiger female
```

??assignment??

```text
temporary visual mapping
```

??ë¿ì´ë©??œë?/?…ë‹¹/?•ë‹µ label ?˜ë?ë¥?ë¶€?¬í•˜ì§€ ?ŠëŠ”??

ê¸ˆì?:

```text
userLabel
aiLabel
verifiedLabel
citizen/villain truth
behaviorHistory
```

??Gameplay ?˜ë?ë¥??´ë²ˆ task?ì„œ ì¶”ê??˜ì? ?ŠëŠ”??

?¥í›„ Supervised Learning NPC model???ê¸°ë©???renderer-only mapping?€ ê·??°ì´?°ë¡œ êµì²´ ê°€?¥í•´???œë‹¤.

---

# 7. Direction ë³€ê²?
ê°?NPC???¤ì œ ?´ë™ ë°©í–¥???°ë¼ ?¤ìŒ textureë¥??¬ìš©?œë‹¤.

```text
dx > 0 ??right
dx < 0 ??left
dy > 0 ??down
dy < 0 ??up
```

ì¤‘ìš”:

- Route targetë§?ë³´ê³  ë°©í–¥??ì¶”ì •?˜ì? ?ŠëŠ”??
- ê°€?¥í•˜ë©?**ì§ì „ frame position ???„ì¬ frame position???¤ì œ delta**ë¥??¬ìš©?œë‹¤.
- diagonal ?´ë™??ì¡´ì¬?˜ë©´ absolute deltaê°€ ??ì¶•ì„ ê¸°ì??¼ë¡œ facing??ê²°ì •?œë‹¤.
- ?¤ì œ ?´ë™?‰ì´ ê±°ì˜ 0?´ë©´ ë§ˆì?ë§?facing??? ì??œë‹¤.
- ì´ˆê¸° facing?€ `down`?¼ë¡œ ?´ë„ ?œë‹¤.

Traffic movement ?ì²´??ë³€ê²½í•˜ì§€ ?ŠëŠ”??

---

# 8. Rendering

?„ì¬ ?„ì‹œ rectangle / circle NPC visual?€
?¤ì œ Character Spriteë¡?êµì²´?œë‹¤.

Character:

```text
origin = bottom-center
depth = feetY
```

ì¦?

```ts
sprite.setOrigin(0.5, 1)
sprite.setDepth(npc.y)
```

?€ ?™ë“±??semanticsë¥?? ì??œë‹¤.

NPC physical footprint??sprite ?¬ê¸°?€ ë¶„ë¦¬?œë‹¤.

?ˆë?:

```text
sprite pixel sizeë¥?collision boxë¡??¬ìš©
```

?˜ì? ?ŠëŠ”??

---

# 9. Visual Scale

?„ì¬ collision / Traffic size??ë³€ê²½í•˜ì§€ ?ŠëŠ”??

ê¸°ì¡´ `SMOKE_SIZES[n.size].visual` ???„ì¬ Prototype???¬ìš©?˜ë˜ visual-height ê¸°ì????ˆë‹¤ë©?ê·?ê¸°ì????Œë”ë§?scale?ë§Œ ?¬ì‚¬?©í•œ??

?ì¹™:

```text
?ë³¸ PNG???˜ì •?˜ì? ?ŠìŒ
runtime display scaleë§??¬ìš© ê°€??collision footprint??ê¸°ì¡´ ê°?? ì?
```

Speciesë³?ìµœì¢… visual scale???„ì§ ?•ì •?˜ì? ?Šì? ??ª©?€
???ìˆ˜ë¥??„ì˜ë¡??•ì •?˜ì? ?ŠëŠ”??

?„ì¬ rendererê°€ ?¬ìš©?˜ë˜ visual proxy??ë§ì¶”??ìµœì†Œ ë³€ê²½ì„ ?°ì„ ?œë‹¤.

Tiger??ê¸°ì¡´ ê²€ì¦ëœ visual height / footprint semantics??ê¹¨ì?ì§€ ?Šê²Œ ?œë‹¤.

---

# 10. Player / Tiger Probe

?„ì¬ Player / Tiger Probeê°€ ë³„ë„ë¡?ì¡´ì¬?˜ë©´
ê¸°ì¡´ ê¸°ëŠ¥??? ì??œë‹¤.

?´ë? ?¤ì œ Tiger directional textureë¥??¬ìš©?˜ê³  ?ˆë‹¤ë©???manifest?€ ì¤‘ë³µ loaderê°€ ?ê¸°ì§€ ?Šê²Œ ?•ë¦¬?????ˆë‹¤.

??

```text
movement
collision
door enter/exit
camera follow
debug probe
```

?™ì‘??ë³€ê²½í•˜ì§€ ?ŠëŠ”??

---

# 11. Traffic Known Issue ë³´í˜¸

?„ì¬ Traffic v1?ëŠ” ?¥ê¸° êµ°ì§‘ / progress detection Known Issueê°€ ?ˆë‹¤.

?´ë²ˆ task?ì„œ ?´ê²°?˜ì? ?ŠëŠ”??

?ˆë? ?˜ì •?˜ì? ?Šì„ ê²?

```text
src/plazaTraffic.ts movement semantics
SMOKE_ROUTES
W01~W22
collision
narrow reservation
W12 FIFO
side-step
density
spawn
```

Character Integration ?„í›„
Traffic ê²°ê³¼ ì°¨ì´ë¥?ë§Œë“¤ì§€ ?ŠëŠ” ê²ƒì´ ëª©í‘œ??

---

# 12. Map ë³´í˜¸

?´ë²ˆ task?ì„œ:

```text
public/maps/plaza-park.tmj
```

ë¥??˜ì •?˜ì? ?ŠëŠ”??

?¬ìš©?ê? ë³„ë„ ?¨ê³„?ì„œ ì§ì ‘ Map???¬ì„¤ê³„í•  ?ˆì •?´ë‹¤.

Character Visual Integrationê³?Map redesign???ì? ?ŠëŠ”??

---

# 13. Validation

ìµœì†Œ:

```text
npm run typecheck
npm test
npm run build
```

ê¸°ì¡´ expectation??ë³€ê²½í•´???ŒìŠ¤?¸ë? ?µì?ë¡?PASS?œí‚¤ì§€ ?ŠëŠ”??

ê°€?¥í•˜ë©??¤ì œ Plaza/Parkë¥??¤í–‰???¤ìŒ???•ì¸?œë‹¤.

```text
5 Species ëª¨ë‘ ?”ë©´???œì‹œ
Male / Female ê°ê° ?œì‹œ
4ë°©í–¥ texture ?„í™˜
bottom-center anchor
feetY Y-sort
ê±´ë¬¼/?˜ë¬´/ë²¤ì¹˜/?¨í”„?€ depth ê´€ê³?door enter/exit ? ì?
10 NPC rendering
FPS?????Œê? ?†ìŒ
```

Visual checkê°€ ?ë™???˜ê²½?ì„œ ë¶ˆê??¥í•˜ë©?ê·??¬ì‹¤??ëª…í™•??ë³´ê³ ?˜ê³  ?¬ìš©?ì˜ ?˜ë™ ê²€ì¦???ª©???œì‹œ?œë‹¤.

---

# 14. PASS / FAIL

PASS:

```text
40 individual directional PNG preload ê°€??10 NPCê°€ actual character spriteë¡??œì‹œ
direction ?„í™˜ ?•ìƒ
collision / traffic / door ?™ì‘ ë³€ê²??†ìŒ
typecheck PASS
tests PASS
build PASS
```

WARN:

```text
minor visual scale ì°¨ì´
speciesë³?ìµœì¢… scale ë¯¸í™•??minor pixel alignment
```

FAIL:

```text
sheet imageë¥?runtime spriteë¡??¬ìš©
direction texture ?˜ëª» ?°ê²°
alpha/background ë¬¸ì œ
collision semantics ë³€ê²?traffic semantics ë³€ê²?map ?˜ì •
door regression
build/test failure
```

---

# 15. ìµœì¢… ë³´ê³ 

?¤ìŒ ?•ì‹?¼ë¡œ ë³´ê³ ?œë‹¤.

## 1. ë³€ê²??Œì¼

## 2. Runtime Asset ê²½ë¡œ
- source
- public/runtime copy
- copy??PNG ??
## 3. Sheet ë¯¸ì‚¬???•ì¸

```text
game_ready_sheet / game_sheet / game_sheets
runtime ?¬ìš© ?¬ë? = NO
```

## 4. Manifest êµ¬ì¡°

## 5. 10 NPC Visual Mapping

## 6. Facing ê²°ì • ë°©ì‹

## 7. Scale / Anchor / Depth ë°©ì‹

## 8. Source-of-Truth ë³´ì¡´

```text
Traffic
Collision
Route
Waypoint
Map
Door
```

## 9. Regression

```text
typecheck
tests
build
```

## 10. Visual Validation

## 11. WARN

## 12. ìµœì¢… ?ì •

```text
PASS
PASS with WARN
FAIL
```

ë³´ê³  ??ì¤‘ë‹¨?œë‹¤.

CCTV1 / CCTV2 ?ëŠ” Map redesign?¼ë¡œ ?ë™ ì§„í–‰?˜ì? ?ŠëŠ”??
