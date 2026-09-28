# SWfestival Session Handoff — Current

Updated: 2026-09-14

## 1. 현재 프로젝트 상태

```text
Plaza/Park Map v2                         ✅ FROZEN
Navigation v2 topology                   ✅ FROZEN
N01~N28                                  ✅ FROZEN
E01~E33                                  ✅ FROZEN
SP1~SP10                                 ✅ FROZEN

35 Character visual/identity Pool        ✅ 구현 완료
Semantic intent/runtime                  ✅ 구현 완료
Dijkstra logical routing                 ✅ 구현 완료
Direction-aware two-way lane             ✅ 구현 완료
Junction continuity                      ✅ 구현 완료
Stop Point reservation/defer             ✅ 구현 완료
behaviorHistory                          ✅ 유지
Progress watchdog                        ✅ 2s / 1px
old 2-camera Camera_Zone runtime          ✅ technical baseline
old visibleCharacters / NPC selection    ✅ technical baseline
old Manual Labeling UI / world marker    ✅ technical baseline
```

현재 movement/navigation foundation에서 prototype 진행을 막는 FAIL은 없다.

CURRENT DESIGN:

```text
PLAZA_CAM_A~E authored in TMJ             ✅ 승인된 5-camera prototype profile
RoundScenario truth model                 ✅ 승인
Round 1                                  = 35 NPC / 28 Citizen / 7 Villain
Round 2                                  = 35 NPC / 28 Citizen / 7 Villain
Persistent gameplay lifecycle             ✅ Round 1 구현·검증 완료
Round 1 manual-label target               약 8 distinct Characters
```

NEXT:

```text
최종 regression 기록과 current validation 문서 마감
```

`PLAZA_CAM_A~E` loader, Round 1 `RoundScenario` assignment와 persistent lifecycle은 구현되었다.
`FIRST_TRAINING` 이후 flow와 Round 2는 아직 구현되지 않았다.

상세 문서 인덱스는 `docs/README.md`를 따른다.

---

## 2. Map Source of Truth와 Freeze

현재 기준 Map:

```text
public/maps/plaza-park-v2.tmj
```

역사 보존 Map:

```text
public/maps/plaza-park.tmj
```

현재 고정 범위:

```text
Map v2 geometry
N01~N28
E01~E33
SP1~SP10
```

다음 항목은 Navigation 재검증 없이 변경하지 않는다.

- 도로·보행로 topology
- Collision과 Fence
- 건물 입구
- Node와 Edge
- Stop Point 위치
- 통행 가능 폭

이동 topology를 바꾸지 않는 minor visual polish만 별도 검토할 수 있다.

---

## 3. Runtime 완료 상태

35 Character Pool과 semantic gameplay 데이터를 Navigation 내부 Node sequence에 강결합하지 않는다.

```text
semantic intent
→ Dijkstra logical path
→ direction-aware lane traversal
→ junction continuity
→ Stop Point reservation/defer
```

운영 원칙:

```text
Road = movement only
Hold behavior = Stop Point
behaviorHistory = 시간 흐름에 따라 유지
Watchdog recovery threshold = 2s / 1px
```

Round 1 runtime은 35개 identity를 한 번만 생성하고, STATIC/STAY는 authored Scenario Point에 정착하며,
HOLD_EXIT/THROUGH는 OFFSCREEN으로 나갔다가 같은 identity로 재진입한다. authored point 접근은 기존
lane/Stop Point reservation과 동일한 점유·충돌 검사를 사용한다. `userLabel`과 `verifiedLabel`은 분리되어
수동 라벨만으로 verified sample이 되지 않는다.

`35 Character Pool`은 visual/identity pool이다. current gameplay role은 Round별 `RoundCharacterAssignment.actualLabel`이 결정하며 Round 1/2는 각각 35 NPC, 28 Citizen / 7 Villain이다. 한 observation zone의 visible count는 이동/OFFSCREEN 상태에 따라 달라진다.

---

## 4. 최종 deterministic concurrency validation

현재 고정 Character selection과 deterministic 조건에서:

| Active NPC | Result |
|---:|:---|
| 5 | PASS |
| 8 | PASS |
| 10 | PASS |
| 12 | PASS |
| 15 | PASS |

최종 validation:

```text
unrecovered stall = 0
watchdog report = 0
fixed collision = 0
NPC overlap = 0
road hold violation = 0
```

15 NPC는 검증된 reference이며 최종 gameplay active NPC 수가 아니다.
동시 active 수는 CCTV gameplay와 UX 단계에서 별도로 결정한다.

개발 단계별 증거는 다음 문서를 각각 보존한다.

1. `docs/validation/plaza_park_v2/plaza_park_supervised_concurrency_validation.md`
   - single-centerline baseline, 8+ FAIL
2. `docs/validation/plaza_park_v2/plaza_park_lane_runtime_validation.md`
   - two-way lane + Stop Point 1차 수정, 5/8/10 PASS와 12/15 FAIL
3. `docs/validation/plaza_park_v2/plaza_park_junction_stop_reservation_validation.md`
   - junction continuity + Stop Point reservation 최종 검증, 5/8/10/12/15 PASS

이 결과들은 서로 다른 시점의 역사 기록이며 합치거나 최신 결과로 덮어쓰지 않는다.

---

## 5. Known WARN / 검증 범위

- 최종 concurrency 결과는 deterministic fixed Character selection 기준이다.
- 전체 Character/route permutation을 전수 검증한 결과는 아니다.
- Build에서 Vite의 `>500 kB` chunk warning이 남아 있다.
- 15-NPC reference는 `maxContinuousNoProgressSeconds = 0.95`, junction-transition conflict 26회와 stop-reservation conflict 1회를 기록했지만 unrecovered stall/overlap/fixed collision 없이 PASS했다.
- Round 1 600초 exploratory probe에서는 짧은 watchdog/congestion 진단 3건이 관찰되었으며, identity loss나 물리 위반은 없었다.
- 위 항목은 현재 prototype 진행을 막는 FAIL이 아니다.

Historical Traffic v1의 실패와 수정 과정은
`docs/validation/plaza_park_v1/` 및 `docs/archive/`에 보존한다.
현재 구현 상태 판단에는 해당 문서를 사용하지 않는다.

---

## 6. Historical 2-camera MANUAL_LABELING technical baseline

다음 2-camera vertical slice를 구현·검증했다. 이는 old technical baseline이며 current `PLAZA_CAM_A~E` profile의 구현 완료를 뜻하지 않는다.

```text
CCTV1 / CCTV2
→ Camera_Zone runtime 연결
→ CCTV별 visibleCharacters
→ NPC 선택
→ 시민 / 악당 Manual Labeling
→ MANUAL_LABELING vertical slice
```

구현 기준:

- old `Camera_Zone`의 `CCTV1/CCTV2` Coverage Rectangle Object를 runtime에 직접 로드한다.
- active/visible NPC의 bottom-center feet position으로 CCTV 포함 여부를 판정한다.
- CCTV 이탈 또는 CCTV 전환 시 선택만 해제하고 Character runtime은 유지한다.
- `CharacterRuntimeState.labels.userLabel`이 Source of Truth이며 시민/악당을 즉시 반복 변경할 수 있다.
- world marker는 `userLabel`만 사용한다. definition의 `verifiedLabel`, AI label/confidence는 UI model에 넣지 않는다.
- 기존 navigation, lane, SP, movement 및 character animation은 변경하지 않았다.

이번 구현에서 진행하지 않은 항목:

- Traffic density 추가 탐색
- 20/25/30/35 NPC v2 concurrency test
- Navigation topology 변경
- movement 추가 최적화
- `PLAZA_CAM_A~E` loader/profile integration
- Round 1/Round 2 Scenario Assignment
- persistent gameplay lifecycle
- FIRST_TRAINING
- AI prediction / confidence
- Tracking Review / truth comparison

Shopping District와 Residential은 아직 실제 runtime route를 구현하지 않는다.

Historical evidence는 `docs/validation/plaza_park_v2/plaza_park_cctv_manual_labeling_validation.md`에 당시 2-camera 조건 그대로 보존한다. current 5-camera/ Round 1 결과는 `docs/validation/plaza_park_v2/plaza_park_round1_foundation_validation.md`에 별도로 기록한다.

---

## 7. 변경 원칙

확정된 gameplay rule이나 freeze 범위를 이유 없이 변경하지 않는다.

중요한 설계 변경은:

```text
검토 → 사용자 승인 → 구현
```

순서로 진행한다.
