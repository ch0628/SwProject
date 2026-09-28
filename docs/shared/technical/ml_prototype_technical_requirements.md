# ML 프로토타입 기술 요구사항 v2

## 1. 목표 플랫폼

- PC / 노트북 웹 브라우저 우선
- 모바일은 현재 프로토타입 지원 대상에서 제외
- 기본 화면 방향은 Landscape
- 기준 해상도는 1920×1080급 PC 화면을 중심으로 설계
- 핵심 입력은 마우스 중심으로 설계

---

## 2. 확정 기술 스택

현재 프로토타입 기술 스택은 다음으로 확정한다.

```text
Frontend / UI
= React + TypeScript + Vite

Game / World Rendering
= Phaser 4

Map Authoring
= Tiled

Tilemap
= Orthogonal

Tile Size
= 32×32 px
```

역할 분리:

```text
React
→ UI
→ Dialogue
→ Tutorial
→ Report
→ Stage-level panels

Phaser
→ World
→ Map
→ Character
→ Camera
→ Collision / Navigation
→ Real-time Simulation
```

Full 3D는 사용하지 않는다.

---

## 3. 그래픽 방향

- top-down 2.5D
- Pixel Art 기반
- Orthogonal Tilemap
- 귀여운 의인화 동물 도시
- 즉각적인 피드백과 명확한 상태 변화를 우선
- 사실적 3D 표현보다 Character / Behavior 가독성을 우선

Character 공통 원칙:

```text
4 directions
= Down / Left / Right / Up

Anchor
= Bottom Center

Depth
= feet Y

Visual Sprite
!=
Collision Footprint
```

Tiger는 Large Species의 Scale 기준으로 사용하며
현재 승인된 기본 Visual Height는 **80px**이다.

일반 NPC Visual Height 상한은 **96px**이다.

---

## 4. 성능 목표

- 일반 PC / 노트북 Chrome 계열 브라우저에서 핵심 플레이 60fps 목표
- 일반 플레이에서 약 30~50개의 동적 캐릭터 / 홀로그램 처리
- 지도학습 광장·공원 / 상점가의 Character Pool은 약 30~35명 수준
- 주거지역은 약 25~30 NPC 수준의 낮은 체감 밀도
- Final Scan의 수백 명 표현은 모든 개체에 복잡한 AI / 로직을 적용하지 않고 시각적 연출로 규모감을 표현
- 강화학습 5개 Simulation은 모두 Full Render하지 않고 Main View + Status + Overview 구조 사용

장시간 실행 시 FPS 저하 여부는 계속 관찰한다.

---

## 5. Map / Scale 기술 기준

### 5.1 Tile / Path

```text
Tile
= 32×32

2 tiles
= Narrow / Special Path

3 tiles
= Standard Public Walkway

4 tiles
= High-traffic Walkway 선택값

5~6 tiles
= Main Route / 넓은 접근로
```

Corridor Capacity 검증 결과:
- 2-tile Large 양방향 교행은 교착 발생
- 3-tile Large / Mixed는 흐름 PASS
- 4-tile Mixed가 3-tile보다 명확한 우위를 보이지 않음
- 3 / 4 tile 모두 일부 시각적 몸통 겹침 WARN 존재

따라서 몸통 겹침은 통로 폭을 무조건 늘리기보다
향후 NPC Side-step / Personal Spacing / Short Avoidance에서 보정한다.

### 5.2 Public Entrance

```text
공공 출입구
= 최소 2 tiles / 64px
```

1-tile 입구는 일반 공공 출입구로 사용하지 않고
특수 / 제한 접근이 필요한 경우에만 검토한다.

### 5.3 Bench

```text
Public Bench
= 3×1 tiles
= 96×32 px
```

---

## 6. 지도학습

### 6.1 CCTV / Map 구조

Target Full-Game Architecture:

```text
광장·공원
├─ CCTV 1
└─ CCTV 2

상점가
├─ CCTV 3
└─ CCTV 4

주거지역
└─ CCTV 5
```

위 `CCTV1~5`는 향후 3-Zone global namespace다.

Current Playable Prototype Profile:

```text
Map = public/maps/plaza-park-v2.tmj
Observation zones = PLAZA_CAM_A / B / C / D / E
```

`PLAZA_CAM_A~E`를 global `CCTV1~5`와 같은 namespace나 1:1 의미로 사용하지 않는다. 실제 geometry는 TMJ와 `docs/map_plaza_park_spec.md`를 따른다.

Map Size:

```text
Plaza & Park
= 96×56

Shopping District
= 96×50

Residential Area
= 84×52
```

각 Map의 실제 좌표 / Object / Waypoint는 전용 Map Spec을 따른다.

### 6.2 Interaction / State

- Round 1/2 population은 각각 35 NPC, 28 Citizen / 7 Villain
- 35 Character Pool은 visual/identity pool이며 실제 역할은 Round별 `RoundCharacterAssignment`가 결정
- `homeObservationZone`은 Round별 소속이고 현재 visible observation zone과 분리
- observation zone별 visible count 자동 balancing 없음
- Plaza/Park deterministic movement validation은 15 active NPC까지 PASS했으나 최종 gameplay 수치는 아님
- 캐릭터는 시간에 따라 이동 가능
- Character behavior history 유지
- 사용자 Label / AI Label / Verified Label 구분
- Tracking Review 지원
- 같은 Round 안의 camera/Game State 전환은 world와 NPC runtime을 reset하지 않음
- Round 1 → Round 2는 Map을 reload하지 않는 `Scenario Round Reset` 적용
- Final Scan은 수백 명처럼 보이도록 연출하되 실제 고비용 객체 수는 제한

---

## 7. 비지도학습

- 한 번의 분석 Snapshot에 홀로그램 약 45~50명
- Feature Dial 변경에 따라 군집 결과 재계산
- 플랫폼 merge / split / 이동 연출
- 중앙 애매 영역 지원
- 동일 캐릭터가 여러 그룹에 비슷하게 가까운 상태 표현 가능
- 지도학습 Character Sprite를 재사용하고 Hologram Effect 중심으로 표현

---

## 8. 강화학습

- 5층 건물
- 약 20~25개 이상의 유효 경로가 선택 조합으로 형성
- 중앙 AI 1개
- 병렬 연습 Simulation 5개
- 20 Round, 총 100회 경험
- 각 Simulation은 동일한 건물 Template과 기본 환경 조건 사용
- 각 연습 로봇은 다른 로봇의 물리적 영향 없이 독립적으로 행동
- Round 종료 후 5개 경험을 중앙 AI에 합쳐 다음 행동 선택 경향을 변경

### 강화학습 화면 구조

- Main View: 선택된 Simulation 1개 실제 렌더링
- Mini View / Status: 나머지 Simulation의 층, 위치, 행동, 결과 요약
- Overview: 5개 Simulation의 위치와 경로를 하나의 건물 지도 위에 합성
- 동일 위치의 로봇은 offset / 묶음 표시 / 경로선 분리 등으로 겹침 방지
- 사용자가 특정 로봇 Follow 중이면 다른 이벤트로 강제 화면 전환 금지

---

## 9. 물리 / 충돌

- 무거운 범용 물리엔진 의존은 최소화
- 필요한 충돌과 이동은 대부분 게임 규칙 기반으로 처리
- Character의 Visual Bounds와 Collision Footprint를 분리
- Large Species는 벽 / 건물 / 통로 경계에서 별도 접근 여유를 적용 가능
- NPC끼리 통과하지 않도록 함
- 막힌 NPC는 대기 후 흐름이 풀리면 이동 재개
- 강화학습 병렬 로봇끼리는 서로 충돌하지 않음
- 환경, 장애물, 시민과의 상호작용만 각 Simulation 안에서 처리
- 실제 물리엔진이 필요한 요소가 확인될 경우 해당 기능에 한정해 도입 검토

---

## 10. 실시간 Simulation

- 지도학습 캐릭터 이동과 행동 변화는 실시간 진행
- 같은 Round 안의 Game State 전환은 세계를 reset하지 않고 runtime을 지속
- Round 전환에서는 actualLabel/homeObservationZone/lifecycle/behavior/route 재배정 가능, user/AI/verified label과 selection/reservation 초기화
- behavior history는 Round별로 분리
- NPC 이동은 완전 무작위 Pixel 이동보다 Semantic Waypoint / Behavior Point 기반을 우선

---

## 11. 스테이지 간 상태

- 스토리는 지도 → 비지도 → 강화로 연결
- Simulation State는 스테이지별 독립
- 필요한 경우 characterId, 사건 결과, 스토리 플래그 정도만 전달
- 한 스테이지의 전체 위치 / 행동 State를 다음 스테이지까지 지속하지 않음

---

## 12. 저장

- 프로토타입에서는 세션 내 진행 유지
- 로그인, 계정 DB, 클라우드 저장 제외

---

## 13. 오디오

- 효과음 필수
- BGM 후순위
- Lock-on, 군집 이동, 경보, 성공/실패, 강화학습 이벤트 등 즉각 피드백용 효과음 우선

---

## 14. Cutscene

- 게임 에셋을 재사용하는 Scripted Cutscene 방식
- 대용량 사전 렌더링 영상은 지양
- 지도학습 Tracking Review는 초기 프로토타입에서 텍스트 / 간단한 재연부터 시작 가능

---

## 15. 입력

- 현재 프로토타입은 PC / 노트북 대상
- 마우스 입력 우선
- Hover만으로 핵심 기능이 성립하지 않도록 설계
- 클릭 / 드래그 / 휠 등 일반 PC 입력 중심
- 모바일 / 터치 대응은 현재 범위에서 제외

---

## 16. 네트워크

- 핵심 게임 플레이는 서버 없이 브라우저에서 동작 가능해야 함
- 네트워크 장애가 핵심 학습 체험을 막지 않도록 함

---

## 17. ML 구현

- 실제 지도학습 / 군집 모델 / RL 모델을 브라우저에서 학습시키는 것이 목적이 아님
- 교육 목표에 맞는 규칙 기반 Simulation으로 각 학습 방식의 핵심 인과관계를 재현
- 결과는 사전 애니메이션 순차 재생이 아니라 사용자 입력과 내부 상태에 따라 실제로 달라져야 함

---

## 18. Character Asset 현재 기준

기본 Species:

```text
Rabbit
Fox
Tiger
Cat
Dog
```

추후 Species 추가 가능.

현재 Base Character 정책:

```text
Species별 총 2마리
= Male 1 + Female 1
```

즉 `Male 2 + Female 2`가 아니다.

각 Base Character는 4방향 기준 이미지를 가진다.

```text
Down
Left
Right
Up
```

Animation의 정확한 Frame 수 / FPS와 최종 Sprite Sheet Packing은 아직 고정하지 않는다.

---

## 19. 현재 Map Source of Truth

```text
docs/reference/map_visual_reference.md
docs/map_plaza_park_spec.md
docs/map_shopping_district_spec.md
docs/map_residential_spec.md
```

Scale / Corridor 검증:

```text
docs/map_scale_validation_spec.md
docs/validation/general/scale_validation_results.md
docs/validation/general/corridor_capacity_results.md
```

---

## 20. 아직 미확정

다음은 실제 구현 / 테스트 단계에서 결정한다.

- 상태 관리 라이브러리 또는 구체적 State 저장 구현 방식
- 각 Animation의 정확한 Frame 수
- Animation FPS
- 최종 Sprite Sheet Packing 방식
- 행동 Pool의 세부 확률 / Timing
- 군집 계산 방식의 구체 구현
- 강화학습 보상 계산식
- Cutscene / Dialogue 데이터 구조
- NPC Side-step / Personal Spacing의 구체 알고리즘
- 환경 Asset 최종 TileSet Packing 규칙
- 강화학습 5층 건물의 실제 Tiled Layout

이미 확정된 React / Vite / TypeScript / Phaser 4 / Tiled / 32×32 / 4방향 / top-down 2.5D는 미확정 항목으로 되돌리지 않는다.

---

## 21. 현재 구현 상태와 다음 단계

Plaza/Park는 Map v2, Navigation v2, 35 Character Pool, semantic/Dijkstra runtime,
two-way lane, junction continuity, Stop Point reservation/defer와
5~15 NPC deterministic concurrency validation까지 완료했다.

old CCTV1/CCTV2 `MANUAL_LABELING` technical baseline은 구현·검증 완료했다.

Current design은 `PLAZA_CAM_A~E`, Round 1/2 각 35 NPC·28:7, persistent gameplay lifecycle, Round 1 manual target 약 8이다.
5-camera loader, Round 1 `RoundScenario`, authored Scenario Point binding과 persistent lifecycle은 구현·검증 완료됐다.
`userLabel`은 verification 전 `verifiedLabel`로 승격되지 않는다. 다음 단계는 `FIRST_TRAINING` verification
interaction 설계이며, FIRST_TRAINING 이후 flow와 Round 2는 아직 구현되지 않았다.
