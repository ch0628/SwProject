# Reinforcement Navigation Spatial Blockout Rebuild

## 상태

`PASS_FOR_SCENARIO`

## 범위

승인된 `navigation_design_v1.md`의 Navigation topology를 변경하지 않고 기존 설명형 Blockout과 별도로 공간 구조 중심 산출물을 생성했다.

변경하지 않은 항목:

- Elevator 없음
- 1F 중앙 시작 → 좌우 계단
- 2F 좌우 도착 → 중앙 계단 수렴
- 3F 중앙 도착 → 좌우 계단 분기
- 4F 좌우 도착 → 중앙 계단 수렴
- 5F 중앙 Search Hub, 네 Search Room, 고정 중앙 Control Room
- 일반 Villain / Boss Search 배치 논리
- Node, Edge, Route Context 및 Complete Path 수
- Learning Engine, Reward, Encounter probability

## 이전 Blockout과 달라진 점

기존 파일은 Node box, 연결선, 큰 제목과 설명을 중심으로 Navigation 논리를 검토하는 다이어그램이었다.

새 Spatial Blockout은 다음 요소를 우선한다.

- 진한 wall mass에서 실제 walkable floor를 carve-out한 top-down floorplan
- 별도 room, corridor, choke point, stair footprint
- route split / merge를 선이 아니라 통로 geometry로 표현
- 작은 room/stair label과 최소한의 encounter marker만 사용
- 화살표, legend, route arc, node box 제거

Clean Structure 파일은 같은 geometry에서 모든 text와 encounter marker를 제거했다.

## Floor별 구조

### 1F

- 중앙 Entry Lobby를 기준으로 좌측 Public Evacuation Hall과 우측 Service Corridor가 분리된다.
- 좌측은 넓고 직접적인 공개 공간이다.
- 우측은 길고 좁은 service spine과 구조적 obstacle pocket을 가진다.
- 좌우 Stair footprint가 서로 다른 끝점에 있고 Stair Guard는 없다.

### 2F

- 좌우 Arrival Stair가 서로 다른 위치에 있다.
- 각 Arrival에서 짧은 내부 Route와 긴 외곽 Route가 공간적으로 분리된다.
- 네 접근 통로는 중앙 vestibule로 수렴한다.
- 중앙 Stair 앞에는 Villain ×2 Encounter를 위한 단일 choke point가 있으며 별도 bypass corridor가 없다.

### 3F

- 중앙 Arrival에서 좌측 Maintenance Route와 우측 Perimeter Route가 갈라진다.
- 좌측은 짧고 좁으며 wall/obstacle mass가 통로를 제한한다.
- 우측은 건물 외곽을 따라 도는 긴 Route다.
- 좌우 Stair 앞에 각각 Villain ×2 Guard Bay가 있다.

### 4F

- 좌우 Arrival마다 짧은 Security Route와 긴 Perimeter/Service Route가 존재한다.
- 접근 Route는 중앙 Security vestibule과 Stair choke point로 수렴한다.
- 중앙 Stair 앞에 Villain ×2 Encounter 공간이 있다.

### 5F

- 하단 중앙 Search Hub에서 좌우 Wing으로 재진입할 수 있다.
- L1/L2와 R1/R2는 네 개의 독립된 side Search Room이다.
- 각 Room 앞에 Guard vestibule 공간이 있다.
- Control Room은 side room과 분리된 상단 중앙 고정 공간이다.
- Search Wing과 중앙 Hall은 Hub로 연결되며, 중앙 Control Room 접근부에는 Security Lock footprint가 있다.
- Boss 위치를 나타내는 geometry나 marker는 포함하지 않았다.

## Clean SVG / PNG 생성 방식

`scripts/reinforcement/generateNavigationSpatialBlockouts.mjs`의 단일 vector geometry model을 사용했다.

```text
vector geometry model
├─ spatial SVG serializer → floor_N_blockout_spatial.svg
├─ annotation-free SVG serializer → floor_N_structure_clean.svg
└─ RGBA rasterizer + PNG encoder → floor_N_structure_clean.png
```

PNG는 Node.js 표준 라이브러리만 사용해 실제 RGBA pixel buffer로 rasterize하고 PNG chunk로 encode한다. 확장자 변경이나 SVG binary 복사는 사용하지 않는다.

출력 크기:

```text
SVG viewBox: 1600 × 900
PNG: 2560 × 1440
Aspect ratio: 16:9
```

## Validation

- Clean SVG의 `text`, `title`, `desc`, legend, arrow, node/route annotation 부재 검사
- Spatial SVG의 arrow, legend, node/route annotation 부재 검사
- Spatial label 최대 크기 22px 검사
- PNG signature / IHDR 검사
- PNG width `2560`, height `1440` 검사
- 기존 Graph Node count `[5, 8, 7, 8, 15]` 유지 검사
- 기존 Graph Edge count `[4, 9, 6, 9, 21]` 유지 검사
- Vertical Stair Connection `6` 유지 검사
- 기존 `validateNavigationGraph.mjs` PASS
- SVG XML parsing PASS
- Clean PNG 5장 시각 검토 PASS

## 미확정으로 유지한 항목

- 최종 방 크기와 복도 폭
- Collision Polygon
- Pixel Art와 props
- 실제 runtime coordinate scaling
- Action 성공률과 timeCost
- Reward / Mission Bonus 세부식
- Encounter probability
- Boss 위치와 Boss Encounter 수치

이 파일들은 Scenario 구조 레퍼런스이며 Production Map 또는 Collision source가 아니다.
