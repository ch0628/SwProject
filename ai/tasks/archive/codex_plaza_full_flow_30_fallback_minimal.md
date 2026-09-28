# Codex Task ??Plaza/Park 30 NPC Fallback (Minimal Patch)

## ëª©ì 

?´ë? ê²€ì¦ëœ 35 NPC Full Flow Harnessë¥?ê·¸ë?ë¡??¬ì‚¬?©í•˜??
**35 NPC êµ¬ì„±?ì„œ ?•í™•??5ëª…ë§Œ ?œê±°??30 NPC fallback preset**??ì¶”ê??˜ê³ 
Warm-up 30s + Measurement 300së¥?1???¤í–‰?œë‹¤.

?´ë²ˆ ?‘ì—…?€ Density Reduction ê²€ì¦ì´??

Movement / Route / Spawn / Metric ?˜ë?ë¥??¤ì‹œ ?¤ê³„?˜ì? ?ŠëŠ”??

---

## ë¨¼ì? ?½ì„ ?Œì¼ ??ìµœì†Œ ë²”ìœ„

```text
src/plazaFullFlow.ts
tests/fullFlowHarness.test.ts
scripts/measure-plaza-full-flow-35.mjs
src/plazaTraffic.ts
```

?„ìš”???Œë§Œ:

```text
src/PlazaParkScene.ts
src/main.tsx
```

?¤ë¥¸ ?Œì¼???€ê·œëª¨ë¡??½ê±°???˜ì •?˜ì? ë§ˆë¼.

---

# 1. 30 NPC êµ¬ì„± ???¹ì¸ ?„ë£Œ

35 NPC creator ê²°ê³¼?ì„œ ?¤ìŒ IDë§??œê±°?œë‹¤.

```text
REMOVE = [2, 10, 16, 24, 28]
```

?˜ë¨¸ì§€ 30 NPC??ê·¸ë?ë¡?? ì??œë‹¤.

?ˆë? ê¸ˆì?:

```text
ID renumber
re-spawn
spawn ?„ì¹˜ ?¬ê³„??direction ë³€ê²?species ?¬ë°°ì¹?route ë³€ê²?target ë³€ê²?priority ë³€ê²?```

ì¦?

> 30 NPC = ?™ì¼??35 NPC initial state?ì„œ 5 actorë§??œê±°??deterministic subset

?´ì–´???œë‹¤.

---

# 2. ?ˆìƒ 30 NPC ë¶„í¬

## Route

```text
R1 = 4
R2 = 4
R3 = 3
R4 = 4
R5 = 2
R6 = 4
R7 = 5
R8 = 4

Total = 30
```

## Species

```text
Rabbit = 7
Cat    = 6
Fox    = 6
Dog    = 6
Tiger  = 5
```

## Size Proxy

```text
Small  = 7
Medium = 18
Large  = 5
```

## Area

```text
Park           = 9
CentralPlaza   = 9
Cafe           = 2
PublicFacility = 3
MainRoute      = 4
EntryExit      = 3
```

## Movement Type

```text
Through     = 12   // R1 4 + R2 4 + R8 4
Local       = 11   // R5 2 + R6 4 + R7 5
Destination = 7    // R3 3 + R4 4
```

---

# 3. êµ¬í˜„ ?ì¹™

ê°€?¥í•˜ë©?35 creatorë¥?ê·¸ë?ë¡??¸ì¶œ????subsetë§?ë§Œë“ ??

??

```ts
createPlazaFullFlow30(map, external?)
```

?´ë? ê°œë…:

```ts
const state35 = createPlazaFullFlow35(map, external)
state35.run.npcs = state35.run.npcs.filter(n => !REMOVE_IDS.has(n.id))
```

?¨ìˆœ??ë°°ì—´ë§??ë¥´ë©?metrics / initialAreas / expected countsê°€ 35 ê¸°ì??¼ë¡œ ?¨ì„ ???ˆìœ¼ë¯€ë¡?
30 preset??summary/self-checkê°€ ?•í™•??countë¥??´ë„ë¡??„ìš”??ìµœì†Œ ì²˜ë¦¬ë§??œë‹¤.

ì¤‘ìš”:

- ? ì???NPC ê°ì²´??id/x/y/route/species/size/ffArea/target/direction??ë³€ê²½í•˜ì§€ ?ŠëŠ”??
- 30ëª…ìš© ë³„ë„ spawn searchë¥??Œë¦¬ì§€ ?ŠëŠ”??
- 35 NPC creator??correctnessë¥??½í™”?œí‚¤ì§€ ?ŠëŠ”??

ê°€?¥í•˜ë©?30/35 ê³µí†µ Harness êµ¬ì¡°ë¥?? ì??˜ë˜
?€ê·œëª¨ refactor???˜ì? ?ŠëŠ”??

---

# 4. 30 NPC Self-check

?ì„± ì§í›„ ?¤ìŒ??assert?œë‹¤.

```text
NPC = 30

Route = 4/4/3/4/2/4/5/4

Species = 7/6/6/6/5

Size = 7/18/5

Area =
Park 9
CentralPlaza 9
Cafe 2
PublicFacility 3
MainRoute 4
EntryExit 3
```

ê·¸ë¦¬ê³?retained actor ê°ê°???€??35 creator?ì„œ???™ì¼ ID?€ ë¹„êµ?˜ì—¬:

```text
x
y
route
species
size
ffArea
spawnRegion
segmentStart
segmentEnd
target
direction
```

???™ì¼?¨ì„ ?ŒìŠ¤?¸í•œ??

ID gap??ê·¸ë?ë¡?? ì??œë‹¤.

---

# 5. 35 NPC Regression ë³´í˜¸

ë°˜ë“œ??ê·¸ë?ë¡?? ì?:

```text
createPlazaFullFlow35() = 35 NPC
ê¸°ì¡´ 35 self-check
ê¸°ì¡´ Harness tests
ê¸°ì¡´ 35 raw logic result
```

30 preset ì¶”ê? ?Œë¬¸??35 ê²°ê³¼ artifactë¥???–´?°ì? ?ŠëŠ”??

---

# 6. 30 NPC Measurement Script

ì¶”ê?:

```text
scripts/measure-plaza-full-flow-30.mjs
```

35 scriptë¥?ìµœì†Œ ë³µì œ/ê³µí†µ?”í•˜???¬ìš©?œë‹¤.

ì¡°ê±´:

```text
Warm-up = 30 sec
Measurement = 300 sec
Total = 330 sec
DT = 1/60
```

Canonical output:

```text
artifacts/plaza_full_flow_30_raw.json
```

35 raw ?Œì¼?€ ê±´ë“œë¦¬ì? ?ŠëŠ”??

PASS Gate??35?€ ?™ì¼???˜ë?ë¥??¬ìš©?œë‹¤.

```text
npc_count = 30
actual area counts ?•í™•
R1~R8 ëª¨ë‘ trips > 0
collision_violation_total = 0
deadlock_count = 0
ever_20sec_block_count = 0
unrecovered_20sec = 0
Cafe repeated transition
Facility repeated transition
queue unrecovered = 0
```

---

# 7. Tests ??ìµœì†Œ ì¶”ê?

`tests/fullFlowHarness.test.ts`??ìµœì†Œ ?¤ìŒë§?ì¶”ê??œë‹¤.

### A. 30 subset identity

```text
REMOVE = [2,10,16,24,28]
remaining IDs unchanged
30 NPC retained state = 35 creator same-ID state
```

### B. 30 exact counts

Route / Species / Size / Area counts ?•í™•.

### C. 35 regression

ê¸°ì¡´ 35 creator tests ê·¸ë?ë¡?PASS.

?€ê·œëª¨ test rewrite ê¸ˆì?.

---

# 8. ?ˆë? ?˜ì • ê¸ˆì?

```text
Fix4 Movement
plazaTraffic movement semantics
Route R1~R8
Waypoint
TMJ / Map
Collision
Door
Spawn region definition
35 NPC allocation
Metrics semantics
Warm-up reset semantics
```

30 NPCê°€ FAIL?´ë„:

```text
Fix5 ê¸ˆì?
?¤ë¥¸ NPC ?œê±° ì¡°í•© ?¬ì‹œ??ê¸ˆì?
25 NPC ?ë™ fallback ê¸ˆì?
Route ë³€ê²?ê¸ˆì?
Map ë³€ê²?ê¸ˆì?
```

---

# 9. ?¤í–‰

ë°˜ë“œ??

```powershell
npm run typecheck
npm test
npm run build
node --experimental-strip-types scripts/measure-plaza-full-flow-30.mjs
```

ë¥??¤ì œ ?˜í–‰?œë‹¤.

---

# 10. ìµœì¢… ë³´ê³ 

?¤ìŒë§?ê°„ê²°?˜ê²Œ ë³´ê³ ?œë‹¤.

## 1. ë³€ê²??Œì¼

## 2. 30 subset ê²€ì¦?
```text
Removed IDs
NPC count
Route counts
Species counts
Size counts
Area counts
retained state identical ?¬ë?
```

## 3. Regression

```text
35 creator/tests ? ì? ?¬ë?
typecheck
tests
build
```

## 4. 30 NPC Run

```text
R1~R8 trips
R1~R8 arrivals
R1~R8 max_wait

deadlock_count
ever_20sec_block_count
unrecovered_20sec
max_continuous_blocked_time

collision_violation_total

Cafe enter/exit
Facility enter/exit

Upper/Lower Narrow queue/pass
W12 max/end queue
W12 queue max wait
W12 queue recovery
```

## 5. ìµœì¢… ?ì •

```text
PASS
PASS with WARN
FAIL
```

## 6. ì¤‘ë‹¨

ê²°ê³¼ ë³´ê³  ??ë©ˆì¶˜??

ë¬¸ì„œ ê°±ì‹  / Graphics / CCTV / Fix5 / ì¶”ê? fallback???ë™ ?œì‘?˜ì? ë§ˆë¼.
