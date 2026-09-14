# Supervised Learning Character Pool — Source of Truth

Updated: 2026-09-14  
Status: **35 IDENTITY POOL IMPLEMENTED / ROUND SCENARIO DESIGN APPROVED**

## 1. 목적

이 문서는 지도학습 프로토타입에서 사용할 **35 Character Pool**의 의미와 역할을 정의한다.

핵심 원칙:

```text
35 Character Pool
≠
35 Simultaneous Active NPC
```

35는 전체 visual/identity pool이며 Citizen/Villain 역할을 고정하지 않는다.
현재 playable prototype의 각 Round는 이 35 identity를 모두 배정하지만, 특정 observation zone의 visible count는 이동과 OFFSCREEN lifecycle에 따라 변한다.
현재 deterministic concurrency validation은 15 active NPC까지 PASS했지만,
이는 최종 gameplay active count 확정이 아니다.

Final Scan의 수십~수백 명 표현은 이 35 NPC를 그대로 대량 복제하여 고비용 simulation 하는 방식이 아니라,
저비용 Crowd / 반복 Asset / Scan Effect / Lock-on 연출로 처리한다.

---

## 2. Legacy fixed-label design

다음 Phase/label 분배는 이전 full-scope 설계의 historical reference이며 current gameplay truth가 아니다.

```text
MANUAL_LABELING         = 18
HUMAN_AI_COMPARE        = 8
AI_ASSISTED_MONITORING  = 9
TOTAL                   = 35
```

Legacy 고정 정답 분배:

```text
CITIZEN = 23
VILLAIN = 12
```

Species:

```text
Rabbit = 7
Cat    = 7
Dog    = 7
Fox    = 7
Tiger  = 7
```

이전 `23 Citizen / 12 Villain`을 현재 Round의 population 또는 실제 정답 분배로 사용하지 않는다.

## 2.1 Current RoundScenario truth

```text
ROUND 1 = 35 NPC / 28 CITIZEN / 7 VILLAIN
ROUND 2 = 35 NPC / 28 CITIZEN / 7 VILLAIN
```

실제 역할은 `RoundCharacterAssignment.actualLabel`이 결정한다. 동일 Character도 Round 1과 Round 2에서 다른 역할을 가질 수 있다. 각 species가 정답 힌트가 되어서는 안 된다는 원칙은 유지한다.

각 Round는 `PLAZA_CAM_A~E`에 `homeObservationZone` 7명씩을 배정할 예정이다. 이는 소속 수이며 visible count를 7로 자동 유지한다는 뜻이 아니다.

---

## 3. Runtime 구현 원칙

캐릭터별로 전용 행동 애니메이션을 만들지 않는다.

공용 Behavior Primitive:

```text
WALK
RUN
IDLE / REST
INTERACT
TALK
SUSPICIOUS_ACTION
ENTER / EXIT
```

Semantic behavior 예:

```text
STEALING
VANDALIZING
REPAIRING
DELIVERING
THREATENING
MANHOLE_TAMPER
```

는 Gameplay / history 데이터에 별도로 기록하되,
프로토타입 시각 표현은 공용 primitive + 작은 effect / icon / stop duration을 재사용할 수 있다.

---

## 4. Navigation 데이터 원칙

Character 데이터에 35개의 고정 Node sequence를 직접 하드코딩하지 않는다.

예:

```text
금지:
N01 → N04 → N09 → N12 → ...

권장:
spawnArea = NORTH_WEST
intent = PARK_WALK
nextIntent = CAFE_VISIT
exitArea = SOUTH_WEST
```

Navigation layer가 현재 Node에서 semantic destination까지 Graph path를 계산한다.

Plaza/Park의 확정된 특수 Node:

```text
N17 = CAFE_DOOR
N28 = FACILITY_DOOR

N24 = SOUTH_WEST_EXIT
N25 = SOUTH_CENTER_EXIT
N26 = SOUTH_EAST_EXIT
```

Shopping / Residential Map runtime이 아직 없을 경우 해당 Zone 구간은 offscreen semantic state로 유지할 수 있다.

---

## 5. AI Confidence

정확한 수치 threshold는 아직 확정하지 않는다.

Dataset에서는 우선:

```text
HIGH
MEDIUM
LOW
```

bucket만 사용한다.

실제 confidence 숫자는 UI / gameplay test 이후 결정한다.

---

## 6. 35 Character Identity Dataset + Legacy Scenario Metadata

아래 35개 `id/species/gender`가 current `CharacterDefinition` identity truth다. 기존 `verifiedLabel`, Phase, story, AI 계획 열은 legacy fixed-label scenario metadata로만 보존하며 current Round truth로 로드하지 않는다.

| id    | species   | gender   | legacyFixedLabel   | legacyPrimaryPhase           | legacyDifficulty   | legacyZoneSequence        | legacyBehaviorStory                                  | legacyPlazaIntent               | legacyTrackingReview   | legacyPlannedAI                                                         |
|:------|:----------|:---------|:----------------|:-----------------------|:-------------|:--------------------|:-----------------------------------------------|:--------------------------|:-----------------|:------------------------------------------------------------------|
| NPC01 | Rabbit    | F        | CITIZEN         | MANUAL_LABELING        | EASY         | PLAZA               | 산책 → 벤치 휴식 → 이동                        | PARK_WALK / BENCH_REST    | NO               | —                                                                 |
| NPC02 | Cat       | M        | CITIZEN         | MANUAL_LABELING        | EASY         | PLAZA → RESIDENTIAL | Facility 방문 → 정상 귀가                      | FACILITY_VISIT            | NO               | —                                                                 |
| NPC03 | Dog       | F        | VILLAIN         | MANUAL_LABELING        | EASY         | PLAZA               | 시설물 훼손 → 도주                             | VANDALIZE / ESCAPE        | NO               | —                                                                 |
| NPC04 | Fox       | M        | CITIZEN         | MANUAL_LABELING        | EASY         | PLAZA → SHOPPING    | Cafe 방문 → 휴식 → 이동                        | CAFE_VISIT                | NO               | —                                                                 |
| NPC05 | Tiger     | F        | VILLAIN         | MANUAL_LABELING        | EASY         | PLAZA → RESIDENTIAL | 다른 캐릭터 위협 → 빠르게 이탈                 | THREATEN / ESCAPE         | NO               | —                                                                 |
| NPC06 | Rabbit    | M        | CITIZEN         | MANUAL_LABELING        | EASY         | PLAZA → SHOPPING    | 조깅 → Plaza 통과                              | JOG / PLAZA_TRANSIT       | NO               | —                                                                 |
| NPC07 | Cat       | F        | CITIZEN         | MANUAL_LABELING        | EASY         | PLAZA               | 친구와 대화 → 산책                             | TALK / PARK_WALK          | NO               | —                                                                 |
| NPC08 | Dog       | M        | VILLAIN         | MANUAL_LABELING        | EASY         | PLAZA → SHOPPING    | 물건 탈취 → 도주                               | SNATCH / ESCAPE           | NO               | —                                                                 |
| NPC09 | Fox       | F        | CITIZEN         | MANUAL_LABELING        | EASY         | PLAZA → SHOPPING    | Cafe 관련 정상 업무 → 이동                     | CAFE_SERVICE / TRANSIT    | NO               | —                                                                 |
| NPC10 | Tiger     | M        | CITIZEN         | MANUAL_LABELING        | MEDIUM       | PLAZA               | 장비 소지 → 시설 점검/수리                     | FACILITY_REPAIR           | OPTIONAL         | —                                                                 |
| NPC11 | Rabbit    | F        | VILLAIN         | MANUAL_LABELING        | EASY         | PLAZA               | Manhole 주변 시설 훼손 → 이탈                  | MANHOLE_TAMPER / ESCAPE   | NO               | —                                                                 |
| NPC12 | Cat       | M        | CITIZEN         | MANUAL_LABELING        | EASY         | PLAZA → RESIDENTIAL | Facility 용무 → 귀가                           | FACILITY_VISIT            | NO               | —                                                                 |
| NPC13 | Dog       | F        | CITIZEN         | MANUAL_LABELING        | EASY         | PLAZA → SHOPPING    | 공원 산책 → Plaza 이동                         | PARK_WALK / PLAZA_TRANSIT | NO               | —                                                                 |
| NPC14 | Fox       | M        | VILLAIN         | MANUAL_LABELING        | EASY         | PLAZA → SHOPPING    | 물건 절취 → 빠르게 이동                        | THEFT / ESCAPE            | NO               | —                                                                 |
| NPC15 | Tiger     | F        | CITIZEN         | MANUAL_LABELING        | EASY         | PLAZA               | 운동 → 빠른 걷기 → 이동                        | EXERCISE / WALK           | NO               | —                                                                 |
| NPC16 | Rabbit    | M        | CITIZEN         | MANUAL_LABELING        | MEDIUM       | PLAZA               | 급하게 달림 → 정상적인 Facility 용무           | RUN / FACILITY_VISIT      | YES              | —                                                                 |
| NPC17 | Cat       | F        | VILLAIN         | MANUAL_LABELING        | MEDIUM       | PLAZA               | 평범한 체류 → 시설물 훼손 → 이탈               | IDLE / VANDALIZE / ESCAPE | YES              | —                                                                 |
| NPC18 | Dog       | M        | CITIZEN         | MANUAL_LABELING        | MEDIUM       | PLAZA               | 도구 운반 → 정상 수리 작업                     | CARRY_TOOLS / REPAIR      | YES              | —                                                                 |
| NPC19 | Fox       | F        | CITIZEN         | HUMAN_AI_COMPARE       | AMBIGUOUS    | RESIDENTIAL → PLAZA | 약속에 늦어 빠르게 달림                        | RUN / PLAZA_TRANSIT       | YES              | AI=CITIZEN, correct; 사용자는 악당으로 오인 가능                  |
| NPC20 | Tiger     | M        | VILLAIN         | HUMAN_AI_COMPARE       | AMBIGUOUS    | SHOPPING → PLAZA    | 이전 Shopping 절도 → Plaza에서는 평범하게 걷기 | PLAZA_TRANSIT             | YES              | AI=VILLAIN, correct; 사용자는 시민으로 오인 가능                  |
| NPC21 | Rabbit    | F        | CITIZEN         | HUMAN_AI_COMPARE       | AMBIGUOUS    | PLAZA               | 금속 장비 소지 → Facility 수리                 | FACILITY_REPAIR           | YES              | AI=CITIZEN, correct; 사용자는 악당으로 오인 가능                  |
| NPC22 | Cat       | M        | VILLAIN         | HUMAN_AI_COMPARE       | AMBIGUOUS    | PLAZA               | 이전 시설물 파손 → 현재는 벤치 휴식            | BENCH_REST                | YES              | AI=CITIZEN, wrong; 사용자는 기록으로 정정                         |
| NPC23 | Dog       | F        | CITIZEN         | HUMAN_AI_COMPARE       | AMBIGUOUS    | PLAZA               | 주변을 반복해서 둘러봄 → 친구 대기             | WAIT / LOOK_AROUND        | YES              | AI=VILLAIN, wrong; 사용자는 시민 판단 가능                        |
| NPC24 | Fox       | M        | CITIZEN         | HUMAN_AI_COMPARE       | AMBIGUOUS    | SHOPPING → PLAZA    | 상자를 들고 빠르게 배달                        | DELIVERY / RUN            | YES              | AI=VILLAIN, wrong; 사용자도 악당으로 오인 가능(둘 다 틀리는 사례) |
| NPC25 | Tiger     | F        | VILLAIN         | HUMAN_AI_COMPARE       | AMBIGUOUS    | SHOPPING → PLAZA    | 이전 구역에서 위협 → Cafe에서는 평범하게 행동  | CAFE_VISIT                | YES              | AI=VILLAIN, correct; 사용자는 시민으로 오인 가능                  |
| NPC26 | Rabbit    | M        | CITIZEN         | HUMAN_AI_COMPARE       | AMBIGUOUS    | PLAZA               | 큰 상자 운반 → Facility 정상 배송              | DELIVERY / FACILITY_VISIT | YES              | AI=CITIZEN, correct; 사용자는 악당으로 오인 가능                  |
| NPC27 | Cat       | F        | CITIZEN         | AI_ASSISTED_MONITORING | NORMAL       | RESIDENTIAL → PLAZA | 일상 통근 → 산책                               | COMMUTE / WALK            | NO               | AI=CITIZEN, HIGH, correct                                         |
| NPC28 | Dog       | M        | VILLAIN         | AI_ASSISTED_MONITORING | NORMAL       | PLAZA               | Manhole 접근 → 비정상 조작                     | MANHOLE_TAMPER            | OPTIONAL         | AI=VILLAIN, HIGH, correct                                         |
| NPC29 | Fox       | F        | CITIZEN         | AI_ASSISTED_MONITORING | NORMAL       | PLAZA → SHOPPING    | Cafe 픽업 → 업무 이동                          | CAFE_VISIT / COMMUTE      | NO               | AI=CITIZEN, HIGH, correct                                         |
| NPC30 | Tiger     | M        | CITIZEN         | AI_ASSISTED_MONITORING | NORMAL       | PLAZA               | 공원 운동 → Plaza 이동                         | EXERCISE / PLAZA_TRANSIT  | NO               | AI=CITIZEN, HIGH, correct                                         |
| NPC31 | Rabbit    | F        | VILLAIN         | AI_ASSISTED_MONITORING | AMBIGUOUS    | SHOPPING → PLAZA    | 이전 Shopping 절도 → 군중에 섞여 평범하게 이동 | PLAZA_TRANSIT             | YES              | AI=CITIZEN, LOW, wrong; 우선 검수 대상                            |
| NPC32 | Cat       | M        | CITIZEN         | AI_ASSISTED_MONITORING | NORMAL       | PLAZA               | Facility 정상 방문                             | FACILITY_VISIT            | NO               | AI=CITIZEN, HIGH, correct                                         |
| NPC33 | Dog       | F        | CITIZEN         | AI_ASSISTED_MONITORING | NORMAL       | PLAZA → RESIDENTIAL | 귀가 이동                                      | COMMUTE / EXIT            | NO               | AI=CITIZEN, MEDIUM, correct                                       |
| NPC34 | Fox       | M        | VILLAIN         | AI_ASSISTED_MONITORING | AMBIGUOUS    | SHOPPING → PLAZA    | 이전 절도 후 Plaza 통과                        | PLAZA_TRANSIT             | YES              | AI=VILLAIN, MEDIUM, correct; 기록 확인 가치 있음                  |
| NPC35 | Tiger     | F        | CITIZEN         | AI_ASSISTED_MONITORING | AMBIGUOUS    | PLAZA               | 도시 시설 점검/수리                            | FACILITY_REPAIR           | OPTIONAL         | AI=CITIZEN, MEDIUM, correct                                       |

---

## 7. Legacy Phase별 사용 원칙

이 절은 위 legacy metadata의 의도 설명이며 current prototype gate가 아니다.

### MANUAL_LABELING

18명은 legacy 초기 검증 데이터 후보 pool이다.

목표:

```text
사용자가 모든 18명을 반드시 처리
```

가 아니라,

```text
이 legacy pool에서 full-scope tuning용 15~20개의 검증 데이터를 확보
```

하는 것이다.

초반은 EASY 중심으로 시작하고,
NPC16 / NPC17 / NPC18처럼 일부 MEDIUM 사례를 뒤쪽에 배치한다.

### HUMAN_AI_COMPARE

8명은 사용자와 AI가 같은 대상을 각각 판단하는 구간의 핵심 사례다.

반드시 포함할 경험:

```text
AI가 맞고 사용자가 틀림
사용자가 맞고 AI가 틀림
사용자와 AI가 모두 틀림
현재 화면만으로 판단하기 어려움
Tracking Review로 실제 정답 확인
```

특히 NPC24는:

```text
사용자 = 악당
AI = 악당
Verified = 시민
```

처럼 "둘이 같은 판단을 했다고 정답은 아니다"를 보여주는 사례로 사용한다.

### AI_ASSISTED_MONITORING

9명은 AI가 대부분 자동 판별하는 경험을 보여준다.

대부분은 AI가 자동 처리한다.

사용자는:

```text
LOW confidence
애매한 history
오판 가능성이 높은 대상
```

위주로 검수한다.

NPC31은 AI 오판 + LOW confidence의 대표 검수 사례다.

---

## 8. Current Character truth 구조

정적 identity와 Round별 truth/runtime을 분리한다.

```text
CharacterDefinition
- id
- species
- gender
- visualIdentity

RoundCharacterAssignment
- roundId
- characterId
- actualLabel
- homeObservationZone
- lifecycle
- behaviorPlan
- target
- entryExitPolicy

RoundRuntime
- currentPosition
- currentObservationZone
- currentBehavior
- behaviorHistory
- userLabel
- aiLabel
- verifiedLabel
- aiConfidence
- usedForTraining
```

`actualLabel`은 해당 Round의 숨겨진 실제 정답이다. `verifiedLabel`은 검증 전 `null`이고, 추적/검증 후에는 current Round의 `actualLabel`과 일치한다.

`homeObservationZone`은 Round 안에서 고정된다. A 소속 NPC가 B에 보여도 A로 유지하며, 현재 보이는 zone과 소속을 분리한다. 자동 population balancing은 없다.

Runtime 값:

```text
currentPosition
currentObservationZone
currentBehavior
behaviorHistory
userLabel
aiLabel
usedForTraining
```

은 플레이 중 변화한다.

`behaviorHistory`, label, training 상태는 Round별로 분리한다.

Gameplay lifecycle:

```text
STATIC_HOLD
ENTER_AND_STAY
ENTER_HOLD_EXIT
THROUGH_TRAFFIC
```

Exit형 NPC는 `EXIT → OFFSCREEN → same identity re-entry`가 가능하며 Round population은 유지한다.

---

## 9. 구현 상태와 다음 단계

이 Dataset을 기준으로 다음 runtime foundation을 구현했다.

```text
Character Pool data                               ✅
Semantic behavior / intent type                   ✅
Navigation v2 runtime graph loader                ✅
Semantic destination → Dijkstra graph path        ✅
Spawn / Exit                                      ✅
공용 behavior primitive                           ✅
behaviorHistory 기록                              ✅
Progress watchdog                                 ✅ 2s / 1px
Deterministic concurrency                         ✅ 5/8/10/12/15 PASS
```

old CCTV1/CCTV2 `MANUAL_LABELING` vertical slice는 historical technical baseline으로 보존한다. current
`PLAZA_CAM_A~E` profile, Round 1 `RoundScenario`, 35 identity persistent lifecycle과 authored Scenario Point
binding은 구현·검증되었다. Round 1/2는 각각 28 Citizen / 7 Villain이며 Round 1 manual target은 약 8 distinct Characters다.

Round 1의 `userLabel`은 `verifiedLabel`과 분리되어 있으며 verification interaction 전에는 training sample로 승격되지 않는다.
다음 단계는 `FIRST_TRAINING` verification interaction 및 Round 2 전이 설계다.

Shopping / Residential의 실제 movement는 해당 Map / Navigation이 준비될 때 연결한다.

---

## 10. Scope Guard

현재 단계에서 하지 않는다.

```text
observation zone별 visible count를 7로 자동 balancing
NPC마다 별도 전용 애니메이션 제작
35개의 고정 raw Node route 하드코딩
Shopping / Residential 미완성 Map의 runtime 경로 임의 생성
Final Scan용 수십~수백 NPC 실제 simulation
```

---

## 11. 현재 한 줄 상태

```text
35 CharacterDefinition identity pool과 Plaza/Park behavior/navigation baseline은 구현 완료됐다.
current gameplay truth는 RoundCharacterAssignment이며 Round 1/2는 각각 35 NPC, 28 Citizen / 7 Villain이다.
Round 1 foundation runtime과 검증은 완료되었고, 다음 단위는 `FIRST_TRAINING` verification interaction 설계다.
```
