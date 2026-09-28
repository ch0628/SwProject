# Antigravity Task ??Plaza/Park 35 NPC Full Flow Harness Implementation + Logic Run

## 0. ?‘ì—… ëª©ì 

Plaza/Park??**35 NPC Full Flow Harness**ë¥?êµ¬í˜„?˜ê³ ,
?™ì¼ Harnessë¥??¬ìš©??Node ê¸°ë°˜ Logic Simulation???¤ì œë¡??¤í–‰?˜ì—¬ ê²°ê³¼ë¥?ë³´ê³ ?œë‹¤.

?´ë²ˆ ?‘ì—…???µì‹¬?€:

```text
R1~R8 ?•ì‹ Route
+ 35 NPC ?•ì • ë°°ì¹˜
+ Species / Collision Proxy ?•ì •
+ Warm-up 30 sec
+ Measurement 300 sec
+ ê¸°ì¡´ Fix4 Movement ê·¸ë?ë¡?```

?´ë‹¤.

ì¤‘ìš”:

> ?´ë²ˆ ?‘ì—…?ì„œ 35 NPC ê²°ê³¼ê°€ FAIL?˜ë”?¼ë„
> Movement Fix5, Route ?˜ì •, Map ?˜ì •, 30 NPC fallback???ë™?¼ë¡œ ì§„í–‰?˜ì? ?ŠëŠ”??
> ê²°ê³¼ë¥?ê·¸ë?ë¡?ë³´ê³ ?˜ê³  ë©ˆì¶˜??

ë¬¸ì„œ Source of Truth??**ê²°ê³¼ ê²€?????¬ìš©?ê? ë³„ë„ë¡?ê°±ì‹ ???ˆì •**?´ë‹¤.
?´ë²ˆ Agent ?‘ì—…?ì„œ??narrative `.md` ë¬¸ì„œë¥??„ì˜ë¡??˜ì •?˜ì? ë§ˆë¼.

---

# 1. ë°˜ë“œ??ë¨¼ì? ?½ê¸°

Repository ê¸°ì??¼ë¡œ ?¤ìŒ ?Œì¼??ë¨¼ì? ?½ì–´??

```text
ai/RULES.md
ai/WORKFLOW.md
ai/CONTEXT_MAP.md

docs/archive/session_handoff_plaza_park_2026-09-14.md
docs/reference/plaza_park_full_flow_validation_spec.md
docs/validation/plaza_park_v1/plaza_park_candidate_route_validation_results.md
docs/shared/maps/map_plaza_park_spec.md
docs/graphics_character_asset_spec.md
docs/supervised_learning_area_rollout_plan.md

src/plazaTraffic.ts
src/PlazaParkScene.ts
src/main.tsx
src/config.ts
src/collision.ts
src/corridorCapacity.ts
src/plazaPark.ts

tests/candidateRoutes.test.ts
tests/plazaTraffic.test.ts

public/maps/plaza-park.tmj
```

ê´€??ê¸°ì¡´ ì¸¡ì • scriptê°€ ?ˆë‹¤ë©?ê°™ì´ ?½ëŠ”??

??

```text
scripts/measure-plaza-fix4.mjs
```

?¤ì œ repository êµ¬ì¡°ê°€ ?¤ë¥´ë©?ì¡´ì¬?˜ëŠ” ?™ì¼ ëª©ì  ?Œì¼???¬ìš©?œë‹¤.

---

# 2. ?„ì¬ ?•ì •??Route Source of Truth

?¤ìŒ R1~R8?€ ëª¨ë‘ ?•ì‹ ?¹ì¸ ?íƒœ??

```text
R1 = W01 ??W05 ??W12 ??W14 ??W20 ??W21
R2 = W01 ??W05 ??W08 ??W05 ??W12 ??W14 ??W20 ??W22
R3 = W05 ??W12 ??W13 ??W16 ??W20
R4 = W05 ??W12 ??W18 ??W12 ??W14
R5 = W09 ??W11 ??W12 ??W14

R6 = W03 ??W05 ??W07
R7 = W13 ??W14 ??W15
R8 = W21 ??W20 ??W22
```

R6~R8 Dynamic Validation?€ ?„ë£Œ?ë‹¤.

```text
Single Small / Medium / Large = PASS
Bidirectional Large + Large = PASS
collisionViolation = 0
unrecovered_20sec = 0
```

`R6~R8`???¤ì‹œ Candidateë¡?ì·¨ê¸‰?˜ì? ë§ˆë¼.

---

# 3. 35 NPC Routeë³??¸ì› ???¹ì¸ ?„ë£Œ

?•í™•???¤ìŒ ?¸ì›?¼ë¡œ êµ¬ì„±?œë‹¤.

```text
R1 = 4
R2 = 5
R3 = 4
R4 = 4
R5 = 2
R6 = 5
R7 = 6
R8 = 5

Total = 35
```

Movement Type ë¶„ë¥˜:

```text
Through Traffic:
R1 4 + R2 5 + R8 5 = 14

Local Activity:
R5 2 + R6 5 + R7 6 = 13

Destination Traffic:
R3 4 + R4 4 = 8

Total = 35
```

ì£¼ì˜:

`R8`?€ Main Routeë¥?ê°€ë¡œì?ë¥´ëŠ” **Through Traffic**?¼ë¡œ ì§‘ê³„?œë‹¤.

---

# 4. Species êµ¬ì„± / Collision Proxy ???¹ì¸ ?„ë£Œ

Species ??

```text
Rabbit = 8
Cat    = 7
Fox    = 7
Dog    = 7
Tiger  = 6

Total = 35
```

Full Flow Collision Proxy:

```text
Rabbit ??Small  = 18Ã—12
Cat    ??Medium = 22Ã—14
Fox    ??Medium = 22Ã—14
Dog    ??Medium = 22Ã—14
Tiger  ??Large  = 26Ã—16
```

ì¤‘ìš”:

```text
Rabbit / Cat / Fox / Dog
??Full Flow validation proxy
??ìµœì¢… Species-specific footprintê°€ ?„ë‹˜

Tiger 26Ã—16
???¤ì œ ?•ì • footprint
```

`Max96`?€ 35 NPC Species êµ¬ì„±?ì„œ ?¬ìš©?˜ì? ?ŠëŠ”??

Species??deterministic?˜ê²Œ ë¶„ì‚°?œë‹¤.

ê¶Œì¥:

```text
Rabbit ??Cat ??Fox ??Dog ??Tiger
```

?œí™˜ ë°°ì¹˜?˜ë˜ ìµœì¢… quotaê°€ ?•í™•??

```text
8 / 7 / 7 / 7 / 6
```

???˜ë„ë¡??œë‹¤.

?¹ì • Route??Tiger ?ëŠ” Medium actorê°€ ëª°ë¦¬ì§€ ?Šë„ë¡?deterministic round-robin?¼ë¡œ Route ?„ì²´??ë¶„ì‚°?œë‹¤.

---

# 5. ì´ˆê¸° Spawn ë¶„í¬ ëª©í‘œ ??ê¸°ì¡´ ?¹ì¸ê°?? ì?

35 NPC ì´ˆê¸° Spawn?€ ?¤ìŒ ë¶„í¬ë¥??•í™•??ë§Œì¡±?˜ë„ë¡??œë‹¤.

```text
Park                     = 11
Central Plaza            = 10
Cafe ì£¼ë?                 = 3
Public Facility ì£¼ë?      = 3
Main Route                = 5
Entry / Exit ?´ë™ì¤?       = 3

Total                    = 35
```

Routeë³??¸ì›ê³?ëª¨ìˆœ ?†ì´ ?¤ìŒ allocation???¬ìš©?´ë„ ?œë‹¤.

```text
Park:
R6 5 + R5 2 + R1 2 + R2 2 = 11

Central Plaza:
R7 6 + R1 1 + R2 1 + R3 1 + R4 1 = 10

Cafe ì£¼ë?:
R3 3 = 3

Public Facility ì£¼ë?:
R4 3 = 3

Main Route:
R8 5 = 5

Entry / Exit ?´ë™ì¤?
R1 1 + R2 2 = 3
```

??allocation?€ **ì´ˆê¸° Spawn ?„ì¹˜ ëª©ì **?´ê³ ,
Route ?ì²´ë¥?ë°”ê¾¸??ê²ƒì´ ?„ë‹ˆ??

---

# 6. Spawn êµ¬í˜„ ?ì¹™

## 6.1 ê¸ˆì?

?¤ìŒ?€ ê¸ˆì??œë‹¤.

```text
??Waypoint
TMJ ?˜ì •
Map geometry ?˜ì •
Door width ?˜ì •
Collision ?„í™”
?„ì˜ teleport ì¢Œí‘œ ?˜ë“œì½”ë”©
NPC?¼ë¦¬ ê²¹ì¹œ Spawn
Collision object ?´ë? Spawn
World bounds ë°?Spawn
```

## 6.2 ?ˆìš© ë°©ì‹

ê¸°ì¡´ Route segment / waypoint?€
ê¸°ì¡´ Map Spec???¹ì¸???ì—­???´ìš©??deterministic?˜ê²Œ Spawn?œë‹¤.

ê¶Œì¥ êµ¬ì¡°:

```ts
type FullFlowSpawnDescriptor = {
  route: AllRouteId;
  area: FullFlowArea;
  species: Species;
  size: FullFlowSize;
  // ê¸°ì¡´ route???´ëŠ segment?ì„œ ?œì‘? ì? ?˜í??´ëŠ” ?•ë³´
  fromIndex: number;
  toIndex: number;
  // ?ëŠ” equivalent deterministic seed
}
```

?¤ì œ spawn ?„ì¹˜???´ë‹¹ Route segment ?„ì—??

```text
approved physical footprint
+ fixed collision
+ existing NPC footprint
+ world bounds
```

ë¥?ê²€?¬í•˜ë©´ì„œ deterministic offset searchë¡?ì°¾ëŠ”??

ê¸°ì¡´ `createSmoke()`ì²˜ëŸ¼ `canOccupy()`ë¥??¬ìš©?œë‹¤.

32px ?ëŠ” 64px deterministic increment???ˆìš©?œë‹¤.

??

> ?´ë‹¹ area / route ì¡°ê±´??ë§Œì¡±?˜ëŠ” ?ˆì „ Spawn??ì°¾ì? ëª»í•˜ë©?> ?¤ë¥¸ ì§€??œ¼ë¡?ì¡°ìš©???¬ë°°ì¹˜í•˜ì§€ ë§ê³  explicit errorë¥?ë°œìƒ?œì¼œ??

Spawn ?„ë£Œ ??ë°˜ë“œ??runtime assertion:

```text
NPC count = 35
Route counts ?•í™•
Species counts ?•í™•
Size proxy ?•í™•
Area counts ?•í™•
initial fixed collision = 0
initial NPC-NPC overlap = 0
world bounds violation = 0
```

???˜í–‰?œë‹¤.

---

# 7. ê¸°ì¡´ Limited Smoke Regression?€ ê·¸ë?ë¡?? ì?

?„ì¬:

```text
SMOKE_ROUTES = R1~R5
createSmoke(map) = 10 NPC
stepSmoke default duration = 120 sec
```

???˜ë?ë¥?ê¹¨ëœ¨ë¦¬ë©´ ???œë‹¤.

?¹íˆ ê¸ˆì?:

```text
SMOKE_ROUTESë¥?R1~R8ë¡?ë°”ê¿” createSmoke()ê°€ 16ëª…ì„ ë§Œë“œ??ê²?ê¸°ì¡´ 120 secë¥?330 secë¡??¨ìˆœ ì¹˜í™˜?˜ëŠ” ê²?ê¸°ì¡´ tests??ê¸°ë?ê°’ì„ Full Flow??ë§ì¶° ?˜ì •?˜ëŠ” ê²?```

ê¸°ì¡´ Limited?€ Full Flowë¥?ë¶„ë¦¬?œë‹¤.

---

# 8. ê¶Œì¥ ?Œì¼ êµ¬ì¡°

ê¸°ì¡´ `src/plazaTraffic.ts`??Full Flow ?„ë?ë¥?ë°€???£ì? ?ŠëŠ” ê²ƒì„ ê¶Œì¥?œë‹¤.

??

```text
src/plazaTraffic.ts
??Fix4 movement core
??R1~R8 path lookup
??Limited Smoke ? ì?

src/plazaFullFlow.ts
??Full Flow preset / creator
??warm-up / measurement phase
??Full Flow metric collector
??resetMeasurement()
```

?•í™•???Œì¼ëª…ì? ?„ë¡œ?íŠ¸ ?¤í??¼ì— ë§ê²Œ ì¡°ì • ê°€?¥í•˜??

?µì‹¬?€:

```text
Movement Core
??Full Flow Scenario / Measurement Harness
```

ë¥?ë¶„ë¦¬?˜ëŠ” ê²ƒì´??

---

# 9. stepSmoke Duration ?¼ë°˜??
?„ì¬ `stepSmoke()`??120 sec?ì„œ ?ë™ ?•ì??œë‹¤.

Full Flow?ì„œ??

```text
Warm-up 30 sec
+
Measurement 300 sec
=
Total Simulation 330 sec
```

ê°€ ?„ìš”?˜ë‹¤.

ìµœì†Œ ë³€ê²½ìœ¼ë¡?`SmokeRun`??optional duration??ì¶”ê??´ë„ ?œë‹¤.

??

```ts
type SmokeRun = {
  ...
  maxSeconds?: number;
}
```

ê·¸ë¦¬ê³?

```ts
const maxSeconds = run.maxSeconds ?? 120;
```

?•íƒœë¡?ê¸°ì¡´ default 120 secë¥?ë³´ì¡´?œë‹¤.

Limited:

```text
maxSeconds undefined
??120 sec
```

Full Flow:

```text
maxSeconds = 330
```

ê¸°ì¡´ `createSmoke()` ë°˜í™˜ê°’ì— 330???£ì? ë§ˆë¼.

---

# 10. Warm-up / Measurement ???•í™•???•ì±…

## 10.1 Phase

```text
0 <= t < 30
??WARMUP

30 <= t < 330
??MEASUREMENT

t >= 330
??COMPLETE
```

## 10.2 Warm-up ?™ì•ˆ

?¤ì œ Fix4 Traffic??ê·¸ë?ë¡??¤í–‰?œë‹¤.

```text
Movement
Yield
Side-step
Narrow Reservation
W12 FIFO
Door Enter / Exit
Collision
```

?„ë? ?•ìƒ ?‘ë™?´ì•¼ ?œë‹¤.

ê°€ì§?warm-up?´ë‚˜ ?•ì? ?íƒœ??ê¸ˆì??œë‹¤.

## 10.3 t = 30 sec

NPCë¥??¬Spawn?˜ì? ?ŠëŠ”??

### ë°˜ë“œ??? ì?

```text
x / y
target
direction
pause
doorTarget
inside

Narrow locks:
members
queue
direction

W12 merge:
owner
queue

yieldTo
yieldBackoff
forwardWait
ê¸°í? Movement Control State
```

### Measurement Counterë§?ì´ˆê¸°??
```text
trips = 0
arrivals = 0
blockedEvents = 0
longestWait = 0
recoveries = 0
enters = 0
exits = 0

measurement current wait = 0
measurement blocked accumulator = 0
measurement collision accumulator = 0
door measurement counts = 0
narrow measurement counts = 0
W12 measurement counts = 0
```

?„ì¬ `SmokeNpc.wait`ê°€ measurement block duration ??• ???˜ë?ë¡?t=30?ì„œ `wait = 0`?¼ë¡œ reset?´ë„ ?œë‹¤.

??

```text
forwardWait
yieldTo
yieldBackoff
reservation / merge state
```

??? ì??˜ì—¬ Traffic behaviorê°€ warm-up boundary?ì„œ ë°”ë€Œì? ?Šê²Œ ?œë‹¤.

`blockedBy`??measurement eventë¥??ˆë¡œ ?€ ???ˆë„ë¡?reset?´ë„ ?œë‹¤.
`blockedBy`ê°€ Movement permission???¬ìš©?˜ì? ?ŠëŠ”ì§€ ?¤ì œ ì½”ë“œë¥??•ì¸????ì²˜ë¦¬?œë‹¤.

## 10.4 Boundary ì²˜ë¦¬

30ì´ˆë? frame deltaê°€ ?˜ì–´ê°€??ê²½ìš°
warm-upê³?measurementë¥???frame???ì? ?ŠëŠ”??

ê°€?¥í•˜ë©?boundary?ì„œ dtë¥?split?˜ì—¬:

```text
... ??exactly 30.000 sec
reset measurement
remaining dt ??measurement
```

?œì„œë¡?ì²˜ë¦¬?œë‹¤.

Node?€ Browserê°€ ?™ì¼??semanticsë¥??¬ìš©?´ì•¼ ?œë‹¤.

---

# 11. Full Flow Metric Collector

Node?€ Browser?ì„œ ?™ì¼??Collectorë¥??¬ì‚¬?©í•œ??

ìµœì†Œ ê²°ê³¼:

```text
npc_count
route_counts
species_counts
size_counts

warmup_seconds
measurement_seconds

completed_routes
waypoint_arrivals
per_route:
  trips
  arrivals
  max_wait
  blocked_events

blocked_time_total
max_continuous_blocked_time
blocked_npc_count_end
blocked_npc_count_peak

severe_block_count
unrecovered_20sec
deadlock_count

recoveries

collision_violation

cafe_enter_count
cafe_exit_count
facility_enter_count
facility_exit_count

upper_narrow_pass_count
lower_narrow_pass_count
upper_narrow_max_queue
lower_narrow_max_queue

w12_max_queue
w12_owner_change_count
w12_queue_recovery_count
```

## Metric ?˜ë?

### blocked_time_total

Measurement ?™ì•ˆ:

```text
blockedBy != ''
```

??NPC??actor-seconds ?„ì ê°’ìœ¼ë¡?ê¸°ë¡?œë‹¤.

??ê°’ì? `Blocked >= 0.5s` ë¶„ë¥˜?€ ë³„ê°œ??raw waiting-time accumulator?¼ê³  ê²°ê³¼ JSON??ëª…ì‹œ?œë‹¤.

### blocked_npc_count

?„ì¬ ?„ë¡œ?íŠ¸??Block ê¸°ì?:

```text
wait >= 0.5 sec
```

???¬ìš©?œë‹¤.

```text
blocked_npc_count_end
= measurement ì¢…ë£Œ ?œì 

blocked_npc_count_peak
= measurement ?™ì•ˆ ìµœë? ?™ì‹œ Blocked NPC ??```

### severe_block_count

ê°?Block episodeê°€:

```text
wait >= 10 sec
```

ë¥?ìµœì´ˆë¡??˜ì„ ??1??ì¦ê??œë‹¤.

ê°™ì? episode?ì„œ frameë§ˆë‹¤ ì¤‘ë³µ ì¦ê??œí‚¤ì§€ ?ŠëŠ”??

### unrecovered_20sec / deadlock_count

Prototype Hard FAIL ?ë‹¨???„í•´
20ì´?threshold crossing???“ì¹˜ì§€ ?ŠëŠ”??

ê¶Œì¥:

```text
deadlock_count
= measurement ì¤?20 sec threshold???„ë‹¬??unique block episode ??
unrecovered_20sec
= measurement ì¢…ë£Œ ?œì ?ë„ wait >= 20 sec??NPC ??```

ì¶”ê?ë¡?

```text
ever_20sec_block_count
```

ë¥?ë³„ë„ë¡?ê¸°ë¡?´ë„ ?œë‹¤.

PASS Gate?ì„œ??

```text
deadlock_count = 0
ever_20sec_block_count = 0
collision_violation = 0
```

?´ì–´???œë‹¤.

### Door count

?„ì¬ core?ì„œ:

```text
W16 ??W17 = Cafe
W18 ??W19 = Facility
```

?˜ë?ë¥??´ìš©?œë‹¤.

enter/exit transition???¤ì œ state changeë¡?ì¸¡ì •?œë‹¤.

Route ?´ë¦„ë§?ë³´ê³  countë¥?ì¶”ì •?˜ì? ?ŠëŠ”??

### Narrow

Upper / Lower Narrow ?ì—­???¤ì œ physical membership transition??ì¶”ì ?˜ì—¬ pass countë¥?ì¸¡ì •?œë‹¤.

### W12

?¤ì œ `run.merge.owner / queue` ?íƒœë¥?ê´€ì°°í•˜??

```text
max queue
owner changes
non-empty queue ??empty queue recovery
```

ë¥?ì¸¡ì •?œë‹¤.

---

# 12. Physical Collision Measurement

Full Flow Measurement ?™ì•ˆ ë§?simulation step?ì„œ:

```text
fixed collision
NPC-NPC physical overlap
world bounds
```

ë¥?ê²€?¬í•œ??

Sprite visual overlap?€ ?¬ê¸°??collision violation?¼ë¡œ ?¸ì? ?ŠëŠ”??

`collision_violation`?€ physical footprint ê¸°ì??´ë‹¤.

ê°™ì? frame?ì„œ A-B / B-Aë¥??´ì¤‘ ê³„ì‚°?˜ì? ?Šë„ë¡?pair??`i < j` ë°©ì‹?¼ë¡œ ?¼ë‹¤.

ê²°ê³¼??

```text
fixed_collision_violation
npc_collision_violation
world_bounds_violation
collision_violation_total
```

??ê°€?¥í•˜ë©?ë¶„ë¦¬?´ì„œ ì¶œë ¥?œë‹¤.

PASS???„ë? 0?´ì–´???œë‹¤.

---

# 13. 35 NPC Full Flow Creator

ëª…ì‹œ?ì¸ entry pointë¥?ë§Œë“ ??

??

```ts
createPlazaFullFlow35(map, external?)
```

ë°˜í™˜ ê°ì²´??ìµœì†Œ:

```text
35 NPC SmokeRun
phase state
measurement state
metric collector state
```

ë¥??¬í•¨?œë‹¤.

?ì„± ì§í›„ self-checkë¥??¤í–‰?œë‹¤.

?˜ëª»??count / overlap / spawn?´ë©´
silent fallback ?†ì´ throw?œë‹¤.

---

# 14. Node Logic Measurement Script

35 NPC Full Flowë¥??ë™ ?¤í–‰?˜ëŠ” scriptë¥?ì¶”ê??œë‹¤.

??

```text
scripts/measure-plaza-full-flow-35.mjs
```

Repository ê¸°ì¡´ script convention???°ì„ ?œë‹¤.

?¤í–‰:

```text
Warm-up = 30 sec
Measurement = 300 sec
Simulation step = 1/60 sec
```

?¤ì œ wall-clock 330ì´ˆë? ê¸°ë‹¤ë¦??„ìš”???†ë‹¤.
Node?ì„œ??deterministic simulation time?¼ë¡œ ë¹ ë¥´ê²??¤í–‰?œë‹¤.

??

> simulation semantics??Browser?€ ?™ì¼??Full Flow Harnessë¥??¬ìš©?´ì•¼ ?œë‹¤.

ë³„ë„ ê°„ì´ movement simulatorë¥?ë§Œë“¤ë©????œë‹¤.

ìµœì¢… JSON??stdout??ì¶œë ¥?œë‹¤.

ê°€?¥í•˜ë©?raw result??

```text
artifacts/plaza_full_flow_35_raw.json
```

ê°™ì? non-Source-of-Truth ?„ì¹˜???€?¥í•œ??

Repository??ê¸°ì¡´ validation output convention???ˆë‹¤ë©?ê·¸ê²ƒ???°ë¥¸??

Narrative Markdown Result ë¬¸ì„œ??ë§Œë“¤ì§€ ë§ˆë¼.

---

# 15. Browser Full Flow Mode

?¤ì œ Phaser Browser?ì„œ??ê°™ì? 35 NPC Scenarioë¥??¤í–‰?????ˆì–´???œë‹¤.

ê¸°ì¡´ 10 NPC Smoke UI??? ì??œë‹¤.

ìµœì†Œ ì¶”ê?:

```text
Full Flow 35 Start
Full Flow Stop / Reset
```

?ëŠ” ê¸°ì¡´ selector convention??ë§ëŠ”:

```text
full35
```

mode ?˜ë‚˜.

ê¸°ì¡´ R1~R5 smoke menuë¥??? œ?˜ê±°??ë°”ê¾¸ì§€ ë§ˆë¼.

## Browser Report

ìµœì†Œ ?œì‹œ:

```text
NPC 35
Phase: WARMUP / MEASUREMENT / COMPLETE
Global elapsed
Measurement elapsed

Completed Routes
Collision
20s+ Block / Deadlock
Max Wait
Door counts
Narrow queue
W12 queue

FPS current
FPS avg during measurement
FPS min during measurement
```

FPS??**Measurement 300 sec ?™ì•ˆë§?* ì§‘ê³„?œë‹¤.
Warm-up FPSë¥?measurement average???ì? ?ŠëŠ”??

Node ê²°ê³¼?ëŠ” FPSë¥??°ì? ë§ˆë¼.

Node-only ê²°ê³¼ë¡?FPS PASSë¥?ì£¼ì¥?˜ì? ë§ˆë¼.

---

# 16. PlazaParkScene ?„ì¬ ?¸í™˜ ë¬¸ì œ???¨ê»˜ ì²˜ë¦¬

?„ì¬ Scene?€ Candidate path lookup?€ ì§€?í•˜ì§€ë§??œì‹œ ë¡œì§ ?¼ë?ê°€ R1~R5??ë¬¶ì—¬ ?ˆì„ ???ˆë‹¤.

?¤ì œ ì½”ë“œë¥??•ì¸?˜ì—¬ ìµœì†Œ ?˜ì •?œë‹¤.

??

```text
Object.keys(SMOKE_ROUTES)
5ê°?route color array
/120s ê³ ì • ?œì‹œ
```

Full Flow mode?ì„œë§?R1~R8 / 330 sec / phaseê°€
?•ìƒ?ìœ¼ë¡??œì‹œ?˜ë„ë¡??œë‹¤.

Limited Smoke ?”ë©´ ?˜ë???ê·¸ë?ë¡?? ì??œë‹¤.

---

# 17. Test ì¶”ê?

???ŒìŠ¤?¸ë? ì¶”ê??œë‹¤.

??

```text
tests/fullFlowHarness.test.ts
```

ìµœì†Œ ê²€ì¦?

## A. Creator self-check

```text
NPC = 35
route counts = 4/5/4/4/2/5/6/5
species = 8/7/7/7/6
proxy size counts ?•í™•
area counts = 11/10/3/3/5/3
initial fixed collision = 0
initial NPC overlap = 0
world bounds violation = 0
```

## B. Limited Regression

```text
createSmoke(map).npcs.length = 10
default duration = 120 sec
R1~R5 ê¸°ì¡´ semantics ? ì?
```

ê¸°ì¡´ ?ŒìŠ¤?¸ë„ ê·¸ë?ë¡??µê³¼?´ì•¼ ?œë‹¤.

## C. Warm-up reset state preservation

t=30 reset ????

? ì? ?•ì¸:

```text
x/y
target
direction
pause
inside
doorTarget
forwardWait
yieldTo
yieldBackoff
locks
merge
```

reset ?•ì¸:

```text
trips
arrivals
blockedEvents
longestWait
recoveries
enters
exits
measurement wait
measurement accumulators
```

## D. Phase duration

```text
29.99 ??WARMUP
30.00 ??MEASUREMENT
329.99 ??MEASUREMENT
330.00 ??COMPLETE
```

floating point ?Œë¬¸??exact literal ë¹„êµê°€ ì·¨ì•½?˜ë©´
epsilon-based checkë¥??¬ìš©?œë‹¤.

## E. Short Full Flow Smoke

?„ì²´ 330ì´ˆë? unit test??ê°•ì œ?˜ì—¬ test suiteë¥?ë¶ˆí•„?”í•˜ê²??ë¦¬ê²?ë§Œë“¤ì§€ ?Šì•„???œë‹¤.

?€??Harnessê°€:

```text
multiple routes
35 NPC
warm-up boundary
measurement collector
```

ë¥?ëª?ì´??™ì•ˆ ?¤ì œ `stepSmoke()`ë¡??¤í–‰?˜ëŠ” short smoke testë¥?ì¶”ê??œë‹¤.

?¤ì œ 330ì´?run?€ Node measurement script?ì„œ ?˜í–‰?œë‹¤.

---

# 18. ?¤ì œ 35 NPC Logic Run

êµ¬í˜„ ?„ë£Œ ??ë°˜ë“œ???¤ì œ scriptë¥??¤í–‰?œë‹¤.

ê²°ê³¼ë¥??¨ê¸°ê±°ë‚˜ FAIL???˜ì •?˜ë ¤ ?˜ì? ë§ˆë¼.

?ì • ê¸°ì?:

## PASS

```text
npc_count = 35

R1~R8 ëª¨ë‘ measurement trips > 0

collision_violation_total = 0

deadlock_count = 0
ever_20sec_block_count = 0
unrecovered_20sec = 0

Cafe enter / exit ë°˜ë³µ ë°œìƒ
Facility enter / exit ë°˜ë³µ ë°œìƒ

Upper / Lower Narrow?ì„œ
20 sec+ unrecovered êµì°© ?†ìŒ

W12 queueê°€ ?êµ¬ ?„ì ?˜ì? ?ŠìŒ
```

`max wait < 10 sec`??ëª©í‘œ?´ì? Hard FAIL???„ë‹ˆ??

## WARN

```text
3~10 sec Block ???Œë³µ
10~20 sec Block ???Œë³µ
?œê°„ Queue
Body visual overlap
```

??

```text
20 sec+ block
```

?€ ?´ë²ˆ Full Flow?ì„œ??FAILë¡?ë³¸ë‹¤.

---

# 19. 35 NPC FAIL ???‰ë™

?¤ìŒ?€ ?ë™?¼ë¡œ ?˜ì? ë§ˆë¼.

```text
Movement tuning
Fix5
Route ?˜ì •
NPC count 30?¼ë¡œ ê°ì†Œ
Map ?˜ì •
Collision ?„í™”
Spawn area ë³€ê²?```

FAIL resultë¥?ê·¸ë?ë¡??€?¥í•˜ê³?ë³´ê³ ?œë‹¤.

30 NPC fallback?€
?¬ìš©?ì? ë³„ë„ ë°°ì¹˜ë¥??•ì •?????¤ìŒ ?‘ì—…?ì„œ ?˜í–‰?œë‹¤.

---

# 20. ?¤í–‰ ëª…ë ¹

ë°˜ë“œ???¤í–‰:

```powershell
npm run typecheck
npm test
npm run build
```

ê·??¤ìŒ 35 NPC Node Logic Run script ?¤í–‰.

??

```powershell
node scripts/measure-plaza-full-flow-35.mjs
```

?¤ì œ package/script êµ¬ì¡°??ë§ê²Œ ëª…ë ¹???¬ìš©?œë‹¤.

---

# 21. ìµœì¢… ë³´ê³  ?•ì‹

?„ë˜ ?œì„œ ê·¸ë?ë¡?ë³´ê³ ?œë‹¤.

## 1. ë³€ê²??Œì¼

ê°??Œì¼ë³?ë³€ê²?ëª©ì .

## 2. ê¸°ì¡´ Fix4 semantics

```text
ë³€ê²??†ìŒ / ë³€ê²??ˆìŒ
```

ë³€ê²??ˆë‹¤ë©?ì¦‰ì‹œ ëª…ì‹œ.

## 3. ê¸°ì¡´ Limited Regression

```text
createSmoke NPC count
default duration
ê¸°ì¡´ tests
```

## 4. Full Flow Creator Self-check

```text
NPC count
route counts
species counts
size counts
area counts
initial collision
```

## 5. Warm-up Reset

```text
Traffic state preserved ?¬ë?
Measurement counter reset ?¬ë?
```

## 6. 35 NPC Node Logic Run

?„ì²´ JSON ?ëŠ” ì¶©ë¶„???µì‹¬ ?„ë“œ:

```text
warmup_seconds
measurement_seconds

completed_routes
waypoint_arrivals

R1~R8 trips
R1~R8 max wait

blocked_time_total
max_continuous_blocked_time
blocked_npc_count_peak

severe_block_count
deadlock_count
ever_20sec_block_count
unrecovered_20sec

recoveries

collision_violation_total

Cafe enter / exit
Facility enter / exit

Upper Narrow pass / max queue
Lower Narrow pass / max queue

W12 max queue / owner change / queue recovery
```

## 7. Browser Full Flow Mode

```text
êµ¬í˜„ ?¬ë?
ì§ì ‘ 5ë¶?Browser ì¸¡ì •???¤ì œ ?˜í–‰?ˆëŠ”ì§€ ?¬ë?
```

?¤ì œ ?¤í–‰?˜ì? ?Šì•˜?¤ë©´:

```text
NOT MEASURED
```

?¼ê³  ëª…í™•???´ë‹¤.

FPSë¥?ì¶”ì •?˜ì? ë§ˆë¼.

## 8. typecheck

PASS / FAIL

## 9. tests

ê¸°ì¡´ tests?€ ? ê·œ testsë¥?êµ¬ë¶„?´ì„œ ê²°ê³¼ ?‘ì„±.

## 10. build

PASS / FAIL

ê¸°ì¡´ Bundle Size Warning?€ ë³„ë„ WARN.

## 11. ìµœì¢… Logic ?ì •

```text
PASS
PASS with WARN
FAIL
```

ê·¼ê±°ë¥??«ìë¡??œì‹œ?œë‹¤.

## 12. ì¤‘ë‹¨

ê²°ê³¼ ë³´ê³  ??ë©ˆì¶˜??

?¤ìŒ ?‘ì—…:

```text
Graphics Integration
30 NPC fallback
Movement Fix
ë¬¸ì„œ ê°±ì‹ 
```

ì¤??´ë–¤ ê²ƒë„ ?ë™?¼ë¡œ ?œì‘?˜ì? ë§ˆë¼.

---

# 22. ê¸ˆì??¬í•­ ?”ì•½

```text
Map ?˜ì • ê¸ˆì?
TMJ ?˜ì • ê¸ˆì?
Waypoint ?˜ì • ê¸ˆì?
Door Width ?˜ì • ê¸ˆì?
Collision ?„í™” ê¸ˆì?

Fix4 Movement ?¬ì‘??ê¸ˆì?
Fix5 ?ë™ ?œì‘ ê¸ˆì?
??pathfinding ê¸ˆì?
ë³¸ê²© personal spacing ê¸ˆì?

ê¸°ì¡´ createSmoke 10 NPC ?˜ë? ë³€ê²?ê¸ˆì?
ê¸°ì¡´ 120 sec regression ë³€ê²?ê¸ˆì?

30 NPC fallback ?ë™ ?¤í–‰ ê¸ˆì?

Narrative Source-of-Truth ë¬¸ì„œ ?ë™ ê°±ì‹  ê¸ˆì?
Graphics ?‘ì—… ê¸ˆì?
CCTV êµ¬í˜„ ê¸ˆì?
Shopping / Residential ?‘ì—… ê¸ˆì?
```

???‘ì—…?€ **35 NPC Full Flow Harness êµ¬í˜„ + Node Logic Measurement ê²°ê³¼ ë³´ê³ **ê¹Œì?ë§??œë‹¤.
