# Codex Task ??Plaza/Park 35 NPC Full Flow Harness Correctness Fix + Re-run

## ëª©ì 

?„ì¬ êµ¬í˜„??35 NPC Full Flow Harness??**ì¸¡ì • ?•í™•??ë¬¸ì œë§??˜ì •**?˜ê³ ,
?™ì¼??35 NPC ì¡°ê±´?¼ë¡œ Logic Simulation???¤ì‹œ ?¤í–‰?œë‹¤.

?´ë²ˆ ?‘ì—…?€ Movement ê°œì„  ?‘ì—…???„ë‹ˆ??

?„ì¬ ì²?35 NPC Run?€ ?¤ìŒ ë¬¸ì œ ?Œë¬¸??**ìµœì¢… FAILë¡??•ì •?˜ì? ?ŠëŠ”??*.

```text
1. area labelê³??¤ì œ spawn ì¢Œí‘œê°€ ?¼ì¹˜?˜ëŠ”ì§€ ê²€ì¦ë˜ì§€ ?ŠìŒ
2. blocked_events ì¸¡ì •ê°’ì´ ?¤ì œë¡?ì¦ê??˜ì? ?ŠìŒ
3. narrow max queueê°€ reservation queueê°€ ?„ë‹ˆ??zone ?´ë? NPC ?˜ë? ??4. narrow passê°€ ?¤ì œ ?µê³¼ ?„ë£Œê°€ ?„ë‹ˆ??zone ì§„ì… ?œê°„ count??5. warm-up ì¢…ë£Œ ??W12 metric baseline???œë?ë¡?seed?˜ì? ?Šì„ ???ˆìŒ
6. raw JSON??ê¸°ì¡´ ?Œì¼ ì¡´ì¬ ??ê°±ì‹ ?˜ì? ?ŠìŒ
7. warm-up reset testê°€ ?¤ì œ ë³´ì¡´?´ì•¼ ??traffic stateë¥?ì¶©ë¶„??assert?˜ì? ?ŠìŒ
8. phase boundary test ?¼ë?ê°€ stepFullFlow ?´ë? 0.05s cap ?Œë¬¸???˜ë„???œê°„???¤ì œë¡?ì§„í–‰?˜ì? ?ŠìŒ
```

??ë¬¸ì œë¥??˜ì •????**35 NPC / Warm-up 30s / Measurement 300s**ë¥??¤ì‹œ ?¤í–‰?˜ê³ ,
ê²°ê³¼ë¥?ë³´ê³ ????ë©ˆì¶˜??

---

# 1. ë°˜ë“œ??ë¨¼ì? ?½ê¸°

Repository ê¸°ì? ?¤ìŒ ?Œì¼???½ëŠ”??

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
src/plazaFullFlow.ts
src/PlazaParkScene.ts
src/main.tsx
src/collision.ts
src/corridorCapacity.ts
src/plazaPark.ts

tests/plazaTraffic.test.ts
tests/candidateRoutes.test.ts
tests/fullFlowHarness.test.ts

scripts/measure-plaza-full-flow-35.mjs

public/maps/plaza-park.tmj
```

?„ì¬ working tree?ì„œ ???Œì¼??ìµœì‹  ?íƒœë¥?ê¸°ì??¼ë¡œ ?‘ì—…?œë‹¤.

---

# 2. ?ˆë? ë³€ê²½í•˜ì§€ ë§?ê²?
?¤ìŒ?€ ?´ë? ?¹ì¸??Source of Truth??

## Route

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

## Routeë³?NPC ??
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

## Species / Proxy

```text
Rabbit = 8 ??Small 18Ã—12
Cat    = 7 ??Medium 22Ã—14
Fox    = 7 ??Medium 22Ã—14
Dog    = 7 ??Medium 22Ã—14
Tiger  = 6 ??Large 26Ã—16
```

## ì´ˆê¸° Area count

```text
Park             = 11
CentralPlaza     = 10
Cafe             = 3
PublicFacility   = 3
MainRoute        = 5
EntryExit        = 3
```

## ?œê°„

```text
Warm-up     = 30 sec
Measurement = 300 sec
Total       = 330 sec
```

## Movement Core

`src/plazaTraffic.ts`??Fix4 semantics??ë³€ê²½í•˜ì§€ ?ŠëŠ”??

```text
side-step
yield
bounded backoff
narrow reservation
W12 FIFO
W12 owner priority
door semantics
physical collision semantics
```

ê¸ˆì?:

```text
Fix5
movement parameter tuning
route ?˜ì •
waypoint ?˜ì •
TMJ ?˜ì •
map geometry ?˜ì •
collision ?„í™”
30 NPC fallback
```

---

# 3. ?µì‹¬ ?˜ì • 1 ??Area Label???„ë‹ˆ???¤ì œ ì¢Œí‘œë¡?Spawn ë³´ì¥

?„ì¬ êµ¬í˜„?€ `ffArea`ë¥?labelë¡œë§Œ ?€?¥í•˜ê³??¤ì œ Spawn ì¢Œí‘œê°€ ?´ë‹¹ Area???í•˜?”ì? ë³´ì¥?˜ì? ?ŠëŠ”??

?´ë? ?˜ì •?œë‹¤.

## 3.1 ?¹ì¸??Spawn Mapping

ê°?ì´ˆê¸° Area???€???¤ìŒ **ê¸°ì¡´ Route segment**ë§??¬ìš©?œë‹¤.

```text
Park
- R6 ??W03?”W05 ?ëŠ” W05?”W07
- R5 ??W09?”W11
- R1 ??W05?”W12 ì¤?Park ?ì—­???¬í•¨?˜ëŠ” ë¶€ë¶?- R2 ??W05?”W08

CentralPlaza
- R7 ??W13?”W14 ?ëŠ” W14?”W15
- R1 ??W12?”W14 ì¤?Central Plaza ?ì—­???¬í•¨?˜ëŠ” ë¶€ë¶?- R2 ??W12?”W14 ì¤?Central Plaza ?ì—­???¬í•¨?˜ëŠ” ë¶€ë¶?- R3 ??W12?”W13 ì¤?Central Plaza ?ì—­???¬í•¨?˜ëŠ” ë¶€ë¶?- R4 ??W12?”W14 ì¤?Central Plaza ?ì—­???¬í•¨?˜ëŠ” ë¶€ë¶?
Cafe
- R3 ??W13?”W16 ì¤?Cafe Zone???¬í•¨?˜ëŠ” ë¶€ë¶?
PublicFacility
- R4 ??W12?”W18 ì¤?Public Facility Zone???¬í•¨?˜ëŠ” ë¶€ë¶?
MainRoute
- R8 ??W21?”W20 ?ëŠ” W20?”W22

EntryExit
- R1 ??W20?”W21 ì¤?West Exit ì¸?- R2 ??W01?”W05 ì¤?North Entry ì¸?- R2 ??W20?”W22 ì¤?East Exit ì¸?```

ì¤‘ìš”:

- ??ì¢Œí‘œë¥??„ì˜ ?˜ë“œì½”ë”©?˜ì? ?ŠëŠ”??
- ê¸°ì¡´ waypoint pair + ?¹ì¸??area rectangle intersection???´ìš©?œë‹¤.
- ?¤ì œ map spec / TMJ???¹ì¸ Area rectangle??sourceë¡??¬ìš©?œë‹¤.
- area rectangle??TMJ objectë¡?ì¡´ì¬?˜ë©´ ê·?objectë¥??°ì„  ?¬ìš©?œë‹¤.
- ë¬¸ì„œ?ë§Œ ?ˆê³  TMJ???†ë‹¤ë©?ë¬¸ì„œ???¹ì¸ rectangle??ì½”ë“œ ?ìˆ˜ë¡?ëª…ì‹œ?˜ë˜ ì¶œì²˜ ì£¼ì„???¨ê¸´??
- ?„ì˜ ì¶”ì • ì¢Œí‘œ ê¸ˆì?.

## 3.2 Spawn Search

ê°?descriptor??ìµœì†Œ ?¤ìŒ ?•ë³´ë¥?ê°€?¸ì•¼ ?œë‹¤.

```ts
route
area
segmentStart
segmentEnd
species
size
direction
```

Spawn position?€ ?´ë‹¹ segment?€ area rectangle??êµì°¨ ë¶€ë¶??ˆì—??deterministic search?œë‹¤.

ì¡°ê±´:

```text
inside assigned area
on assigned approved route segment
fixed collision ?†ìŒ
NPC-NPC overlap ?†ìŒ
world bounds ?´ë?
approved footprint ?¬ìš©
```

32px step ?ëŠ” ???‘ì? deterministic step ?¬ìš© ê°€??

?ˆì „??spawn??ì°¾ì? ëª»í•˜ë©?

```text
throw
```

?˜ê³  ì¡°ìš©???¤ë¥¸ areaë¡???¸°ì§€ ?ŠëŠ”??

---

# 4. Creator Self-check ê°•í™”

`createPlazaFullFlow35()` ì§í›„ ë°˜ë“œ???¤ì œ ì¢Œí‘œë¡??¤ìŒ??ê²€ì¦í•œ??

```text
NPC count = 35
route counts ?•í™•
species counts ?•í™•
size counts ?•í™•

actual spatial area counts:
Park = 11
CentralPlaza = 10
Cafe = 3
PublicFacility = 3
MainRoute = 5
EntryExit = 3

ê°?NPC ì¢Œí‘œê°€ ?ì‹ ??ffArea rectangle ?ˆì— ?¤ì œ ?¬í•¨??
initial fixed collision = 0
initial NPC overlap = 0
world bounds violation = 0
```

`ffArea` label countë§??¸ê³  PASS?œí‚¤ë©????œë‹¤.

Self-check output?ë„:

```text
declared area count
actual spatial area count
```

ë¥?ê°€?¥í•˜ë©?êµ¬ë¶„??ì¶œë ¥?œë‹¤.

?˜ì? ë°˜ë“œ???¼ì¹˜?´ì•¼ ?œë‹¤.

---

# 5. ?µì‹¬ ?˜ì • 2 ??blocked_events ?¤ì œ ì¸¡ì •

?„ì¬ `mBlockedEvents`??resetë§??˜ê³  ?¤ì œë¡?ì¦ê??˜ì? ?ŠëŠ”??

measurement phase?ì„œ ?¤ì œ block episodeê°€ ?œì‘????1??ì¦ê??œí‚¨??

?•ì˜:

```text
block episode start
= ?´ì „ measurement step?ì„œ blockedBy == ''
  ?„ì¬ measurement step?ì„œ blockedBy != ''
```

?ëŠ” ?™ì¼ ?˜ë????•í™•??state transition.

??episode?ì„œ frameë§ˆë‹¤ ì¦ê??œí‚¤ì§€ ?ŠëŠ”??

Warm-up ì¢…ë£Œ ???´ë? blocked ?íƒœ?¼ë©´:

```text
measurement boundary?ì„œ ??episodeë¡??œì‘?˜ëŠ”ì§€
```

ë¥?ëª…ì‹œ?ìœ¼ë¡??•ì˜?œë‹¤.

?´ë²ˆ ê¸°ì?:

> t=30 ?œì ???´ë? blockedBy != ''?´ë©´ Measurement?ì„œ???˜ë‚˜??active block episodeê°€ ?œì‘??ê²ƒìœ¼ë¡?ë³´ê³  `mBlockedEvents += 1`.

?´í›„ recovery ???¤ì‹œ block?˜ë©´ ??episodeë¡?+1.

---

# 6. ?µì‹¬ ?˜ì • 3 ??Narrow metric ?˜ë? ?˜ì •

?„ì¬ Narrow ê´€??metric?€ ?¤ì œ reservation queue?€ pass completion??ì¸¡ì •?˜ì? ?ŠëŠ”??

## 6.1 Max Queue

?¤ìŒ ?¤ì œ reservation stateë¥??¬ìš©?œë‹¤.

```ts
run.locks['Upper Narrow Path']?.queue.length
run.locks['Lower Narrow Path']?.queue.length
```

?´ë? measurement ?™ì•ˆ ìµœë?ê°’ìœ¼ë¡?ê¸°ë¡?œë‹¤.

Zone ?´ë? actor countë¥?queue sizeë¡??¬ìš©?˜ì? ?ŠëŠ”??

## 6.2 Pass Count

pass count??zone **ì§„ì…**???„ë‹ˆ????actorê°€ narrow zone???¤ì–´ê°”ë‹¤ê°€ ë°˜ë?ìª?ë°–ìœ¼ë¡??•ìƒ?ìœ¼ë¡?ë¹ ì ¸?˜ì˜¨
?„ë£Œ??traversal??1?Œë¡œ ?¼ë‹¤.

ê°„ë‹¨???íƒœ machine ?¬ìš© ê°€??

```text
OUTSIDE
??INSIDE
??OUTSIDE
= 1 pass
```

?¨ìˆœ??ê°™ì? ìª½ìœ¼ë¡??´ì§ ?¤ì–´?”ë‹¤ê°€ ?Œì•„?˜ì˜¤??ê²½ìš°ê°€ ?ˆìœ¼ë©?entry side / exit sideë¥?ë¹„êµ?˜ì—¬ ?¤ì œ ë°˜ë?ì¸?exit???Œë§Œ passë¡??¸ëŠ” ê²ƒì´ ???•í™•?˜ë‹¤.

?„ì¬ Route êµ¬ì¡°??ê°€?¥í•œ ë²”ìœ„?ì„œ ìµœì†Œ ?•í™• êµ¬í˜„??? íƒ?œë‹¤.

ì¤‘ìš”:

- per-frame ì¤‘ë³µ ê¸ˆì?
- inside transitionë§Œìœ¼ë¡?pass ì¦ê? ê¸ˆì?

---

# 7. ?µì‹¬ ?˜ì • 4 ??W12 Measurement Baseline Seed

Warm-up ì¢…ë£Œ t=30 ì§í›„ measurementë¥??œì‘????

```text
_lastW12Owner
_lastW12QueueEmpty
```

ë¥??„ì¬ ?¤ì œ `run.merge` ?íƒœë¡?seed?œë‹¤.

ì¦?measurement ì²?frame?ì„œ
warm-up?ì„œ ?´ì–´ì§?owner/queueë¥???owner change??queue recoveryë¡??¤ì¸?˜ì? ?ŠëŠ”??

reset ?¨ìˆ˜ ?ëŠ” phase transition ì§í›„:

```ts
state._lastW12Owner = state.run.merge?.owner
state._lastW12QueueEmpty = (state.run.merge?.queue.length ?? 0) === 0
```

?€ ?™ì¼ ?˜ë?ë¡?ì²˜ë¦¬?œë‹¤.

---

# 8. ?µì‹¬ ?˜ì • 5 ??Raw Artifact ??ƒ ìµœì‹  ê²°ê³¼ ?€??
?„ì¬ script??ê¸°ì¡´ ?Œì¼???ˆìœ¼ë©?skip?œë‹¤.

?¬ì‹¤?˜ì—?œëŠ” ?˜ëª»???´ì „ ê²°ê³¼ê°€ ?¨ì„ ???ˆìœ¼ë¯€ë¡??˜ì •?œë‹¤.

```text
artifacts/plaza_full_flow_35_raw.json
```

?€ ë§?runë§ˆë‹¤ ?„ì¬ ê²°ê³¼ë¡???–´?´ë‹¤.

ê°€?¥í•˜ë©??´ì „ ê²°ê³¼ ë³´ì¡´???„ìš”?˜ë©´:

```text
artifacts/history/...
```

ê°™ì? timestamped backup??ë³„ë„ë¡?ë§Œë“¤ ???ˆìœ¼???„ìˆ˜ ?„ë‹˜.

?µì‹¬?€ canonical raw output????ƒ ìµœì‹  runê³??¼ì¹˜?˜ëŠ” ê²ƒì´??

---

# 9. ?µì‹¬ ?˜ì • 6 ??Warm-up Reset Test ê°•í™”

?„ì¬ Test C???¤ì œ reportë³´ë‹¤ ?½í•˜??

t=30 reset ì§ì „ê³?ì§í›„???¤ìŒ stateë¥?ëª…ì‹œ?ìœ¼ë¡?assert?œë‹¤.

## ? ì??˜ì–´????
```text
x
y
target
direction
pause
inside
doorTarget
forwardWait
yieldTo
yieldBackoff

locks:
- members
- queue
- direction

merge:
- owner
- queue
```

?? boundary remainder step ?Œë¬¸??x/y ?±ì´ ?¤ì œë¡??Œí­ ?´ë™?????ˆë‹¤ë©?**?•í™•??t=30.000 boundary ì§ì „/ì§í›„ reset ?¨ìˆ˜ ?¸ì¶œ ?œê°„???ŒìŠ¤?¸í•  ???ˆê²Œ**
reset helperë¥?export?˜ê±°???ŒìŠ¤??ê°€?¥í•œ pure helperë¡?ë¶„ë¦¬?œë‹¤.

ê¶Œì¥:

```ts
resetFullFlowMeasurement(...)
```

?ëŠ” equivalent.

reset ?¨ìˆ˜ ?ì²´ë§??¸ì¶œ?ˆì„ ?ŒëŠ” Movement stateê°€ byte-for-byte ?™ì¼?´ì•¼ ?œë‹¤.

## reset?˜ì–´????
```text
mTrips
mArrivals
mBlockedEvents
mLongestWait
mWait
mRecoveries
mEnters
mExits
severeReported
deadlockReported
wait
```

ê·¸ë¦¬ê³?W12 metric baseline?€ ?„ì¬ stateë¡?seed?˜ì–´???œë‹¤.

---

# 10. ?µì‹¬ ?˜ì • 7 ??Phase Boundary Test ?¤ì œ ?œê°„ ê²€ì¦?
?„ì¬ `stepFullFlow(state, ..., 0.1)` ?¸ì¶œ???´ë??ì„œ 0.05ë¡?cap?˜ë?ë¡?329.9ì´?testê°€ ?¤ì œë¡œëŠ” ?ˆë°˜ ?•ë„ë°–ì— ì§„í–‰?˜ì? ?Šì„ ???ˆë‹¤.

?ŒìŠ¤?¸ë? ?¤ì œ elapsed ê¸°ì??¼ë¡œ ?‘ì„±?œë‹¤.

??

```ts
while (state.globalElapsed < 29.99 - EPS) stepFullFlow(..., 0.05)
```

?ëŠ” helper:

```ts
advanceTo(state, targetSeconds)
```

ë¥?ë§Œë“¤???¤ì œ `state.globalElapsed`ë¥??•ì¸?œë‹¤.

ë°˜ë“œ??ê²€ì¦?

```text
globalElapsed < 30 ??WARMUP
globalElapsed == 30 ??MEASUREMENT
globalElapsed < 330 ??MEASUREMENT
globalElapsed == 330 ??COMPLETE
```

floating-point epsilon ?¬ìš©.

?¨ìˆœ??`MEASUREMENT or COMPLETE`ì²˜ëŸ¼ ?ìŠ¨?˜ê²Œ PASS?œí‚¤ì§€ ?ŠëŠ”??

---

# 11. Door Metric???•í™•???•ì¸

?„ì¬ door metric?€ route ê¸°ë°˜ heuristic???¬ìš©?œë‹¤.

```text
R3/path.includes(W16) ??Cafe
R4/path.includes(W18) ??Facility
```

ê°€?¥í•˜ë©??¤ì œ door transition ?ì¸??ê¸°ë¡?˜ëŠ” ê²ƒì´ ???•í™•?˜ë‹¤.

Movement coreë¥?ë°”ê¾¸ì§€ ?ŠëŠ” ë²”ìœ„?ì„œ:

- `doorTarget === W17`?´ë©´ Cafe
- `doorTarget === W19`?´ë©´ Facility

???¤ì œ transition ì§ì „ ?íƒœë¥?snapshot?˜ì—¬ ì¸¡ì •?œë‹¤.

Routeë§?ë³´ê³  ì¶”ì •?˜ì? ?ŠëŠ”??

?? Fix4 semantics??ë³€ê²½í•˜ì§€ ?ŠëŠ”??

---

# 12. First 35 NPC Run ê²°ê³¼ ì·¨ê¸‰

?´ì „ ê²°ê³¼:

```text
R1=0
R2=0
R3=0
R4=1
R5=15
R6=0
R7=41
R8=1

deadlock_count=2
unrecovered_20sec=1
max_wait=207.333
```

?€ **Harness-invalid exploratory result**ë¡?ì·¨ê¸‰?œë‹¤.

?´ë? ê¸°ì??¼ë¡œ Movement ?˜ì •?˜ì? ?ŠëŠ”??

?´ë²ˆ correction ???¬ì‹¤??ê²°ê³¼ê°€ ì²?? íš¨ Full Flow ê²°ê³¼??

---

# 13. Browser Full Flow Mode

ê¸°ì¡´ `full35` browser mode??? ì??œë‹¤.

?´ë²ˆ task?ì„œ Browser 5ë¶??¤ì œ ì¸¡ì •?€ ?„ìˆ˜ ?„ë‹˜.

?¤ë§Œ Harness ?˜ì •?¼ë¡œ ?¸í•´ Browser modeê°€ ê¹¨ì?ì§€ ?Šë„ë¡?compile/runtime pathë¥?? ì??œë‹¤.

Browser FPS???¤ì œ ì¸¡ì •?˜ì? ?Šì•˜?¤ë©´:

```text
NOT MEASURED
```

ë¡?ë³´ê³ ?œë‹¤.

---

# 14. Test ì¶”ê?/?˜ì •

ìµœì†Œ ?¤ìŒ??ê²€ì¦í•œ??

## A. Creator spatial area self-check

?¤ì œ ì¢Œí‘œ ê¸°ì?:

```text
Park 11
CentralPlaza 10
Cafe 3
PublicFacility 3
MainRoute 5
EntryExit 3
```

ëª¨ë‘ PASS.

## B. Blocked event episodes

?¸ìœ„?ìœ¼ë¡??ëŠ” ì§§ì? deterministic scenarioë¡?

```text
unblocked ??blocked = +1
blocked ? ì? = ì¦ê? ?†ìŒ
recover ??blocked = +1
```

ê²€ì¦?

## C. Narrow queue

?¤ì œ `run.locks[].queue.length`?ì„œ metric???¤ë¥´?”ì? ê²€ì¦?

## D. Narrow pass

entryë§Œìœ¼ë¡?pass countê°€ ì¦ê??˜ì? ?Šê³ 
traversal ?„ë£Œ ??ì¦ê??˜ëŠ”ì§€ ê²€ì¦?

## E. W12 baseline

warm-up ì¢…ë£Œ ??existing owner/queueê°€
measurement ì²?frame?ì„œ false owner-change/recoveryë¡?count?˜ì? ?ŠëŠ”ì§€ ê²€ì¦?

## F. Warm-up state preservation

reset helper ?¨ë… ?ŒìŠ¤??

## G. Phase boundaries

?¤ì œ elapsedë¡??„ê²© ê²€ì¦?

## H. Raw artifact

measurement script ?¤í–‰ ???Œì¼ ?´ìš©??stdout result?€ ?™ì¼??run ê²°ê³¼?¸ì? ?•ì¸ ê°€?¥í•œ êµ¬ì¡°ë¡??œë‹¤.

---

# 15. ê¸°ì¡´ Regression ? ì?

ë°˜ë“œ??? ì?:

```text
createSmoke(map).npcs.length = 10
default duration = 120
R1~R5 Limited semantics ? ì?

candidate R6~R8 tests ? ì?

Fix4 movement tests ? ì?
```

ê¸°ì¡´ test expectation??correction??ë§ì¶˜?¤ëŠ” ?´ìœ ë¡??½í™”?œí‚¤ì§€ ?ŠëŠ”??

---

# 16. ?¤í–‰

?˜ì • ?„ë£Œ ??ë°˜ë“œ??

```powershell
npm run typecheck
npm test
npm run build
```

ê·??¤ìŒ:

```powershell
node --experimental-strip-types scripts/measure-plaza-full-flow-35.mjs
```

ë¥??¤ì œ ?¤í–‰?œë‹¤.

35 NPC run ê²°ê³¼ê°€ FAIL?´ì–´???˜ì •?˜ì? ?ŠëŠ”??

---

# 17. ìµœì¢… PASS/FAIL Gate

? íš¨ Harnessë¡??¬ì¸¡?•í•œ ê²°ê³¼?ì„œ:

## PASS

```text
npc_count = 35

actual spatial area counts ?•í™•

R1~R8 ëª¨ë‘ measurement trips > 0

collision_violation_total = 0

deadlock_count = 0
ever_20sec_block_count = 0
unrecovered_20sec = 0

Cafe enter/exit ë°˜ë³µ ë°œìƒ
Facility enter/exit ë°˜ë³µ ë°œìƒ

Narrow queueê°€ ?êµ¬ ?„ì ?˜ì? ?ŠìŒ
W12 queueê°€ ?êµ¬ ?„ì ?˜ì? ?ŠìŒ
```

## WARN

```text
3~10 sec ?Œë³µ ê°€?¥í•œ block
10~20 sec ?Œë³µ ê°€?¥í•œ block
transient queue
visual body overlap
```

## FAIL

```text
20 sec+ block episode
deadlock
collision violation
route trips = 0
door repeated transition ë¶ˆê?
queue unrecovered
```

---

# 18. 35 NPC ?¬ì‹¤?‰ì´ FAIL??ê²½ìš°

?ˆë? ?ë™?¼ë¡œ ?˜ì? ë§?ê²?

```text
Fix5
Movement tuning
Route ?˜ì •
Spawn distribution ë³€ê²?NPC 30?¼ë¡œ ê°ì†Œ
Map ?˜ì •
Collision ?„í™”
Graphics
CCTV
ë¬¸ì„œ Source-of-Truth ê°±ì‹ 
```

ê·¸ë?ë¡?ê²°ê³¼ ë³´ê³  ??ë©ˆì¶˜??

---

# 19. ë³€ê²??ˆìš© ë²”ìœ„

ê°€?¥í•œ ë³€ê²??Œì¼:

```text
src/plazaFullFlow.ts
tests/fullFlowHarness.test.ts
scripts/measure-plaza-full-flow-35.mjs
```

?„ìš”??ê²½ìš°?ë§Œ:

```text
src/PlazaParkScene.ts
```

`src/plazaTraffic.ts`??Fix4 Movementë¥?ê±´ë“œë¦¬ì? ?ŠëŠ” ë²”ìœ„??type/import compatibility ?˜ì •ë§??ˆìš©?œë‹¤.

ê°€?¥í•˜ë©??˜ì •?˜ì? ?ŠëŠ”??

---

# 20. ìµœì¢… ë³´ê³  ?•ì‹

## 1. ë³€ê²??Œì¼

## 2. Harness correctness ?˜ì • ?”ì•½

?¤ìŒ ê°ê°??ëª…ì‹œ:

```text
actual area spawn
blocked_events
narrow queue
narrow pass
W12 baseline
door metrics
raw output overwrite
warm-up reset test
phase boundary test
```

## 3. ê¸°ì¡´ Regression

```text
createSmoke NPC count
default duration
existing tests
```

## 4. Creator Self-check

ë°˜ë“œ??**actual spatial** area count ?¬í•¨:

```text
NPC
Route
Species
Size
Area
Collision
```

## 5. Tests

ê¸°ì¡´/? ê·œ ë¶„ë¦¬.

## 6. typecheck

## 7. build

## 8. Corrected 35 NPC Run

?„ì²´ ?µì‹¬ JSON:

```text
R1~R8 trips
R1~R8 arrivals
R1~R8 max_wait
R1~R8 blocked_events

blocked_time_total
blocked_npc_count_peak
max_continuous_blocked_time

severe_block_count
deadlock_count
ever_20sec_block_count
unrecovered_20sec
recoveries

collision violations

Cafe enter/exit
Facility enter/exit

Upper Narrow pass/max queue
Lower Narrow pass/max queue

W12 max queue
W12 owner changes
W12 queue recoveries
```

## 9. ?´ì „ runê³?ë¹„êµ

?´ì „ Harness-invalid run???«ìë¥???ê²°ê³¼?€ ?¨ìˆœ ?±ëŠ¥ ë¹„êµ?˜ì? ?ŠëŠ”??

?€??

```text
old run = invalid due to harness correctness issues
new run = first valid 35 NPC Full Flow measurement
```

?¼ê³  ëª…ì‹œ?œë‹¤.

## 10. Browser

```text
full35 mode compile/runtime ? ì? ?¬ë?
5min FPS ?¤ì œ ì¸¡ì • ?¬ë?
```

ë¯¸ì¸¡?•ì´ë©?`NOT MEASURED`.

## 11. ìµœì¢… Logic ?ì •

```text
PASS
PASS with WARN
FAIL
```

?«ìë¡?ê·¼ê±° ?œì‹œ.

## 12. ì¤‘ë‹¨

ë³´ê³  ??ë©ˆì¶˜??
?¤ìŒ ?¨ê³„ë¡??ë™ ì§„í–‰?˜ì? ?ŠëŠ”??
