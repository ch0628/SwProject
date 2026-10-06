# SWfestival AI Learning Prototype

초등학생이 게임 상호작용을 통해
**지도학습 / 비지도학습 / 강화학습의 차이를 직관적으로 경험**하도록 만드는 웹 프로토타입이다.

현재 Plaza/Park는 `plaza-park-v2.tmj` 기준 Map v2와 Navigation v2,
35 Character Pool 및 movement/navigation foundation 구현·검증을 완료했다.

old CCTV1/CCTV2 `MANUAL_LABELING` technical baseline은 완료됐다.
현재 승인된 playable profile은 `PLAZA_CAM_A~E`, Round 1/2 각 35 NPC·28 Citizen/7 Villain이며,
다음 단계는 35-NPC Round 1/Round 2 Scenario Assignment audit/design이다.

---

## 1. 기술 스택

```text
Frontend / UI
= React + TypeScript + Vite

Game
= Phaser 4

Map Authoring
= Tiled

Rendering
= top-down 2.5D pixel art
= Orthogonal Tilemap

Tile
= 32×32 px
```

현재 프로토타입 대상:
- PC / 노트북
- Landscape
- Chrome 계열 브라우저
- 60fps 목표

---

## 2. 실행

Node.js 22.12+ 또는 24 권장.

```sh
npm ci
npm run dev
```

개발 서버:

```text
http://127.0.0.1:5173
```

검사:

```sh
npm run typecheck
npm run build
npm test
npm run preview
```

현재 lint는 설정하지 않았다.

Build Output:

```text
dist/
```

`dist/`는 `.gitignore` 대상이며 Source of Truth로 사용하지 않는다.

---

## 3. 프로젝트 구조

핵심 구조:

```text
ai/
├─ CONTEXT_MAP.md
├─ RULES.md
├─ WORKFLOW.md
└─ skills/
   └─ character_asset/

assets/
└─ characters/
   ├─ rabbit/
   ├─ fox/
   ├─ tiger/
   ├─ cat/
   └─ dog/

docs/
├─ README.md
├─ project/
├─ modules/
├─ shared/
├─ reference/
├─ validation/
└─ archive/
```

실제 Source Code / Test 디렉터리는 위 요약과 별도로 프로젝트에 존재하며,
작업 시 `ai/CONTEXT_MAP.md`에 따라 필요한 문서만 읽는다.

---

## 4. AI 학습 프로토타입

### 지도학습

핵심 경험:

```text
사람이 검증된 정답을 제공
→ 중앙 AI 학습
→ 사용자와 AI 판단 비교
→ 오답 수정 / 재학습
→ AI가 대규모 자동 판별
```

지도학습 지역:

```text
광장·공원
├─ CCTV 1
└─ CCTV 2
├─ CCTV 3
└─ CCTV 4
└─ CCTV 5
```

Map Size:

```text
Plaza & Park
= 96×56

```

상세 규칙:
- `docs/modules/machine_learning/supervised/supervised_learning_rules.md`

Map:
- `docs/shared/maps/map_plaza_park_spec.md`
- `docs/shared/maps/map_shopping_district_spec.md`
- `docs/shared/maps/map_residential_spec.md`

### 비지도학습

CCTV Snapshot의 캐릭터를 홀로그램으로 분석하고,
Feature Dial 설정에 따라 Cluster가 merge / split되는 경험을 제공한다.

상세:
- `docs/modules/machine_learning/unsupervised/concept_rules.md`

### 강화학습

5개의 독립 Simulation Instance에서
사용자가 보상 / 벌점 중요도를 설정하고,
행동 결과가 중앙 AI의 경향에 반영되는 구조다.

상세:
- `docs/modules/machine_learning/reinforcement/concept_rules.md`

---

## 5. Character Asset 현재 방향

기본 Species:

```text
Rabbit
Fox
Tiger
Cat
Dog
```

추후 Species 추가 가능.

현재 1차 Base 제작 단위:

```text
Species별 총 2마리
= Male 1 + Female 1
```

각 Base Character:

```text
Down
Left
Right
Up
```

4방향 이미지를 사용한다.

현재 5 Species의 Male/Female 4방향 Base PNG가 모두 존재한다.

```text
Rabbit / Fox / Tiger / Cat / Dog
= 5 Species × 2 Base × 4 Directions
= 40 Direction Sprites 완료
```

Animation은 전체 Base / Scale 안정화 후 본격 제작한다.

---

## 6. 현재 Scale 기준

```text
Tile
= 32×32

Tiger
= Large
= 80px

General NPC Visual Max
= 96px

Tiger Collision Footprint
= 26×16px

Public Entrance
= 최소 2 tiles / 64px

Bench
= 3×1 tiles / 96×32px
```

Path Width:

```text
2 tiles
= Narrow / Special Path

3 tiles
= Standard Public Walkway

4 tiles
= High-traffic 선택값

5~6 tiles
= Main Route
```

---

## 7. Scale Validation Scene

현재 검증용 `ScaleValidationScene`은 최종 ML Game Scene이 아니다.

주요 기능:
- WASD / 방향키 이동
- 대각선 속도 정규화
- 발 기반 충돌
- 벽 따라 미끄러짐
- Zoom 1.0 / 1.25
- Tiger 72 / 80 / 88 비교
- NPC 12 / 24 / 35 밀도 비교
- Grid / Footprint / Collision / Visual Bounds Debug
- NPC Click Selection
- Door / Wall / Path / Narrow / Object / Density 위치 테스트

Tiger 80px는 Large Species 기준으로 승인되었다.

---

## 8. Historical Corridor Capacity 결과

120초 동일 조건:

| Test | 도착 | 최장 차단 | 결과 |
|---|---:|---:|---|
| 2 tiles Large | 0 | 117.02s | FAIL — 교착 |
| 3 tiles Large | 34 | 0.75s | PASS |
| 3 tiles Mixed | 65 | 1.52s | 흐름 PASS / 시각 WARN |
| 4 tiles Mixed | 64 | 2.48s | 흐름 PASS / 시각 WARN |

검사 결과는 실행 시점에 달라지는 숫자를 이 문서에 고정하지 않는다.
현재 상태와 최신 validation 경로는 `docs/README.md`를 기준으로 확인한다.

3 / 4 tile Mixed에서 몸통 시각 겹침이 남아 있다.

향후:
- Side-step
- Personal spacing
- Short avoidance

에서 보정한다.

장시간 실행 시 일부 FPS 저하와 Bundle Size Warning도 계속 관찰한다.

상세:
- `docs/validation/general/corridor_capacity_results.md`
- `docs/validation/general/scale_validation_results.md`

---

## 9. 현재 구현 단계

Plaza/Park movement/navigation foundation은 완료됐다.

```text
Map v2 + Navigation v2 + movement foundation = COMPLETE
old CCTV1/CCTV2 MANUAL_LABELING = historical technical baseline COMPLETE
Current design = PLAZA_CAM_A~E + RoundScenario
               → Round 1/2 each 35 NPC, 28 Citizen / 7 Villain
               → Round 1 manual target ≈ 8 distinct Characters
Next = 35-NPC Round 1/Round 2 Scenario Assignment audit/design
```

Shopping District와 Residential의 실제 runtime route는 아직 구현하지 않는다.

이미 확정된 Map Size / Path Width와 target/current camera namespace 분리를 구현 과정에서 임의로 변경하지 않는다.

---

## 10. AI 작업 원칙

AI / Codex 작업 시:

```text
1. ai/RULES.md
2. ai/WORKFLOW.md
3. ai/CONTEXT_MAP.md
```

를 우선 확인한다.

모든 문서를 한 번에 넣지 않고
현재 작업에 필요한 Source of Truth만 선택한다.

중요한 미확정 설계:

```text
검토
→ 사용자 승인
→ 구현
```

순서를 따른다.

현재 상태 복구:
- `docs/archive/session_handoff_plaza_park_2026-09-14.md`

전체 문서 인덱스:
- `docs/README.md`
