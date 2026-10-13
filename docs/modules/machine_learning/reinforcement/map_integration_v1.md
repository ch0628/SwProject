# Reinforcement Learning — Map Integration v1 Contract

## Status

- **State:** `ACTUAL_MAP_LOGIC_INTEGRATION_APPROVED`
- **Scope:** 실제 Floor 1~5 Navigation / Encounter / Simulation Time production 계약
- **Numeric Source of Truth:** 이 문서
- **Production Environment:** `SET_D / v1`
- **Not included:** Phaser production movement/rendering, Training UI, animation/audio

`learning_engine_v1.md`, `module_spec_v3.md`, `navigation_design_v1.md`, `session_handoff_v3.md`와 충돌하면 이 문서의 Map Integration v1 수치를 우선한다. Core Learning 수식은 `learning_engine_v1.md`를 우선한다.

## 1. Protected Core Learning Contract

- User Weight: `0 / 1 / 2 / 3`
- Encounter Credit: `0.35 Episode + 0.65 Local`
- Route Segment Credit: `0.35 Episode + 0.65 Segment`
- `learningRate = 0.35`
- Preference clamp: `[-2, +2]`
- Exploration: `0.35 → 0.25 → 0.15 → 0.10` at Rounds `1 / 6 / 11 / 16`
- One Round: 5 Robots use one Central Policy Snapshot; no mid-Round update; one update after all 5 Episodes
- Route Context별 Relative Advantage와 Preference re-center 유지

## 2. Simulation Time

Simulation clock는 animation/FPS/loading/UI pause와 독립적인 pure state다.

- Navigation polyline `1 tile movement = 1 simulation time unit`
- Route base timeCost는 Route 이름이 아니라 실제 polyline 길이 합계로 계산한다.
- UI animation, Toast, Cutscene, Scene loading, Render pause는 `elapsedTime`에 포함하지 않는다.
- Action baseline: `VERY_SMALL=1`, `SMALL=2`, `MEDIUM=4`, `LARGE=6`

## 3. Route Trait / Environment

| Trait | 값 | Candidate Encounter 발생률 |
|---|---:|---:|
| `NONE` | 0.00 | 없음 |
| `LOW` | 0.25 | 25% |
| `MEDIUM` | 0.50 | 50% |
| `HIGH` | 0.75 | 75% |
| Mandatory | — | 100% |

Trait 후보는 `citizenExposure / obstacleChance / ambiguousPersonChance / narrowness`다. `timeCost`는 Trait이 아니라 polyline 길이를 쓴다. Route는 직접 `CITIZEN_RISK / FACILITY_DAMAGE`를 만들지 않는다.

Encounter draw는 Episode seed 기반 deterministic random이다. 같은 Episode의 같은 `zoneId`는 최초 결과를 cache하며 재추첨하지 않는다.

## 4. OBSTACLE

기본 Action Pool: `DETOUR / CLEAR / PUSH`. 일반 OBSTACLE에서 `SQUEEZE / WAIT`는 unavailable이다.

| Action | 시간 | 결과 |
|---|---:|---|
| `DETOUR` | +6 | alternate route로 100% safe pass; 실제 우회가 없으면 unavailable |
| `CLEAR` | +4 | 100% obstacle cleared/pass; 시설물 피해 없음 |
| `PUSH` | +2 | 70% clean pass, 25% `FACILITY_DAMAGE`, 5% `BLOCKED` |

`PUSH/BLOCKED`는 추가 +2 time 후 obstacle이 남고 같은 State에서 다시 선택한다. OBSTACLE은 `ROBOT_DISABLED`를 만들지 않는다.

Obstacle은 이동 가능한 runtime entity다. 발생 시 `active + blocking`, 미발생 시 route clear, 성공 후 cleared/inactive다. permanent Collision wall이나 명백한 side gap을 전제로 하지 않는다. 시각 예시는 overturned service cart, collapsed cargo boxes, fallen equipment rack, broken movable equipment다.

## 5. VILLAIN_ENCOUNTER

기본 후보: `SUBDUE / FORCE_PASS / DISTRACT / BYPASS / RETREAT`. 환경상 불가능한 Action은 선택 전 제거한다.

- `SUBDUE` (+1): Villain ×1 성공 90%, ×2 성공 80%. 성공은 `VILLAIN_NEUTRALIZED`, 실패는 `ROBOT_DISABLED`.
- `FORCE_PASS` (+2): ×1=`PASS 70 / BLOCKED 20 / MOBILITY_DAMAGE 10%`, ×2=`PASS 50 / BLOCKED 30 / MOBILITY_DAMAGE 20%`.
- `BLOCKED`: 추가 +3 time, 같은 Encounter에 남아 다시 선택.
- `MOBILITY_DAMAGE`: 통과하되 다음 Route Segment movement time만 `×1.35`; 다음 Decision Node에서 해제. `ROBOT_DISABLED`가 아니다.
- `DISTRACT` (+4): 100% pass.
- `BYPASS`: 실제 geometry 우회가 있을 때만 deterministic safe bypass.
- `RETREAT`: 이전 Decision Node까지 실제 복귀 polyline time을 반영.

오직 `SUBDUE` 성공만 해당 Villain을 Episode 동안 neutralized한다. 나머지는 재방문 시 다시 Encounter가 발생할 수 있다.

## 6. BOSS_ENCOUNTER

Action Pool: `SUBDUE / DISTRACT / RETREAT`; `BYPASS` 없음.

- `SUBDUE` (+1): 기본 성공 80%; 성공은 `BOSS_NEUTRALIZED`, 실패는 `ROBOT_DISABLED`.
- `DISTRACT` (+4): Boss를 `DISTRACTED`로 만들며 이후 같은 Encounter의 `SUBDUE` 성공률은 95%. neutralize하지 않는다.
- `RETREAT`: Search Decision으로 실제 경로 시간만큼 복귀. Boss 위치 확인 상태는 유지 가능.

Boss neutralize 전에는 Control Room에 접근할 수 없다. `BOSS_NEUTRALIZED → Security Lock unlock → Control Room → SYSTEM_RESTORED → GOAL_REACHED`이며 neutralize 자체는 Episode 종료가 아니다. 별도 전투 미니게임은 만들지 않는다.

## 7. AMBIGUOUS_PERSON TRACK

`TRACK = +3 simulation time`. 실제 대상이 `CITIZEN`일 때 같은 Encounter의 누적 TRACK time이 `6 이상`이면 `CITIZEN_MISUNDERSTANDING` terminal failure다. 한 번의 TRACK(+3)은 실패가 아니다.

## 8. Episode timeLimit / normalization

Actual Map Integration에서 실제 graph/action cost로 `longestSafeSuccessBaseline`을 계산한 뒤 다음을 확정한다.

```text
timeLimit = longestSafeSuccessBaseline * 1.25
speedValue = 1 - elapsedTime / timeLimit
```

Actual-map adapter가 계산한 baseline/timeLimit 값은 confirmation report에 기록한다. Mock validation limit는 production contract와 분리한다.

다음 normalization은 Production v1에서 유지한다.

```text
damageValue = min(facilityDamageCount / 3, 1)
riskValue = min(citizenRiskCount / 3, 1)
```

## 9. Stair Transition UX

다음 6개 transition은 목적지 쪽 32px(1 tile) strip이고 robot physics edge가 아니라 center point 진입으로 판정한다. 기존 targetFloor/targetSpawn/spawn/visual/topology와 gate protection은 유지한다.

- F1 LEFT → F2 LEFT
- F1 RIGHT → F2 RIGHT
- F2 CENTER → F3 CENTER
- F3 LEFT → F4 LEFT
- F3 RIGHT → F4 RIGHT
- F4 CENTER → F5 SEARCH HUB

현재 TMJ strip은 각 계단 진행도 60% 이후에 시작하며 `BuildingTransitionGate`가 initial overlap과 duplicate/ping-pong transition을 막는다.

## 10. Actual Map Integration Gate

다음 단계에서만 수행한다.

1. 실제 TMJ Navigation polyline과 Learning Engine 연결
2. actual safe baseline/timeLimit 산출
3. 5 Robots × 20 Rounds = 100 Episodes
4. Event 빈도 기반 damage/risk normalization 재평가
5. Production movement/UI/animation 연결

