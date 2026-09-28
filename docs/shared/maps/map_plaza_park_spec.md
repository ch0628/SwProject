# SWfestival Plaza & Park Map Specification — Current

## 1. 문서 목적

이 문서는 지도학습 구역 중 **광장·공원(Plaza & Park)** 맵의 현재 제작 기준이다.

Map Geometry, Waypoint, Door Opening, Path Width는 기존 승인값을 유지한다. Current prototype observation geometry는 TMJ의 `PLAZA_CAM_A~E`를 따른다.

Traffic v1의 Large Clearance, Fix4 및 30/35 NPC 결과는 역사 조건으로 보존한다.
현재 기준은 `public/maps/plaza-park-v2.tmj`와 Navigation v2이며,
Map, N01~N28, E01~E33, SP1~SP10은 frozen이다.

old CCTV1/CCTV2 `MANUAL_LABELING` 구현은 2-camera historical technical baseline이다. current `PLAZA_CAM_A~E`
5-camera loader와 Round 1 35-NPC persistent Scenario runtime은 구현·검증되었다. 다음 단계는
`FIRST_TRAINING` verification interaction과 Round 2 전이이며, 이 문서의 맵 구조를 임의로 다시 변경하지 않는다.

---

## 2. 공통 고정 조건

```text
Map = 96×56 tiles
Tile = 32×32 px
World = 3072×1792 px

Tiger Large Visual Height = 80px
General NPC Visual Max = 96px
Tiger Physical Footprint = 26×16px
Character Anchor = Bottom Center
Depth = feet Y
```

좌표 범위는 양 끝 Tile을 포함한다.

---

## 3. 좌표 / 충돌 의미

```text
Zone
= 논리 영역
= 자동 Collision 아님

Building Visual Footprint
= 화면상 건물 외형

Building Collision
= 비통과 영역

Door Opening
= 벽에서 실제로 비워둔 통과 폭
= 공공 출입구 최소 2 tiles

Door Trigger / Threshold
= Enter / Exit Behavior 실행 영역
```

Cafe와 Public Facility는 Interior Map을 구현하지 않는다.

```text
NPC
→ Door Trigger 도달
→ Enter 처리
→ 화면/맵에서 일시 제거
→ 일정 시간 뒤 같은 Door 주변에서 Exit
```

NPC가 실제 Interior Test Point까지 계속 걸어 들어가야 하는 구조가 아니다.

---

## 4. Large Clearance 적용 규칙

기존 Large Architecture Clearance:

```text
left/right = 30px
up = 56px
down = 8px
```

### 4.1 Building Wall

일반 Building Wall에는 기존 Large Architecture Clearance를 유지한다.

목적:
- 큰 Species의 상체가 벽 안으로 과도하게 들어가는 현상 방지
- Physical Footprint만으로 놓치는 시각 관통 방지

### 4.2 Door Approach

Door Front Approach까지는 일반 이동과 동일한 Large Clearance를 사용할 수 있다.

### 4.3 Door Trigger / Threshold

Door Trigger 내부에서는 Enter를 다음 기준으로 판단한다.

```text
Physical Footprint가 Door Opening을 안전하게 통과 가능
→ Enter 허용

Building Wall용 Large Architecture Clearance
→ Door Trigger 내부 Enter 차단 조건으로 사용하지 않음
```

따라서:

- Cafe/PF 2-tile / 64px Door Opening 유지
- Door를 3 tiles로 확대하지 않음
- W17 / W19 좌표 유지
- Interior Navigation 추가하지 않음

### 4.4 Fence

Fence는 낮은 경계 Prop이다.

```text
Fence
→ Physical Collision 적용
→ Building Wall용 Large Architecture Clearance 미적용
→ 시각적 앞/뒤 관계는 Y-sort / Depth로 처리
```

W04 / W07은 Fence Large Clearance 때문에 이동하지 않는다.

### 4.5 Bench / Tree / Lamp / NPC

Building Wall용 Large Clearance를 강제하지 않는다.

```text
Bench / Tree / Lamp / NPC
→ approved physical footprint / ground contact 기준
```

상체 겹침은 Graphics / Personal Spacing에서 별도 검증한다.

---

## 5. Park

```text
Park Area
X = 0~95
Y = 0~21
```

### Main Walkway

```text
X = 18~77
Y = 10~12
Width = 3 tiles
```

### Upper Narrow

```text
X = 26~69
Y = 5~6
Width = 2 tiles
```

### Lower Narrow

```text
X = 26~69
Y = 16~17
Width = 2 tiles
```

### Connectors

```text
Left Upper  X25~26 Y6~10
Right Upper X69~70 Y6~10
Left Lower  X25~26 Y12~16
Right Lower X69~70 Y12~16

North Entry Connector
X46~49 Y0~10

Park South Connector
X46~49 Y17~24
```

2-tile Narrow Path는 일반 양방향 Main Route로 사용하지 않는다.

---

## 6. Park Objects

### Tree

```text
T1=(10,4)
T2=(83,4)
T3=(12,18)
T4=(93,18)
T5=(36,8)
T6=(59,15)
```

### Bush

```text
B1=(16,6)
B2=(33,8)
B3=(62,8)
B4=(79,6)
B5=(38,15)
B6=(57,15)
B7=(19,17)
B8=(76,17)
```

### Lamp

```text
L1=(12,8)
L2=(53,8)
L3=(74,8)
L4=(15,15)
L5=(50,15)
L6=(74,15)
```

### Bench

```text
Bench A = X8~10, Y10
Bench B = X86~88, Y19
Bench C = X38~40, Y19
```

### Fence

```text
상단 좌 X6~12 Y9
상단 우 X71~76 Y9
하단 좌 X6~12 Y13
하단 우 X71~76 Y13
```

Fence Collision은 physical-only.

### Flower

```text
Collision 없음
Gameplay Interaction 없음
Ground_Detail
통과 가능
```

### Manhole

```text
X72~73
Y17~18
```

---

## 7. Park → Plaza Transition

```text
X = 18~77
Y = 22~23
```

---

## 8. Central Plaza

```text
Central Plaza
X = 20~75
Y = 24~39

Open Core
X = 31~64
Y = 28~35
```

Plaza Bench:

```text
PB1 X24~26 Y26
PB2 X69~71 Y26
PB3 X24~26 Y37
PB4 X69~71 Y37
```

Plaza Lamp:

```text
PL1=(28,25)
PL2=(67,25)
PL3=(28,38)
PL4=(67,38)
```

---

## 9. Cafe Zone

```text
Cafe Zone
X = 6~23
Y = 35~46

Cafe Building
X = 7~19
Y = 37~44

Door Opening
X = 19
Y = 40~41

Door Trigger
X = 19~20
Y = 40~41

Front Approach
X = 20~22
Y = 40~41
```

Enter:

```text
Approach
→ Door Trigger
→ Physical Footprint 통과 가능 확인
→ Enter Transition
→ 내부 Navigation 없음
→ 일정 시간 후 Door 주변 Exit
```

---

## 10. Public Facility Zone

```text
Facility Zone
X = 74~92
Y = 7~21

Facility Building
X = 79~91
Y = 8~16

Door Opening
X = 84~85
Y = 16

Door Trigger
X = 84~85
Y = 16~17

Front Approach
X = 84~85
Y = 17~18

Forecourt
X = 79~91
Y = 17~21
```

Enter 규칙은 Cafe와 동일하다.

---

## 11. Main Route / Entry / Exit

```text
Main Route
X = 0~95
Y = 50~55
Width = 6 tiles

West Exit
X = 0~1
Y = 52~53

East Exit
X = 94~95
Y = 52~53

North Entry
X = 46~49
Y = 0~1
```

---

## 12. Path Width 정책

Corridor 결과:

```text
2 tiles Large  = FAIL
3 tiles Large  = PASS
3 tiles Mixed  = Flow PASS / Visual WARN
4 tiles Mixed  = Flow PASS / Visual WARN
```

정책:

```text
2 tiles = Narrow / Special
3 tiles = Standard Public Walkway
4 tiles = Optional High-traffic
5~6 tiles = Main Route / wide approach
```

---

## 13. Historical Traffic v1 Policy — Fix4

이 절의 W01~W22 및 Fix4 정책은 Traffic v1의 역사 조건이다.
현재 Navigation v2 runtime의 Source of Truth로 사용하지 않는다.

Map Geometry를 변경하지 않고 다음 최소 Traffic Policy를 사용한다.

### 3+ tile 통로

```text
Route Segment 기준 side-step
→ 한쪽이 막히면 반대쪽도 deterministic 검사
→ Yield 중 양쪽이 막히면 bounded backoff
→ 모든 실제 이동은 Physical Collision 검사 유지
```

새 전역 Pathfinding은 만들지 않는다.

### 2-tile Narrow Path

```text
반대 방향 동시 진입 제한
→ 선진입 방향 우선
→ 반대쪽 대기
→ 통과 후 다음 Queue
```

Directional reservation은 해당 Narrow Path의 긴 축을 따라 이동하는 Traffic에만 적용한다.

Narrow 영역을 단순히 가로지르는 Connector Traffic은 Directional Lock 대상이 아니다.

### Merge / Shared Edge / W12

```text
arrival order 우선
동시 도착 → deterministic stable id tie-break
W12 owner priority > local Yield
```

W12 owner가 queue waiter에게 Yield하여 priority inversion을 만들지 않는다.

본격 Personal Spacing은 아직 하지 않는다.

---

## 14. Current Prototype Observation Geometry

Source of Truth: `public/maps/plaza-park-v2.tmj`의 `Camera_Zone` Object Layer. 아래 값은 2026-09-14에 TMJ를 직접 읽어 확인한 Pixel 좌표다.

| name | type | x | y | width | height |
|---|---|---:|---:|---:|---:|
| `PLAZA_CAM_A` | `Coverage` | 322 | 91 | 800 | 600 |
| `PLAZA_CAM_B` | `Coverage` | 1370 | 842 | 800 | 600 |
| `PLAZA_CAM_C` | `Coverage` | 449 | 1118 | 800 | 600 |
| `PLAZA_CAM_D` | `Coverage` | 2261 | 375 | 800 | 600 |
| `PLAZA_CAM_E` | `Coverage` | 1200 | 170 | 800 | 600 |

이 ID들은 Plaza/Park playable prototype의 local observation-zone namespace다. 향후 full-game target의 global `CCTV1/CCTV2 = Plaza/Park`와 같은 namespace나 1:1 camera 의미로 설명하지 않는다.

기존 CCTV1/CCTV2/Overlap geometry와 runtime 결과는 `docs/validation/plaza_park_v2/plaza_park_cctv_manual_labeling_validation.md`의 **HISTORICAL VALIDATION — 2-camera manual-labeling baseline**으로 보존한다. 이를 current 5-camera geometry로 덮어쓰지 않는다.

---

## 15. Waypoint Skeleton

### Park

```text
W01 NORTH_ENTRY        = (47, 2)
W02 PARK_NW            = (26, 5)
W03 PARK_MAIN_WEST     = (30, 11)
W04 PARK_BENCH_A       = (11, 10)
W05 PARK_CENTER        = (48, 11)
W06 PARK_BENCH_B       = (85, 19)
W07 PARK_MAIN_EAST     = (72, 11)
W08 UPPER_NARROW_MID   = (48, 5)
W09 LOWER_NARROW_MID   = (48, 16)
W10 PARK_BENCH_C       = (41, 19)
W11 MANHOLE            = (71, 18)
W12 PARK_SOUTH_GATE    = (48, 22)
```

### Plaza / Building / Road

```text
W13 PLAZA_WEST         = (24, 31)
W14 PLAZA_CENTER       = (48, 31)
W15 PLAZA_EAST         = (71, 31)
W16 CAFE_FRONT         = (22, 40)
W17 CAFE_DOOR          = (20, 40)
W18 FACILITY_FRONT     = (84, 18)
W19 FACILITY_DOOR      = (84, 16)
W20 MAIN_ROAD_CENTER   = (48, 52)
W21 WEST_EXIT          = (1, 52)
W22 EAST_EXIT          = (94, 52)
```

**과거 Limited FAIL 및 이후 Fix 과정에서도 Waypoint를 이동하거나 추가하지 않았다.**

Historical Traffic v1 Route Set:

```text
R1 = W01 → W05 → W12 → W14 → W20 → W21
R2 = W01 → W05 → W08 → W05 → W12 → W14 → W20 → W22
R3 = W05 → W12 → W13 → W16 → W20
R4 = W05 → W12 → W18 → W12 → W14
R5 = W09 → W11 → W12 → W14

R6 = 미정의
R7 = 미정의
R8 = 미정의
```

R6~R8은 과거 승인 Route가 아니며,
35 NPC 공간 분산을 위해 새로 설계한 Route다.

```text
R6 = W03 → W05 → W07
R7 = W13 → W14 → W15
R8 = W21 → W20 → W22
```

검증:

```text
Fixed Collision Segment Validation = PASS
Single Small / Medium / Large = PASS
Bidirectional Large + Large = PASS
collisionViolation = 0
unrecovered_20sec = 0
```

따라서 R6~R8을 Full Flow Route Set에 정식 승인한다.

---

## 16. Current Gameplay Population

```text
Round 1 = 35 NPC / 28 Citizen / 7 Villain
Round 2 = 35 NPC / 28 Citizen / 7 Villain
homeObservationZone = PLAZA_CAM_A~E에 Round별 7명씩 배정 예정
```

`homeObservationZone`은 소속이며 현재 보이는 camera가 아니다. NPC가 이동해 A에서 빠지거나 B에 들어와도 소속은 바뀌지 않고, zone별 visible count를 맞추기 위한 자동 spawn/exit balancing을 하지 않는다.

Gameplay lifecycle은 `STATIC_HOLD`, `ENTER_AND_STAY`, `ENTER_HOLD_EXIT`, `THROUGH_TRAFFIC`을 사용한다. Exit형 NPC는 OFFSCREEN 이후 동일 identity로 재진입할 수 있어 Round population이 유지된다. itinerary 완료 후 영구 `EXITED`되는 finite concurrency harness는 validation 전용이다.

---

## 17. Collision / Interaction 정책 요약

```text
Building Wall
→ Physical + Large Architecture Clearance

Door Trigger
→ Physical Footprint 통과 + Enter Transition

Fence
→ Physical Collision only

Bench / Tree / Lamp
→ approved footprint / ground-contact 기준

Flower / Manhole
→ non-blocking
```

---

## 18. Layer

Visible:

```text
Ground
Ground_Detail
Object_Base
Characters
Foreground
Roof
Effects
```

Logic:

```text
Collision
Navigation
Spawn
Interaction
Camera_Zone
```

Graphics Integration의 역사적 기준은
`docs/reference/plaza_park_environment_graphics_integration_spec.md`를 참고한다.

---

## 19. Historical Traffic v1 Limited Validation 결과

### 19.1 초기 실패 — 역사 기록

```text
Physical Waypoint Occupancy = 22/22

기존 Large 정책 Occupancy = 17/22
불충족 = W04, W07, W17, W18, W19

초기 10 NPC Mixed:
completed routes = 0
max block = 294.7667 sec
collision violation = 0
```

이 실패를 근거로 Map 좌표나 Door 폭을 바꾸지 않고:

```text
Door Trigger semantics
Fence clearance semantics
Minimal passing / yield
```

를 수정했다.

### 19.2 현재 Limited Fix4 결과

```text
10 NPC / 120 sec

completed_routes = 11
R1 = 2
R2 = 2
R3 = 3
R4 = 1
R5 = 3

collisionViolation = 0
unrecovered_20sec = 0
max_continuous_blocked_time = 14.8167 sec
```

판정:

```text
PASS with WARN
```

따라서 현재 Map Geometry는 유지한다.

---

## 20. Traffic v1 역사 결과와 Navigation v2 현재 상태

다음은 Traffic v1 당시 결과다.

```text
Limited NPC Flow Fix4 = PASS with WARN
R6 / R7 / R8 Dynamic Validation = PASS
Full Flow Harness correctness = PASS

35 NPC Corrected Full Flow = FAIL
30 NPC Deterministic Fallback = FAIL

Historical Traffic v1 Operating Density = 10 active movers
```

30 / 35 NPC 모두 Physical Collision violation은 0이었지만,
장기 Blocking과 W12 미회복으로 Full Flow Hard Gate를 통과하지 못했다.

따라서 Traffic v1 tuning은 종료했다.

Map Source of Truth는 유지한다.

```text
Map 좌표 유지
W01~W22 유지
Door Opening 유지
Path Width 유지
Collision 유지
```

현재 Navigation v2 결과:

```text
Map v2 / N01~N28 / E01~E33 / SP1~SP10 = FROZEN
5 NPC  = PASS
8 NPC  = PASS
10 NPC = PASS
12 NPC = PASS
15 NPC = PASS
```

최종 validation에서 unrecovered stall, watchdog report, fixed collision,
NPC overlap, road hold violation은 모두 0이다.

Traffic v1의 `active movers ≤ 10`은 현재 v2 운영 제한이 아니다.
다만 15 NPC 역시 검증된 reference일 뿐 최종 gameplay active count가 아니다.
최종 동시 active 수는 CCTV gameplay와 UX 단계에서 별도 결정한다.

old CCTV1/CCTV2 manual-labeling runtime은 historical technical baseline으로 보존한다.
현재 `PLAZA_CAM_A~E` 기반 Round 1 Scenario Assignment/persistent lifecycle은 구현·검증 완료됐고,
next step은 `FIRST_TRAINING` verification interaction이다.
