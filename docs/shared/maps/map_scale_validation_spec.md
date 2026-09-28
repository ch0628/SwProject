# Map Scale Validation Specification

## 1. 문서 목적

이 문서는 SWfestival 프로토타입의 **맵 스케일 검증 기준**을 정의한다.

현재 단계의 목적은 최종 맵을 제작하는 것이 아니라,
`32×32 tile` 환경에서 캐릭터 크기, 통로 폭, 출입구 크기, 오브젝트 비율, 카메라 스케일이 자연스러운지 검증하는 것이다.

검증 대상:
- Tiger 기준 캐릭터
- 기본 Tile Scale
- 공공 공간의 최소 이동 폭
- 큰 Species까지 고려한 공통 이동 규격
- Phaser에서의 카메라 및 Depth / Collision 동작
- CCTV 화면에서의 NPC 밀도

이 문서에서 확정된 값과 검증용 후보값을 구분한다.

---

# 2. 고정 기술 조건

## 플랫폼
- PC / 노트북 웹
- Landscape
- 기준 화면: 1920×1080

## 렌더링 / 게임 스타일
- top-down 2.5D
- pixel-art 기반
- Orthogonal Tilemap
- Phaser 4
- Tiled
- React + TypeScript + Vite

## 성능 목표
- 일반 PC Chrome 계열 브라우저에서 핵심 플레이 60fps 목표

---

# 3. Tile Scale

## 확정

```text
Tile Size = 32 × 32 px
```

맵의 기본 좌표, 통로, 출입구, Object 배치는 이 Tile 단위를 기준으로 한다.

Tile 크기는 현재 Scale Validation의 기준값으로 고정한다.

---

# 4. Species Size Class

Species마다 시각적 Sprite 크기를 다르게 허용한다.

모든 캐릭터를 동일한 높이로 강제하지 않는다.

## Size Class

| Size Class | Visual Height 기준 | 용도 |
|---|---:|---|
| Small | 약 56~64px | 작은 Species |
| Medium | 약 64~72px | 일반 Species |
| Large | 약 72~80px | 큰 Species |
| Oversize | 약 88~96px | 향후 추가할 매우 큰 Species |
| 일반 NPC 최대 | 96px | 일반 이동 NPC 상한 |

정확한 Species별 크기는 실제 Scale Validation 후 확정한다.

---

# 5. Tiger Scale

## 확정

Tiger는 현재 프로젝트에서 **Large Size Class의 상단 기준 Species**로 사용한다.

```text
Tiger Visual Height = 80px
```

Scale Validation 후 Large Species 기준값으로 사용자 승인됨.

의도:
- 호랑이가 비교적 큰 Species라는 느낌을 유지
- 이후 Rabbit / Cat / Dog / Fox 등의 Species 크기 결정 기준으로 사용
- Oversize Species가 추가되더라도 Tiger보다 약간 큰 정도로 제한

Tiger의 실제 Source PNG 크기와 게임 내 표시 크기는 동일 개념이 아니다.

게임에서는 Source Asset을 80px 높이 기준으로 렌더링하여 테스트한다.

---

# 6. 일반 NPC 최대 크기

## 확정

```text
Maximum General NPC Visual Height = 96px
```

96px를 초과하는 캐릭터는 일반 군중 NPC로 사용하지 않는 것을 기본 원칙으로 한다.

96px 초과 캐릭터가 필요한 경우:
- 특별 NPC
- Scripted Cutscene
- 대형 Object성 캐릭터
- 특수 이벤트

등으로 별도 처리한다.

목적:
- 지나치게 큰 Species 하나 때문에 모든 맵 Scale이 비정상적으로 커지는 것을 방지
- 공공 공간 규격을 일정하게 유지
- CCTV와 군중 장면의 가독성 유지

---

# 7. Visual Sprite와 Collision Footprint 분리

캐릭터의 보이는 Sprite 전체를 Collision 영역으로 사용하지 않는다.

## 원칙

```text
Visual Sprite Size ≠ Navigation / Collision Footprint
```

큰 Species의 경우 머리, 어깨, 귀, 꼬리가 넓게 보이더라도
실제 바닥 점유는 발 아래 작은 영역으로 계산한다.

### Tiger 초기 Footprint 후보

32px Tile 기준:

```text
약 24~28px width
약 14~18px height
```

정확한 값은 Phaser Scale Validation에서 조정한다.

후속 검증에서는 Tiger Footprint를 26×16px로 유지한다.
벽/건물 등 고정 구조물에만 별도 Large Navigation / Visual Clearance를 적용한다.
이는 NPC용 Footprint나 Sprite Physics Box 확대가 아니며, 64px 공공 입구 통과를 유지한다.
초기 구현값과 검증 결과는 `docs/validation/general/scale_validation_results.md`의 후속 반영 항목에 기록한다.

## Anchor

```text
Bottom Center
```

캐릭터의 위치 기준은 발 중앙으로 통일한다.

## Depth

캐릭터 앞뒤 정렬은:

```text
발 위치의 Y 좌표
```

를 기준으로 한다.

---

# 8. 공공 공간 설계 원칙

## 핵심 원칙

> 모든 Species가 공통으로 사용하는 공공 공간은,
> 프로젝트가 지원하는 가장 큰 일반 NPC(Size ≤ 96px)가
> 무리 없이 이동할 수 있도록 설계한다.

Species별로 별도 문, 별도 길, 별도 계단을 만들지 않는다.

예:

```text
토끼용 문
호랑이용 문
대형 Species용 문
```

같은 구조는 사용하지 않는다.

대신 공공 시설 자체를 최대 지원 Size Class 기준으로 설계한다.

---

# 9. 출입구 규격

## 공공 출입구

```text
최소 2 tiles
= 64px
```

적용 예:
- 상점 입구
- 관제센터 입구
- 공공 건물
- 주요 시설
- 공용 실내 공간

## 1 Tile Door

```text
1 tile = 32px
```

사용 가능하지만 주요 공공 출입구에는 사용하지 않는다.

사용 예:
- 장식용 문
- 작은 개인 공간
- 특수 통로
- 실제 이동이 필요 없는 Door Object

---

# 10. 보행로 / 통로 규격

## 확정 기본 원칙

### 좁은 특수 통로

```text
2 tiles = 64px
```

사용 예:
- 골목
- 비밀 통로
- 의도적으로 답답한 공간
- Special Event 공간

일반 공공 보행로의 기본값으로 사용하지 않는다.

### 일반 보행로 최소

```text
3 tiles = 96px
```

모든 일반 Species가 사용하는 보행로의 기본 최소값.

목적:
- 큰 Species 이동
- NPC 교행
- CCTV 화면 가독성
- 군중 이동 여유 확보

### 주요 도로 / 광장 / 상점가

```text
4~6 tiles
= 128~192px
```

사용 예:
- 광장 중심부
- 상점가 메인 보행로
- 주요 도로
- 다수 NPC가 동시에 이동하는 공간

---

# 11. 계단 / 엘리베이터 / 복도 규격

공공 건물은 큰 일반 NPC를 기준으로 설계한다.

## 공공 계단

```text
최소 2 tiles
```

## 엘리베이터 입구

```text
최소 2 tiles
```

## 주요 복도

```text
최소 3 tiles
```

강화학습 5층 교통 관제센터도 동일한 공공 공간 원칙을 따른다.

---

# 12. Sprite 겹침과 교행

큰 Sprite끼리 화면상 일부 겹쳐 보이는 것은 허용한다.

중요한 것은 실제 Navigation Footprint가 충돌하지 않는 것이다.

예:

```text
큰 어깨/머리 Sprite 겹침
→ 허용 가능

발밑 Footprint 충돌
→ 실제 이동 충돌 처리
```

이를 통해:
- 큰 Species 두 마리의 교행
- 군중 이동
- 좁은 공간에서의 자연스러운 Depth

를 유지한다.

---

# 13. 문 / Foreground / Occlusion

큰 캐릭터가 문보다 시각적으로 약간 크게 보이는 경우
Sprite 크기를 억지로 줄이지 않는다.

대신:

```text
Foreground / Occlusion Layer
```

를 사용한다.

예:
- 캐릭터가 문 안으로 들어갈 때 문틀 앞부분이 캐릭터 위에 렌더링
- 건물 내부로 들어가는 것처럼 자연스럽게 표현

같은 방식으로 해결한다.

---

# 14. Scale Validation용 Graybox Map

## 검증용 맵 크기

초기 추천:

```text
48 × 32 tiles
```

Pixel 기준:

```text
1536 × 1024 px
```

최종 광장 크기가 아니다.

목적:
- 카메라 이동
- Character Scale
- Object Scale
- 통로 폭
- Depth
- Collision
- NPC 밀도

를 한 Scene에서 검증하기 위함.

---

# 15. Graybox에 포함할 요소

최종 Graphic Asset이 필요하지 않다.

Placeholder Geometry로 제작한다.

필수:

- Open Plaza Area
- 4~6 tile Main Road
- 3 tile Normal Walkway
- 2 tile Narrow Path
- Building
- 2 tile Public Entrance
- 1 tile Test Door
- Tree
- Bench
- Street Lamp
- Fence / Wall
- Tiger Character
- NPC Density Test Area

---

# 16. 기준 Object Scale 후보

현재 값은 최종 Graphic Asset 규격이 아니라 검증용 기준이다.

## Building

```text
약 12 × 8 tiles
```

목적:
- Tiger / Door / Wall Scale 비교

## Bench

```text
96 × 32px = 3 × 1 tiles
```

공원/광장 기본 공공 Bench의 Scale Validation 기준으로 승인됨.

## Street Lamp

바닥 점유:

```text
1 × 1 tile
```

상부 Sprite는 더 크게 표현 가능.

## Tree

Collision Base:

```text
약 1 × 1 tile
```

Visual Sprite:

```text
약 3 × 4 tiles 수준까지 허용
```

캐릭터와 마찬가지로:

```text
Visual Size ≠ Collision Size
```

원칙을 사용한다.

---

# 17. Layer 구조

최종 Map에서도 재사용 가능한 기본 구조로 테스트한다.

## Visible Layer

```text
Ground
Ground_Detail
Object_Base
Characters
Foreground
Roof
Effects
```

## Data / Logic Layer

```text
Collision
Navigation
Spawn
Interaction
Camera_Zone
```

정확한 Tiled Layer Naming은 최종 Map Spec 단계에서 필요 시 조정할 수 있다.

---

# 18. Camera / Resolution

## 기준 Display

```text
1920 × 1080
```

## 초기 Logical Resolution 후보

```text
960 × 540
```

1920×1080 화면에서 2× Display Scale을 사용하는 것을 우선 검토한다.

## Camera Zoom

이전의 1.75 / 2.0 / 2.25 비교 방식은 사용하지 않는다.

Logical Resolution 자체가 이미 화면 Scale을 결정하므로:

```text
Camera Zoom = 1.0
```

부터 시작한다.

필요 시:

```text
1.25
```

등을 추가 비교한다.

최종 Zoom은 Scale Validation 결과를 보고 확정한다.

---

# 19. NPC Density Validation

지도학습 CCTV에서 약 30~35명의 NPC를 보여주는 것을 목표로 한다.

따라서 Scale Test에서는 단계적으로 NPC Placeholder를 배치한다.

```text
12 NPC
↓
24 NPC
↓
35 NPC
```

확인:
- 개별 NPC를 구분할 수 있는가
- 클릭/선택하기 충분한가
- 과도하게 겹치지 않는가
- 이동 공간이 남는가
- CCTV 화면으로 보기 좋은가

35명이 과도하게 밀집되어 보이면
바로 NPC 수를 줄이지 않는다.

먼저:
- Camera Coverage
- CCTV가 보여주는 Map Area
- UI와 World 비율

을 조정한다.

---

# 20. UI 공간을 고려한 Scale Test

Scale Validation은 Full Screen World만 보고 끝내지 않는다.

두 환경을 모두 테스트한다.

## A. Full World Test

```text
1920×1080 대부분을 Game World로 사용
```

목적:
- 순수 World Scale 검증

## B. Actual Gameplay Layout Test

대략:

```text
Game World = 70~80%
UI = 20~30%
```

를 가정한다.

향후 UI:
- CCTV 선택
- Verified Data Count
- AI 상태
- Tracking Review
- Target / Shield UI
- 학습 관련 패널

이 들어와도 Character가 충분히 읽혀야 한다.

---

# 21. Scale Validation PASS 기준

다음 조건을 만족하면 현재 Map Scale을 PASS로 판단한다.

## Character / Object

- Tiger 80px가 문 / 벤치 / 나무와 비교해 자연스러움
- Tiger가 큰 Species로 보이지만 지나치게 압도적이지 않음
- 2-tile 좁은 통로를 통과할 수 있음
- 3-tile 일반 보행로에서 NPC 교행이 자연스러움
- 2-tile Public Entrance 통과가 자연스러움

## Rendering

- Bottom-center Anchor 정상
- Y-depth 정상
- Tree / Door / Foreground Occlusion 정상
- 큰 Sprite가 지나치게 잘리거나 뭉개지지 않음

## Density

- 35명의 Placeholder가 있어도 개별 NPC를 선택할 수 있음
- CCTV로 사용할 수 있는 화면 밀도
- 과도한 Sprite 겹침이 없음

## Camera / UI

- 1920×1080에서 Character가 충분히 읽힘
- Actual Gameplay Layout에서도 NPC 구분 가능
- 필요한 UI 공간을 확보 가능

## Performance

- 일반적인 테스트 장면에서 60fps 목표
- 심각한 Frame Drop이나 Input Lag 없음

---

# 22. WARN 기준

다음은 바로 Scale을 폐기하지 않고 기록 후 다음 테스트에서 확인한다.

- Tiger가 문보다 시각적으로 약간 넓어 보임
- Sprite끼리 어깨/머리가 가끔 겹침
- 2-tile Narrow Path가 상당히 좁게 느껴짐
- 35명 장면에서 일부 겹침 발생
- Camera Zoom 후보에 따라 가독성 차이가 큼
- Character Source Asset의 세부 디테일이 다소 많음

이 경우:
- Collision Footprint
- Camera
- Map Coverage
- Occlusion
등을 먼저 조정한다.

---

# 23. FAIL 기준

다음 문제는 후속 Map 제작 전에 수정한다.

- Tiger 80px가 건물/문과 명백히 비례하지 않음
- 2-tile Public Entrance를 정상 통과할 수 없음
- 3-tile Walkway에서 일반적인 NPC 교행이 불가능
- Bottom-center Anchor가 맞지 않음
- Depth Sorting이 반복적으로 깨짐
- Foreground 뒤로 들어갈 수 없음
- 35명의 NPC를 표시하면 플레이가 불가능할 정도로 혼잡
- 실제 Gameplay Layout에서 캐릭터를 구별하기 어려움
- 60fps 목표에 심각한 문제가 발생

---

# 24. Scale Validation 후 확정할 항목

현재는 아래 항목을 최종 확정하지 않는다.

- Rabbit 실제 표시 높이
- Fox 실제 표시 높이
- Cat 실제 표시 높이
- Dog 실제 표시 높이
- 각 Species 정확한 Collision Footprint
- Camera 최종 Zoom
- CCTV 최종 Coverage
- 실제 광장 크기
- 상점가 크기
- 주거지역 크기
- 관제센터 Floor 크기
- 최종 TileSet

Tiger Scale Validation 결과를 기준으로 확정한다.

---

# 25. Scale Validation 이후 순서

```text
Tiger 4방향 Base Asset
        ↓
Graybox Map
        ↓
Phaser Scale Validation
        ↓
Tile / Camera / Character Scale 확정
        ↓
Tiger Idle / Walk 제작
        ↓
Rabbit / Fox / Cat / Dog 제작 병렬화
        ↓
실제 Map / Level Asset Spec 작성
        ↓
광장 / 상점가 / 주거지역 제작
        ↓
관제센터 5층 설계
```

---

# 26. 현재 확정 요약

```text
Platform
= PC / Laptop Web

Screen
= Landscape

Tile
= 32×32

Tiger
= 80px visual height

General NPC Max
= 96px visual height

Public Entrance
>= 2 tiles

Normal Walkway
>= 3 tiles

Main Road / Plaza
= 4~6 tiles

Narrow Special Path
= 2 tiles

Public Stair
>= 2 tiles

Elevator Entrance
>= 2 tiles

Main Corridor
>= 3 tiles

Character Anchor
= Bottom Center

Depth
= Foot Y

Visual Sprite
!= Collision Footprint
```
