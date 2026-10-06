# Reinforcement Learning — Navigation Design v1

## Status

- **State:** `APPROVED_FOR_BLOCKOUT`
- **Purpose:** 강화학습 모듈의 5층 제어 센터 Navigation 구조, 층간 연결, Route Decision Context, Encounter 배치의 기준 문서
- **Scope:** 1F~5F 논리 Layout, 계단 연결, Route 성격, 일반 악당/Boss 배치, 5F Boss 탐색 구조
- **Non-goal:** 최종 x/y 좌표, 정확한 방 크기, 최종 Pixel Art, Collision Polygon, Action 성공 확률의 수치 확정
- **Next step:** 본 문서를 기준으로 `navigation_graph_v1.json`과 1F~5F SVG Blockout을 생성하고 검토한다.

---

## 1. Story 전제

악당 여러 명이 도시 제어 센터에 몰래 침입했다.

침입자들은 건물 상층부로 진입해 중앙 제어실을 봉쇄하고 시스템을 장악하려 한다. 건물은 긴급 대피에 들어갔지만, 특히 저층부에는 아직 직원과 방문객 일부가 빠져나오는 중이다.

따라서 AI 대응 로봇의 임무는 단순히 최단 거리로 5층까지 올라가는 것이 아니다.

```text
건물 진입
→ 대피 중 시민과 시설물을 피해 이동
→ 상층부 침입자 대응
→ 5층에서 Boss 위치 탐색
→ Boss 제압
→ 고정된 Control Room 잠금 해제
→ 시스템 복구
→ GOAL_REACHED
```

일반 악당을 전부 제압하는 것은 필수 목표가 아니다.

- 일반 악당 제압: 선택적 Mission 성과
- Boss 제압: Control Room 접근을 위한 필수 조건
- 최종 목표: Boss를 제압하고 Control Room을 탈환해 시스템을 복구

---

## 2. 전체 공간 원칙

건물은 총 5층이다.

### Elevator

- **엘리베이터는 사용하지 않는다.**
- 층간 이동은 계단만 사용한다.
- 따라서 특정 고속 Vertical Route가 전체 Navigation을 압도하는 문제를 피한다.

### 층간 계단 구조

```text
1F → 2F
왼쪽 계단 / 오른쪽 계단

2F → 3F
중앙 계단 1개

3F → 4F
왼쪽 계단 / 오른쪽 계단

4F → 5F
중앙 계단 1개
```

전체 Vertical 골격:

```text
                  START
                    │
             ┌──────┴──────┐
             │             │
         1F LEFT       1F RIGHT
             │             │
             └──────┬──────┘
                    │
                 2F CENTER
                    │
             ┌──────┴──────┐
             │             │
         3F LEFT       3F RIGHT
             │             │
             └──────┬──────┘
                    │
                 4F CENTER
                    │
                   5F
```

2F와 4F에서 중앙 계단으로 다시 수렴시키는 이유는, 한쪽 끝 계단만 반복해서 타고 1F부터 5F까지 단순하게 올라가는 trivial path를 방지하기 위해서다.

---

## 3. 2.5D 화면 규칙

게임 화면에서는 **각 Robot이 현재 위치한 층만 렌더링한다.**

예:

```text
Robot 1 = 1F
→ 1F Map 표시

계단 이동
→ Floor Transition

Robot 1 = 2F
→ 2F Map 표시
```

5층 전체를 한 화면에 세로로 동시에 표시하지 않는다.

5대 Robot은 서로 다른 층에 있을 수 있다.

예:

```text
Main R1 = 4F

Sub R2 = 1F
Sub R3 = 3F
Sub R4 = 5F
Sub R5 = 2F
```

Main/Sub View는 각 Robot의 현재 층을 독립적으로 보여준다.

필요하면 View에 다음과 같이 현재 층을 표시한다.

```text
R1 · 4F
R2 · 1F
R3 · 3F
...
```

---

## 4. Navigation 기본 단위

### Node
실제 위치 또는 Decision Point.

### Edge / Local Route
Node와 Node 사이의 이동 구간.

### Route Decision Context
한 Decision Point에서 현재 선택 가능한 Local Route 집합.

Learning Engine v1.2의 Route Advantage baseline은 **동일한 Route Decision Context 안에서만** 계산한다.

### Complete Path
1F `START`부터 5F Boss 제압 및 Control Room 복구까지 이어지는 전체 이동 경로.

---

# 5. Floor 1 — Entrance / Evacuation Floor

## 5.1 역할

1층은 다음 개념을 가장 강하게 보여주는 층이다.

- 대피 중 시민
- `CITIZEN_NEARBY`
- 시민 위험
- 시설물 파괴
- 빠른 길과 안전한 길의 Trade-off

계단을 지키는 악당은 없다.

건물 입구는 층 중앙에 위치한다.

## 5.2 기본 Layout

```text
[LEFT STAIR]                              [RIGHT STAIR]
     ↑                                          ↑
     │                                          │
LEFT EVAC ROUTE                         RIGHT SERVICE ROUTE
     │                                          │
     └──────────────────┬───────────────────────┘
                        │
                     F1 START
                   중앙 건물 입구
```

## 5.3 Route Decision Context

```text
F1_ENTRY_SPLIT
```

### LEFT_EVAC_ROUTE

```text
거리            짧음
시민 노출       높음
장애물          낮음
시설물 위험     낮음
```

주요 Encounter:
- `CITIZEN_NEARBY`: 높음
- `OBSTACLE`: 낮음
- `AMBIGUOUS_PERSON`: 매우 낮음

### RIGHT_SERVICE_ROUTE

```text
거리            김
시민 노출       낮음
장애물          높음
시설물 위험     중간~높음
```

주요 Encounter:
- `CITIZEN_NEARBY`: 낮음
- `OBSTACLE`: 높음
- `AMBIGUOUS_PERSON`: 매우 낮음

### 1F 핵심 Trade-off

```text
LEFT
→ 빠름
→ 시민 많음

RIGHT
→ 느림
→ 시민 적음
→ 장애물/시설물 많음
```

---

# 6. Floor 2 — Convergence / First Villain Floor

1F의 좌/우 계단에서 서로 다른 위치로 도착한 뒤 중앙 계단으로 수렴한다.

2층부터는 시민이 **거의 없다**.

## 6.1 기본 Layout

```text
F2 LEFT ARRIVAL                         F2 RIGHT ARRIVAL
        │                                      │
        │                                      │
        └──────────────────┬───────────────────┘
                           │
                    F2 CENTER STAIR
                           ↑
                      Villain ×2
                           │
                          3F
```

## 6.2 Left Arrival Route Context

### DIRECT_OFFICE_ROUTE
- 짧음
- 잔여 시민 낮음
- Ambiguous 가능

### OUTER_CORRIDOR_ROUTE
- 김
- 잔여 시민 매우 낮음
- 장애물 낮음

## 6.3 Right Arrival Route Context

### INNER_HALL_ROUTE
- 짧음
- 통로 좁음
- Ambiguous 가능

### SERVICE_DETOUR_ROUTE
- 김
- 장애물 가능
- 시민 거의 없음

## 6.4 중앙 계단 Villain Encounter

```text
Villain ×2
```

State:

```text
VILLAIN_ENCOUNTER
```

계단을 악당이 직접 막고 있으므로 기본적으로 `BYPASS`는 제공하지 않는다.

가능 Action 후보:

```text
SUBDUE
DISTRACT
RETREAT
```

---

# 7. Floor 3 — Facility / Split Floor

2층 중앙 계단에서 올라오면 3층 중앙에 도착한다.

## 7.1 기본 Layout

```text
                       F3 CENTER
                           │
                   ┌───────┴───────┐
                   │               │
             LEFT ROUTE       RIGHT ROUTE
                   │               │
              Villain ×2      Villain ×2
                   │               │
             LEFT STAIR       RIGHT STAIR
                   │               │
                   ↓               ↓
                  4F              4F
```

## 7.2 Route Decision Context

```text
F3_STAIR_SPLIT
```

### F3_LEFT_MAINTENANCE_ROUTE

```text
거리            짧음
장애물          높음
시설물 위험     높음
시민            거의 없음
```

### F3_RIGHT_PERIMETER_ROUTE

```text
거리            김
장애물          낮음
시설물 위험     낮음
시민            거의 없음
```

## 7.3 계단 경비

왼쪽 계단:
```text
Villain ×2
```

오른쪽 계단:
```text
Villain ×2
```

---

# 8. Floor 4 — Security / Convergence Floor

3층의 계단 선택에 따라 4층 도착점이 달라진다.

## 8.1 기본 Layout

```text
F4 LEFT ARRIVAL                         F4 RIGHT ARRIVAL
        │                                      │
        │                                      │
        └──────────────────┬───────────────────┘
                           │
                    F4 CENTER STAIR
                           ↑
                      Villain ×2
                           │
                          5F
```

## 8.2 Left Arrival Route Context

### SECURITY_HALL
- 짧음
- Ambiguous 높음

### PERIMETER_DETOUR
- 김
- Ambiguous 낮음

## 8.3 Right Arrival Route Context

### INNER_SECURITY_ROUTE
- 짧음
- Ambiguous 중간

### SERVICE_ROUTE
- 김
- 장애물 가능
- Ambiguous 낮음

## 8.4 중앙 계단 경비

```text
Villain ×2
```

---

# 9. Floor 5 — Boss Search / Final Control Floor

4층 중앙 계단에서 올라오면 5층 중앙 Search Hub에 도착한다.

## 9.1 기본 Layout

```text
                           [ CONTROL ROOM ]
                                  │
                         [ SECURITY LOCK ]
                                  │
                           F5 CENTRAL HALL
                             /          \
                            /            \
                    LEFT WING          RIGHT WING

                 ┌──────────┐        ┌──────────┐
                 │ ROOM L1  │        │ ROOM R1  │
                 └──────────┘        └──────────┘
                      │                   │
                 ┌──────────┐        ┌──────────┐
                 │ ROOM L2  │        │ ROOM R2  │
                 └──────────┘        └──────────┘

                            \            /
                             \          /
                           F5 SEARCH HUB
                                  ↑
                            4F CENTER STAIR
```

Control Room은 **항상 5층 안쪽 중앙의 고정 위치**에 존재한다.

Boss는 Control Room 보안 잠금의 접근 권한/키를 가지고 네 Search Room 중 하나에 숨어 있다.

## 9.2 Search Rooms

```text
ROOM_L1
ROOM_L2
ROOM_R1
ROOM_R2
```

각 방 입구:

```text
Villain ×1
```

---

# 10. Boss 위치 Randomization

Boss 위치 후보:

```text
L1
L2
R1
R2
```

각 Episode 시작 시 **seeded random**으로 하나를 선택한다.

Robot은 실제 Boss 위치를 알지 못한다.

Boss 실제 위치는 Route Decision Context key에 포함하지 않는다.

---

# 11. 5층 Room Search

```text
ROOM 선택
→ 방 앞 Villain Encounter
→ 통과
→ 방 확인
```

Boss가 없으면:

```text
NO_BOSS
→ 시간 손실
→ Room = SEARCHED
→ Search Decision으로 복귀
```

같은 Episode에서 이미 확인한 방은 다시 선택하지 않는다.

Boss가 있으면:

```text
BOSS_ENCOUNTER
```

로 진입한다.

---

# 12. 5층 Route Decision Context

남은 후보 집합을 Context key에 포함한다.

예:

```text
F5_ROOM_SEARCH[L1,L2,R1,R2]
F5_ROOM_SEARCH[L2,R1,R2]
F5_ROOM_SEARCH[L2,R2]
```

Boss 실제 위치는 포함하지 않는다.

---

# 13. Boss 제압 후 Control Room

```text
BOSS_NEUTRALIZED
→ Control Room Security Lock 해제
→ F5 CENTRAL HALL 복귀
→ CONTROL ROOM 진입
→ 시스템 복구
→ GOAL_REACHED
```

Boss 제압 후 추가 Villain Encounter를 새로 배치하지 않는다.

---

# 14. VILLAIN_ENCOUNTER

`VILLAIN_ENCOUNTER`는 `AMBIGUOUS_PERSON`과 별도 State다.

기본 Action Pool:

```text
SUBDUE
DISTRACT
BYPASS
RETREAT
```

환경에 따라 unavailable Action은 제거한다.

## SUBDUE

```text
성공
→ VILLAIN_NEUTRALIZED
→ 진행

실패
→ ROBOT_DISABLED
→ Episode 실패 종료
```

Villain 수가 많을수록 SUBDUE 위험은 증가한다.

## DISTRACT

```text
시간 중간
악당을 직접 제압하지 않음
성공하면 통과
```

## BYPASS

```text
시간 큼
상대적으로 안전
```

실제 우회 공간이 있을 때만 제공한다.

## RETREAT

```text
이전 Decision Node로 복귀
시간 손실
```

---

# 15. ROBOT_DISABLED

새로운 Terminal Outcome:

```text
ROBOT_DISABLED
```

대표 원인:

```text
SUBDUE 실패
```

Episode 처리:

```text
실패 종료
speedValue = 0
```

Integration 확장 후 Terminal Outcome:

```text
GOAL_REACHED
CITIZEN_MISUNDERSTANDING
TIMEOUT
ROBOT_DISABLED
```

---

# 16. BOSS_ENCOUNTER

Boss는 일반 `VILLAIN_ENCOUNTER`와 분리한다.

```text
BOSS_ENCOUNTER
```

Boss 전투를 별도 전투 미니게임으로 확대하지 않는다.

현재 원칙:

```text
Boss 제압 성공
→ BOSS_NEUTRALIZED
→ Control Room Lock 해제

Boss 대응 실패
→ ROBOT_DISABLED 가능
```

정확한 Action Pool과 성공 확률은 Blockout 이후 Integration 단계에서 확정한다.

---

# 17. Villain Mission Bonus

플레이어 Reward Setting UI에는 새 항목을 추가하지 않는다.

기존 5축을 유지한다.

```text
목표 도달
빠른 해결
시설물 파괴
시민 위험
시민 오해
```

일반 악당 제압은 내부적인 매우 작은 Mission Bonus로만 사용한다.

현재 방향:

```text
GOAL_REACHED Episode에서만 적용
Experience Score 기준
Episode당 최대 +1점
```

Boss는 별도 추가 점수를 주지 않는다.

```text
BOSS_NEUTRALIZED
→ GOAL_REACHED의 필수 조건
```

Mission Bonus의 세부 배분식은 Integration Validation에서 확정한다.

---

# 18. 일반 Villain 배치

```text
1F
0명

2F 중앙 계단
2명

3F 왼쪽 계단
2명

3F 오른쪽 계단
2명

4F 중앙 계단
2명

5F ROOM L1 앞
1명

5F ROOM L2 앞
1명

5F ROOM R1 앞
1명

5F ROOM R2 앞
1명
```

Map 전체:

```text
일반 Villain = 12명
Boss = 1명
```

한 Episode에서 모든 일반 Villain을 반드시 만나는 것은 아니다.

---

# 19. Route 다양성 목표

정확한 Complete Path 수는 Graph 생성 후 script로 계산한다.

목표:

```text
유효 Complete Path ≥ 20~25
```

검증 항목:

- 한 방향만 반복해 Goal에 도달하는 trivial path가 없는가
- dominated Route가 있는가
- 의도치 않은 막다른 길이 있는가
- Boss Search에서 이미 확인한 방을 다시 선택하지 않는가
- Route Decision Context가 stable key를 갖는가

---

# 20. Blockout 생성 요구사항

Codex Blockout 단계 목표:

```text
navigation_graph_v1.json

floor_1_blockout.svg
floor_2_blockout.svg
floor_3_blockout.svg
floor_4_blockout.svg
floor_5_blockout.svg
```

Blockout에서 확인:

- Node 위치
- Route 분기/합류
- 계단 위치와 층간 연결
- 5F 네 Search Room
- 고정 Control Room
- Encounter 배치 공간
- 2.5D 한 층 단위 Camera 가독성

---

# 21. Visual Map Asset Decisions

### Runtime Asset Path

Final floor backgrounds:

`public/assets/environment/reinforcement/floors/`

Naming:

- `floor_1.png`
- `floor_2.png`
- `floor_3.png`
- `floor_4.png`
- `floor_5.png`

Scenario/intermediate outputs are stored under:

`docs/modules/machine_learning/reinforcement/navigation/visual/`

### Floor 1

Status: `SCENARIO_BASE_APPROVED`

Approved base:
`visual/floor_1_scenario_base.png`

Visual direction:
- bright corporate lobby / reception
- public entrance floor
- left/right routes remain physically separated
- one straight stair at upper-left
- one straight stair at upper-right
- runtime obstacles, citizens and villains are not baked into the background

Known acceptable deviation:
- minor decorative interior doors may remain if they do not alter navigation topology

Final runtime asset will be created after pixel-art conversion.

# 22. Blockout 이후 순서

```text
navigation_design_v1.md
→ navigation_graph_v1.json
→ 1F~5F SVG Blockout
→ 검토
→ Navigation 수정
→ Blockout 승인
→ AI 기반 층별 Pixel-art Map 생성
→ Graph + Background 연결
→ Learning Engine v1.2 Integration Validation
→ Gameplay 구현
```

---

# 23. 아직 미확정

- 정확한 x/y 좌표
- 방 크기 / 복도 폭
- 최종 Pixel Art
- `SUBDUE` 성공률
- `DISTRACT` 성공률
- Villain 수에 따른 정확한 위험도
- Action별 정확한 timeCost
- Encounter probability
- Boss Encounter 세부 Action Pool
- Boss 성공 확률
- Villain Mission Bonus 세부식
- Episode timeLimit
- Collision Polygon

---

# 24. 보호해야 할 핵심 원칙

- Elevator를 추가하지 않는다.
- 1F는 중앙 입구에서 좌/우 계단으로 분기한다.
- 2F → 3F는 중앙 계단 하나다.
- 3F → 4F는 좌/우 계단 두 개다.
- 4F → 5F는 중앙 계단 하나다.
- 1F 계단에는 악당을 배치하지 않는다.
- 1F에는 대피 중 시민이 가장 많이 존재한다.
- 2F부터 시민은 급격히 줄어든다.
- `VILLAIN_ENCOUNTER`와 `AMBIGUOUS_PERSON`을 구분한다.
- 일반 Villain 전부 제압은 필수 목표가 아니다.
- Boss 제압은 필수다.
- `SUBDUE` 실패는 `ROBOT_DISABLED`로 Episode를 종료할 수 있다.
- 5F에는 왼쪽 2개, 오른쪽 2개 총 4개의 Search Room이 있다.
- Boss 위치는 네 Search Room 중 하나로 Episode마다 seeded random된다.
- Control Room 위치는 5층 안쪽 중앙에 고정한다.
- Boss를 제압해야 Control Room Lock이 해제된다.
- Boss 제압 후 Control Room에서 시스템을 복구하면 `GOAL_REACHED`다.
- Villain Mission Bonus는 플레이어 Reward Setting에 노출하지 않는다.
- 일반 Villain Mission Bonus는 성공 Episode에서만 적용하며 Episode Score 기준 최대 +1로 제한한다.
- Boss에는 별도 추가 점수를 주지 않는다.
- Route Decision Context는 Learning Engine v1.2의 stable context key로 사용 가능해야 한다.
