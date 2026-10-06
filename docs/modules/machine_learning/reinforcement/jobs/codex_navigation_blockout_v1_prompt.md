# Codex Job — Reinforcement Navigation Blockout v1

## Goal

`navigation_design_v1.md`에 승인된 5층 강화학습 Navigation을 **논리 Graph + 검토 가능한 SVG Blockout**으로 변환한다.

이번 작업은 최종 Phaser gameplay 구현이나 Pixel Art 제작이 아니다.

## 반드시 먼저 읽을 문서

1. `docs/modules/machine_learning/reinforcement/navigation_design_v1.md`
2. `docs/modules/machine_learning/reinforcement/module_spec_v3.md`
3. `docs/modules/machine_learning/reinforcement/learning_engine_v1.md`
4. `docs/modules/machine_learning/reinforcement/session_handoff_v3.md`
5. `docs/modules/machine_learning/reinforcement/validation/learning_engine_validation_v1_2.md`
6. `docs/project/module_contract.md`

충돌 시 최신 `navigation_design_v1.md`의 Navigation/Map 결정을 우선한다. 기존 validation 문서는 Core Algorithm 검증 기록이므로 신규 Map 설계를 거꾸로 덮어쓰지 않는다.

## 보호해야 할 확정 구조

- Elevator 없음.
- 각 Robot View는 현재 층 하나만 보여주는 2.5D 구조를 전제로 한다.
- 1F: 중앙 입구 → 왼쪽 계단 / 오른쪽 계단. 계단 경비 Villain 없음. 대피 시민 가장 많음.
- 2F: 1F 좌/우 계단에서 서로 다른 Arrival → 중앙 계단으로 수렴. 중앙 계단 Villain ×2.
- 3F: 중앙 Arrival → 왼쪽 / 오른쪽 계단. 각 계단 Villain ×2.
- 4F: 3F 좌/우 계단에서 서로 다른 Arrival → 중앙 계단으로 수렴. 중앙 계단 Villain ×2.
- 5F: 중앙 Search Hub. 왼쪽 Wing에 L1/L2, 오른쪽 Wing에 R1/R2 총 4 Search Room.
- 5F 각 Search Room 입구 Villain ×1.
- Boss 위치는 L1/L2/R1/R2 중 Episode별 seeded random이며 Graph는 특정 Boss 위치를 고정하지 않는다.
- Control Room은 5F 안쪽 중앙의 고정 위치.
- Boss 제압 후에만 Control Room Lock이 해제되고 시스템 복구 → GOAL_REACHED.
- 5F Search에서 이미 확인한 Room은 다시 선택하지 않는 상태 표현이 가능해야 한다.
- Boss 실제 위치는 hidden Environment state이며 Route Context key나 Policy 입력에 포함하면 안 된다.
- 일반 Villain 전부 제압은 필수 목표가 아니다.
- VILLAIN_ENCOUNTER와 BOSS_ENCOUNTER는 별도 State다.
- Blockout 단계에서 Action 성공 확률, 정확한 Reward, 최종 timeCost를 임의 확정하지 않는다.

## 핵심 설계 의도

각 Route는 단순 좌우 대칭 장식이 아니라 실제 Trade-off를 가져야 한다.

### 1F
- LEFT: 짧음 / 시민 노출 높음 / 장애물 낮음.
- RIGHT: 김 / 시민 노출 낮음 / 장애물·시설물 위험 높음.

### 2F
좌/우 Arrival 각각 중앙 계단으로 가는 최소 2개의 내부 접근 Route 후보가 시각적으로 가능해야 한다.
- 짧은 Route는 잔여 시민, 좁음, Ambiguous 등의 위험을 가질 수 있음.
- 긴 Route는 상대적으로 안전하거나 장애물 성격이 달라야 함.

### 3F
- LEFT: 짧은 Maintenance 계열 / 장애물·시설물 위험 높음.
- RIGHT: 긴 Perimeter 계열 / 장애물·시설물 위험 낮음.
- 두 계단 모두 경비 Villain ×2.

### 4F
좌/우 Arrival 각각 중앙 계단으로 가는 내부 Route 대안이 있어야 한다.
- Security Hall 계열은 짧지만 Ambiguous Person 노출이 높을 수 있음.
- Perimeter / Service 계열은 길지만 상대적으로 안전.

### 5F
- 중앙 Arrival/Search Hub에서 Left Wing / Right Wing으로 이동 가능.
- L1/L2/R1/R2 네 Room의 접근 동선이 읽혀야 함.
- 중앙 안쪽 Control Room은 Search Room과 구분되는 고정 최종 공간이어야 함.
- Boss가 어느 Room에 있든 탐색 후 중앙 Control Room으로 복귀 가능한 구조여야 함.

## 생성할 파일

가능하면 다음 경로를 사용하되 repository 관례가 다르면 기존 docs 구조를 확인해 가장 자연스러운 위치를 선택하고 결과에 정확한 경로를 보고한다.

### 1. Navigation Graph

`docs/modules/machine_learning/reinforcement/navigation/navigation_graph_v1.json`

최소 schema 예시:

```json
{
  "version": "v1",
  "floors": [
    {
      "floor": 1,
      "nodes": [],
      "edges": []
    }
  ],
  "verticalConnections": [],
  "goal": {},
  "bossSearch": {}
}
```

각 Node는 최소 다음 성격을 표현할 수 있어야 한다.

```text
id
floor
type
label
x
y
routeContextId (Decision Node인 경우)
```

각 Edge는 최소:

```text
id
from
to
bidirectional 여부
visualRouteId
traits (현재는 LOW/MEDIUM/HIGH 같은 design-level 값 허용)
encounterCandidates
```

을 표현할 수 있어야 한다.

정확한 Runtime schema는 이번 작업에서 과도하게 확정하지 말고, Blockout / validation에 필요한 만큼만 만든다.

### 2. SVG Blockout

- `floor_1_blockout.svg`
- `floor_2_blockout.svg`
- `floor_3_blockout.svg`
- `floor_4_blockout.svg`
- `floor_5_blockout.svg`

SVG는 최종 Game Art가 아니다.

요구사항:
- 16:9 Landscape 화면에서 읽기 쉬운 한 층 단위 구도.
- 동일한 viewBox / canvas size를 5층에 사용.
- Node 위치와 Route가 시각적으로 식별 가능해야 함.
- 계단 위치가 위/아래 층 연결과 논리적으로 일치해야 함.
- Encounter 후보 위치를 간단한 label/icon placeholder로 표시.
- Villain ×1 / ×2 위치 표시.
- 시민/장애물/Ambiguous 후보 Zone 표시.
- 5F는 L1/L2/R1/R2 + 중앙 Control Room이 명확히 구분되어야 함.
- 최종 Pixel Art를 흉내 내려고 복잡하게 꾸미지 말 것.
- 구조 확인이 목적이므로 단순 도형, 라벨, 선을 우선할 것.

## Stable Route Decision Context

Learning Engine v1.2의 Route Relative Advantage 때문에 Decision Context는 반드시 안정적인 ID를 가져야 한다.

예:

```text
F1_ENTRY_SPLIT
F2_LEFT_APPROACH
F2_RIGHT_APPROACH
F3_STAIR_SPLIT
F4_LEFT_APPROACH
F4_RIGHT_APPROACH
```

5F Search는 remaining room set에 따라 Context가 달라질 수 있어야 한다.

예:

```text
F5_ROOM_SEARCH[L1,L2,R1,R2]
F5_ROOM_SEARCH[L2,R1,R2]
F5_ROOM_SEARCH[L2,R2]
```

구현에서 문자열을 직접 무한 생성하기보다 canonical sorted remaining-room set을 이용해 deterministic key를 만드는 helper/schema를 제안해도 된다.

Boss 실제 위치는 key에 절대 포함하지 않는다.

## Path Enumeration / Sanity Script

Graph 파일과 함께 가능하면 작은 validation script를 작성한다.

목표:
- START에서 Control Room GOAL까지 구조적으로 가능한 Route 조합을 enumerate 또는 계산.
- 최소 20~25개 이상의 의미 있는 Complete Path가 가능한지 확인.
- unreachable node 검사.
- accidental dead end 검사.
- duplicate node / edge id 검사.
- routeContextId 누락 검사.
- 층간 Stair 연결 검사.
- 5F Search Room 4개와 Control Room 존재 검사.

Boss room randomization까지 모든 search permutation을 무리하게 “고정 Complete Path”로 세지 말고, **Navigation path와 Search order를 구분해서 결과를 보고**한다.

## 중요 — 하지 말 것

- Production Phaser Scene을 구현하지 말 것.
- Learning Engine Core 수치(`0.35/0.65`, learningRate, clamp, exploration)를 수정하지 말 것.
- SUBDUE / DISTRACT 성공률을 임의로 정하지 말 것.
- Villain Mission Bonus 세부 수식을 임의 확정하지 말 것.
- Pixel Art 생성하지 말 것.
- Tiled/TMX를 필수 구조로 도입하지 말 것.
- 기존 AI Basics / supervised FSM을 수정하지 말 것.
- `learning_engine_validation_v1_2.md`를 수정하지 말 것.
- Navigation 때문에 신규 서버/DB를 추가하지 말 것.

## 작업 후 보고 형식

1. 읽은 문서와 충돌 여부
2. 생성/수정한 파일 목록
3. Floor 1~5 각각의 Blockout 구조 요약
4. Node / Edge / Route Context 수
5. START→GOAL Navigation path 수 또는 계산 방식
6. 5F Search order 다양성은 별도로 설명
7. 발견한 모순 / 질문
8. 아직 미확정으로 남긴 값
9. 실행한 validation / test 결과
10. `git diff --check` 결과

이번 작업의 완료 조건은 **예쁜 Map**이 아니라, 사람이 SVG 5장을 보고 Navigation 논리를 검토할 수 있고 JSON Graph가 그 구조와 일치하는 것이다.
