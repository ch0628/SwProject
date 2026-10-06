# Navigation Blockout Rebuild Report v2

## 1. 목적과 범위

이 작업은 기존 navigation topology와 Learning Engine의 층별 의도를 유지하면서, Scenario 구조 참조에 적합한 1F~5F 건축형 blockout을 별도 `navigation_v2` 세트로 재구축한 것이다. 기존 v1 파일과 `module_spec_v3.md`, `learning_engine_v1.md`, `session_handoff_v3.md`는 수정하지 않았다.

산출물은 최종 pixel art가 아니라 단일 층 top-down/2.5D 제작을 위한 구조 참조다. 시민, 악당, 장애물 등 runtime entity는 포함하지 않는다.

## 2. v1의 문제

기존 v1은 navigation 선택지를 빠르게 확인하는 도식으로는 유효했지만 Scenario 구조 참조로는 다음 문제가 있었다.

- 보행 영역과 비보행 영역이 큰 추상 도형으로 단순화되어 실제 방·복도·벽의 관계가 약했다.
- 어두운 영역이 건물 외부, 벽체, 빈 공간을 충분히 구분하지 않아 cutaway, void, 아래층 노출로 오해될 수 있었다.
- 실 경계, 벽 두께, landing, service recess, structural mass 같은 건축 단서가 부족했다.
- 일부 층은 큰 오픈 공간 또는 단순 분기 다이어그램처럼 읽혀 층별 공간 성격이 약했다.

## 3. v2 설계 원칙

- 모든 이미지는 한 층만 보여 주는 2560×1440, 16:9 top-down 평면으로 구성했다.
- 진한 외곽 배경은 건물 외부, 중간 회색은 연속된 건물 벽체·고정 구조물, 밝은 면은 보행 가능한 실·복도·landing으로 분리했다.
- wall thickness, room boundary, corridor corner, alcove, service recess, stair landing, structural bay를 추가했다.
- 검은 내부 덩어리를 사용하지 않고, 막힌 구조 mass는 외벽과 같은 계열의 중간 회색으로 표현했다.
- clean 버전에서는 층별 의미 색, 텍스트, 범례, 화살표, 노드 라벨을 제거했다.
- spatial 버전도 텍스트 없이 geometry를 유지하되, 서로 다른 route/zone을 옅은 색조로 구분해 사람이 topology를 확인할 수 있게 했다.
- spatial과 clean은 동일한 geometry model에서 출력해 구조 차이가 생기지 않도록 했다.

## 4. 층별 구조

### 1F — public entrance / evacuation

중앙 하단 entrance와 reception landing에서 좌·우 route가 갈라진다. 좌측은 짧은 public lobby와 소규모 공개실을 거쳐 좌상단 stair로 연결된다. 우측은 긴 service corridor, service room, recess를 거쳐 우상단 stair로 연결된다. 중앙에는 두 route를 시각적·공간적으로 분리하는 두꺼운 room/structural core를 배치해 하나의 오픈 로비처럼 보이지 않게 했다.

### 2F — four approaches / central convergence

좌하단·우하단 stair arrival 각각에서 내부형과 외곽형 두 접근로가 나온다. 사무실과 기술실 cluster 사이를 통과한 네 approach가 상단 중앙의 넓은 convergence zone과 3F stair landing으로 모인다. 중앙의 고정 구조 core는 빈 공간이 아니라 벽체에 둘러싸인 built mass로 처리했다.

### 3F — maintenance risk / perimeter safety

중앙 하단 arrival에서 좌측 짧은 maintenance route와 우측 긴 perimeter route로 갈라진다. 좌측은 좁은 service room cluster, 꺾임, baffle을 통해 짧고 압박감 있게 만들었고, 우측은 외곽을 크게 우회하는 연속 corridor로 길고 안전한 성격을 암시했다. 두 route는 각각 좌상단·우상단 stair로 연결된다.

### 4F — security approaches / choke point

좌하단·우하단 arrival에서 각각 두 접근로가 시작된다. 밀도 높은 보안실·제어실 cluster와 외곽 우회 corridor를 통과한 네 route가 중앙 security vestibule, gate, 두 guard booth가 있는 choke point로 수렴한 뒤 상단 중앙 stair로 연결된다.

### 5F — search hub / four rooms / fixed control room

중앙 하단 arrival에서 중앙 search hub로 진입하고 좌·우 wing으로 갈라진다. 각 wing에는 독립된 두 search room이 있어 L1, L2, R1, R2의 네 탐색 공간이 명확히 분리된다. 중앙 상단 control room은 별도 고정실이며, hub와 security gate를 통해 연결된다. Boss는 배경에 고정하지 않고 기존 seeded runtime search 의미를 유지한다.

## 5. Topology 유지 여부

`navigation_graph_v1.json`은 수정하지 않았다. v2 geometry는 다음 navigation contract를 유지한다.

| Floor | 유지한 핵심 구조 |
|---|---|
| 1F | 중앙 entrance, 좌/우 2 route, 좌/우 stair |
| 2F | 좌/우 arrival, arrival별 2 approach, 중앙 수렴, 상단 중앙 stair |
| 3F | 중앙 arrival, 짧은 위험 route, 긴 안전 route, 좌/우 stair |
| 4F | 좌/우 arrival, arrival별 2 approach, security choke 수렴, 중앙 stair |
| 5F | 중앙 hub, 좌/우 wing, 4 search room, 별도 control room |

원본 graph의 노드·edge·stairs·path 계산은 그대로이며 기존 validator 기준 64개의 구조적 `START -> GOAL` 경로가 유지된다. v2 SVG/PNG는 graph 파일을 대체하는 새 runtime navigation graph가 아니라 그 의미를 공간적으로 표현한 제작 참조다.

## 6. Scenario reference 적합성

- 층 전체를 둘러싼 연속된 building envelope가 있어 떠 있는 플랫폼이나 cutaway로 읽힐 가능성을 낮췄다.
- 밝은 보행면이 실과 corridor로 연속되며, 중간 회색 wall mass가 그 사이를 실제 구조물처럼 채운다.
- stair는 보행 가능한 landing과 반복 tread로 표현해 vertical transition footprint가 명확하다.
- room cluster와 corridor가 navigation choice를 건축적으로 설명하므로 추상 노드 다이어그램보다 생성 모델이 실제 평면으로 해석하기 쉽다.
- clean SVG에는 text, legend, arrow, node/edge metadata 또는 runtime entity가 없다.

## 7. 검증

`scripts/reinforcement/validateNavigationBlockoutV2.mjs`는 다음을 검사한다.

- 5개 층, spatial/clean SVG·PNG 총 20개 export의 존재 및 중복/누락
- 층별 tagged walkable geometry 연결성
- 정의된 route sequence의 geometry 연속성
- stair 개수와 상·하·좌·우 위치 제약
- 2F·4F의 중앙 convergence 일관성
- 5F search room 4개와 control room 1개, hub 경유 구조
- clean SVG의 금지 요소와 색상 규칙
- spatial/clean SVG primitive 수 일치
- PNG signature, 2560×1440 크기, RGBA color type

최종 결과:

```text
PASS navigation blockout v2
floors=5 exports=20 png=2560x1440 RGBA
stairs=2/3/3/3/1 routes=2/4/2/4/5
walkableContinuity=PASS routeConvergence=PASS searchRooms=4 controlRooms=1
```

기존 navigation graph validator도 별도로 실행해 graph contract가 변경되지 않았음을 확인한다.

## 8. 남은 미확정 사항

- v2는 Scenario용 구조 참조이므로 실제 runtime collider/navmesh 좌표와의 1:1 pixel mapping은 아직 정의하지 않았다.
- 문 폭, corridor 폭, 캐릭터 footprint, 카메라 crop은 최종 Scenario 시안과 실제 플레이 해상도에서 재확인해야 한다.
- 보안 gate와 계단 tread는 건축 단서일 뿐 별도 runtime obstacle/entity가 아니다.
- 첫 Scenario 재생성 결과에서 cutaway나 void 해석이 다시 나타나면 팔레트 대비와 wall mass 두께를 조정해야 한다. topology 변경은 필요하지 않다.

## 9. 판단

**PASS_FOR_SCENARIO_RETRY**

v2는 기존 navigation semantics를 유지하면서 v1의 추상 도식성을 줄이고, 각 층을 연속된 건물 envelope 안의 방·복도·벽·landing 구조로 재구성했다. 다음 단계는 clean v2 PNG를 structure reference로 사용한 Scenario 재시도와 결과 비교다.
