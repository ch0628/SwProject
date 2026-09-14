# SWfestival Residential Area Map Specification

## 1. 문서 목적

이 문서는 지도학습 구역 중 **주거지역(Residential Area)** 맵의 실제 제작 기준을 정의한다.

주거지역은 광장·공원과 상점가보다 낮은 체감 밀도를 가지며,
다음과 같은 생활 행동과 CCTV 관찰을 중심으로 설계한다.

- 귀가 / 외출
- 집 앞 대기
- Mailbox 확인
- 주민 간 짧은 대화
- Narrow Alley 이동
- Rest Area 이용
- Trash / Recycling 이용
- Lamp / Shadow / 외형 상태를 활용한 수상한 분위기 연출
- House / Yard에 Species Habitat Theme 반영
- CCTV 5 한 대를 통한 넓은 주거지역 관찰

이 문서는 이후 Tiled 기반 맵 제작과 Phaser 구현의 Source of Truth로 사용한다.

---

# 2. 프로젝트 공통 고정 조건

- Platform: PC / Laptop Web
- Screen: Landscape
- Rendering: top-down 2.5D
- Art: pixel-art 기반
- Tile Size: 32×32
- Phaser 4 + Tiled
- Tiger Large 기준: 80px
- 일반 NPC 최대 Visual Height: 96px
- Character Anchor: Bottom Center
- Character Depth: Foot Y 기준
- Visual Sprite와 Collision Footprint 분리
- Citizen / Villain 여부는 Species, 위치, 외형, 단일 행동과 1:1로 연결하지 않음
- CCTV를 통해 NPC를 관찰

---

# 3. 맵 전체 크기

## 확정

```text
Map Size = 84 × 52 tiles
Tile Size = 32 × 32 px
World Pixel Size = 2688 × 1664 px
```

좌표 기준:

```text
좌상단 = (0, 0)
우하단 = (83, 51)

X → 오른쪽 증가
Y → 아래쪽 증가
```

전체 맵은 한 화면에 전부 표시하지 않는다.

## 3.1 좌표 / 충돌 해석 규칙

모든 좌표 범위는 양 끝을 포함한다.

```text
House Visual Footprint
= House 외형 범위

House Collision
= House 내부의 비통과 영역
= 2-tile Door Opening만 예외

Yard
= 종족별 Habitat Theme을 표현하는 논리 영역
= Yard 전체가 Collision은 아님

Gate
= Yard Fence의 실제 개구부

Mailbox / Rest / Trash
= Interaction 또는 Prop 영역
= 명시된 접근 Anchor를 막지 않음
```

House Interior Map은 구현하지 않는다.
NPC는 Door Trigger에서 Enter 처리 후 사라지고
일정 시간 뒤 같은 Door 주변에서 다시 등장한다.

각 Yard의 Door ↔ Gate 축은 최소 2-tile의 저밀도 접근로로 비워 둔다.
Habitat Prop은 이 접근축과 Gate를 막지 않는다.

---

# 4. 전체 구조

주거지역은 다음 공간으로 구성한다.

```text
1. North House Row
2. North Yard Row
3. North Walkway
4. Main Residential Street
5. South Walkway
6. South Yard Row
7. South House Row
8. Narrow Alley ×2
9. Neighborhood Rest Area
10. Trash / Recycling Zone
11. Mailbox Points
12. Lamp / Shadow Points
13. West / East Exit
14. South Entry
15. CCTV 5 Coverage
```

---

# 5. Main Residential Street

주거지역의 중심 생활도로.

```text
Main Residential Street
X = 0 ~ 83
Y = 23 ~ 27

Width = 5 tiles
```

주요 행동:

- Walk
- Talk
- Wait
- Leave Home
- Return Home
- Carry Bag
- Look Around
- Lamp 아래 잠깐 정지

차량 시스템은 구현하지 않는다.

---

# 6. North / South Walkway

## North Walkway

```text
X = 0 ~ 83
Y = 18 ~ 20

Width = 3 tiles
```

## South Walkway

```text
X = 0 ~ 83
Y = 30 ~ 32

Width = 3 tiles
```

역할:

- House / Yard 접근
- Mailbox 접근
- Alley 진입
- Wait / Talk
- 귀가 / 외출 동선

---

# 7. House / Yard 공통 원칙

주거지역에는 총 6채의 House를 배치한다.

```text
North
House A / B / C

South
House D / E / F
```

중요 원칙:

> House 자체는 2~3개의 Base Type을 재사용하고,
> Species 차이는 Yard Habitat Theme 중심으로 표현한다.

즉:

```text
House Appearance
= Reusable House Base
+ Species Habitat Yard Kit
+ Yard Layout Variant
```

Species Habitat Theme는 도시 주택의 외부 공간에
야생 서식환경 또는 동물원 환경풍부화 요소를 연상시키는 방식으로 적용한다.

실제 동물 우리처럼 만들지 않는다.

---

# 8. Species Habitat Theme

현재 기본 Species:

```text
Rabbit
Fox
Tiger
Cat
Dog
```

추후 Species 추가 가능성을 고려한다.

---

## 8.1 Rabbit Theme

주요 요소:

```text
- 낮은 Grass
- Flower Patch
- 낮은 Bush
- 작은 흙언덕
- Burrow Entrance 모티프
- 낮은 Fence
```

Burrow Entrance는 Decoration으로 사용 가능하며
실제 Interior를 만들 필요는 없다.

---

## 8.2 Fox Theme

주요 요소:

```text
- Shrub / Bush
- Log
- Rock
- 약간 굽은 작은 Yard Path
- 그늘진 Corner
```

CCTV 시야를 과도하게 막지 않는 수준으로 사용한다.

---

## 8.3 Tiger Theme

주요 요소:

```text
- Tall Grass Patch
- 큰 Log
- Rock
- 작은 Water Feature
- 상대적으로 열린 Yard
```

Water Feature는 Decoration 중심으로 처리한다.

---

## 8.4 Cat Theme

주요 요소:

```text
- 낮은 Raised Perch
- 작은 Platform
- 햇볕 드는 Open Spot
- Planter
- 좁은 장식 통로
```

실제 Jump System은 필수 아님.

---

## 8.5 Dog Theme

주요 요소:

```text
- 열린 Grass Yard
- Shade
- 활동 공간
- 작은 놀이 / 운동 소품
- Water Bowl 계열 Decoration
```

Dog Theme는 활동적인 외부 공간을 강조한다.

---

# 9. House A~F Species 배정

현재 기본 배정:

```text
House A = Rabbit
House B = Fox
House C = Tiger
House D = Cat
House E = Dog
House F = Species Variant Slot
```

House F는 현재 5종 중 하나를 중복 배정하되
같은 Species의 두 번째 Yard Variant를 보여주는 용도로 사용한다.

예:

```text
House F = Cat Variant 2
```

또는:

```text
House F = Rabbit Variant 2
```

중요:

> 같은 Species라고 모든 House / Yard가 완전히 동일하지 않다.

---

# 10. North Row 좌표

## House A — Rabbit

### House

```text
X = 7 ~ 17
Y = 4 ~ 10
```

### Yard

```text
X = 3 ~ 21
Y = 11 ~ 17
```

### Gate

```text
X = 11 ~ 12
Y = 17
```

### Mailbox

```text
X = 9 ~ 10
Y = 16
```

---

## House B — Fox

### House

```text
X = 35 ~ 45
Y = 4 ~ 10
```

### Yard

```text
X = 31 ~ 49
Y = 11 ~ 17
```

### Gate

```text
X = 39 ~ 40
Y = 17
```

### Mailbox

```text
X = 37 ~ 38
Y = 16
```

---

## House C — Tiger

### House

```text
X = 63 ~ 73
Y = 4 ~ 10
```

### Yard

```text
X = 59 ~ 77
Y = 11 ~ 17
```

### Gate

```text
X = 67 ~ 68
Y = 17
```

### Mailbox

```text
X = 65 ~ 66
Y = 16
```

---

# 11. South Row 좌표

## House D — Cat

### Yard

```text
X = 3 ~ 21
Y = 33 ~ 40
```

### House

```text
X = 7 ~ 17
Y = 41 ~ 47
```

### Gate

```text
X = 11 ~ 12
Y = 33
```

### Mailbox

```text
X = 9 ~ 10
Y = 34
```

---

## House E — Dog

### Yard

```text
X = 31 ~ 49
Y = 33 ~ 40
```

### House

```text
X = 35 ~ 45
Y = 41 ~ 47
```

### Gate

```text
X = 39 ~ 40
Y = 33
```

### Mailbox

```text
X = 37 ~ 38
Y = 34
```

---

## House F — Variant Slot

### Yard

```text
X = 59 ~ 77
Y = 33 ~ 40
```

### House

```text
X = 63 ~ 73
Y = 41 ~ 47
```

### Gate

```text
X = 67 ~ 68
Y = 33
```

### Mailbox

```text
X = 65 ~ 66
Y = 34
```

Species는 현재 5종 중 하나를 중복 배정한다.

---

# 11.1 House Door Opening / Trigger

House는 Interior를 직접 이동하는 구조가 아니므로
각 House에 Yard 방향 2-tile Door Opening과 Trigger를 둔다.

## North Houses — South-facing Door

```text
House A Door Opening  = X 11 ~ 12, Y 10
House A Door Approach = X 11 ~ 12, Y 11

House B Door Opening  = X 39 ~ 40, Y 10
House B Door Approach = X 39 ~ 40, Y 11

House C Door Opening  = X 67 ~ 68, Y 10
House C Door Approach = X 67 ~ 68, Y 11
```

## South Houses — North-facing Door

```text
House D Door Opening  = X 11 ~ 12, Y 41
House D Door Approach = X 11 ~ 12, Y 40

House E Door Opening  = X 39 ~ 40, Y 41
House E Door Approach = X 39 ~ 40, Y 40

House F Door Opening  = X 67 ~ 68, Y 41
House F Door Approach = X 67 ~ 68, Y 40
```

각 Door Opening의 접선 방향 폭은 2 tiles / 64px다.

---

# 12. Narrow Alley

2-tile Narrow Alley를 2개 사용한다.

## Alley 1

```text
X = 29 ~ 30
Y = 12 ~ 38
```

## Alley 2

```text
X = 53 ~ 54
Y = 12 ~ 38
```

역할:

- Shortcut
- Quiet Walk
- Look Around
- 잠깐 정지
- Peek
- 수상한 분위기 연출

2-tile은 저밀도 보조 통로로만 사용한다.

Alley 1은 기존 `X25~26`에서 `X29~30`으로 이동해
Rest Area와 South Entry 동선을 분리한다.

---

# 13. Neighborhood Rest Area

```text
Rest Area
X = 22 ~ 27
Y = 34 ~ 39
```

구성:

```text
Bench × 1~2
Tree × 1
Lamp × 1
Flower / Planter
```

주요 행동:

- Sit
- Wait
- Talk
- Rest

광장처럼 많은 NPC가 모이는 공간은 아니다.

`X22~27`의 6×6 영역으로 유지하여
Alley 1 / South Entry Connector와 구조적으로 겹치지 않게 한다.

---

# 14. Trash / Recycling Zone

```text
Trash Zone
X = 55 ~ 58
Y = 35 ~ 38
```

주요 Object:

- Trash Bin
- Recycling Bin

행동:

```text
Carry Bag
→ Trash Zone
→ 잠깐 정지
→ 이동
```

Trash 행동은 Citizen / Villain 판정과 직접 연결하지 않는다.

Trash Zone은 Alley 2 동쪽 `X55~58`에 두어
2-tile Alley Navigation을 침범하지 않는다.

---

# 15. Mailbox Interaction

각 House 앞 Mailbox는 Behavior Point다.

기본 행동:

```text
Home
→ Mailbox
→ 잠깐 확인
→ Home / Walkway
```

수상하게 보일 수 있는 행동 조합:

```text
Street
→ Mailbox 근처 정지
→ Look Around
→ Mailbox 확인
→ Alley / 다른 방향 이동
```

중요:

```text
Mailbox Check ≠ Villain
```

집주인이나 일반 시민도 Mailbox를 확인할 수 있다.

---

# 16. Lamp / Shadow 연출

중앙 생활도로 주변에 Lamp를 배치한다.

## Lamp 후보

```text
L1 = (8, 22)
L2 = (28, 22)
L3 = (42, 22)
L4 = (56, 22)
L5 = (72, 22)

L6 = (8, 28)
L7 = (28, 28)
L8 = (42, 28)
L9 = (56, 28)
L10 = (72, 28)
```

야간 / 저녁 연출 시:

- 일부 밝은 구간
- 일부 그림자 구간
- House / Fence / Tree에 의한 부분 가림

을 활용한다.

수상한 분위기 연출 예:

```text
Lamp 아래 멈춤
Look Around
집 쪽을 잠시 바라봄
Narrow Alley 진입
Mailbox 확인
선글라스 / 모자 / 후드 계열 외형 상태
```

단일 시각 요소 또는 단일 행동을 Villain 정답으로 사용하지 않는다.

---

# 17. 수상한 분위기 행동 원칙

주거지역에서는 복잡한 특수 Interaction보다
짧은 행동 조합과 시각 연출을 사용한다.

예:

```text
Street
→ Stop
→ Look Around
→ Alley
```

또는:

```text
Street
→ Mailbox
→ Look Around
→ 다른 방향으로 이동
```

또는:

```text
Lamp 아래 정지
→ House 방향 관찰
→ 그냥 지나감
```

중요 원칙:

> 수상해 보이는 행동은 판단 단서일 뿐 정답이 아니다.

Citizen도 일부 동일 행동을 수행할 수 있어야 한다.

---

# 18. Entry / Exit

## West Exit

```text
X = 0 ~ 1
Y = 24 ~ 26
```

## East Exit

```text
X = 82 ~ 83
Y = 24 ~ 26
```

## South Entry

기존 중앙 South Entry는 House E와 직접 충돌하는 동선이었으므로
House D / E 사이의 공용 Gap으로 이동한다.

```text
South Entry
X = 28 ~ 30
Y = 50 ~ 51

Width = 3 tiles
```

South Entry Connector:

```text
X = 28 ~ 30
Y = 39 ~ 49

Width = 3 tiles
```

이 Connector는 `Alley 1 (X29~30, Y12~38)`와 이어져
South Entry → South Walkway → Main Residential Street까지
연속적인 Navigation을 만든다.

Rest Area는 X22~27로 축소 / 이동하여
South Entry Connector와 겹치지 않는다.

---

# 19. CCTV 5

주거지역은 CCTV 5 한 대를 사용한다.

## Coverage

```text
X = 0 ~ 83
Y = 0 ~ 51
```

논리적으로는 전체 주거지역을 담당하지만
실제 플레이 화면에서는 한 번에 전체를 보여주지 않는다.

제한적 Pan을 허용한다.

## Pan Focus Anchor 후보

```text
P1 = North Houses Center (42, 12)
P2 = Street Center       (42, 25)
P3 = South Houses Center (42, 40)
P4 = West Alley          (29, 25)
P5 = East Alley          (53, 25)
```

---

# 20. Waypoint Skeleton

주거지역 Graybox 구현에서 사용할 **확정 Navigation Anchor 22개**다.

## Main Street / Entry

```text
W01 WEST_EXIT            = (1, 25)
W02 STREET_WEST          = (18, 25)
W03 STREET_CENTER        = (42, 25)
W04 STREET_EAST          = (66, 25)
W05 EAST_EXIT            = (82, 25)
W06 SOUTH_ENTRY          = (29, 50)
```

## North Row

Gate Object 중심이 아니라 Walkway 쪽 접근 Tile을 사용한다.

```text
W07 HOUSE_A_GATE         = (11, 18)
W08 HOUSE_B_GATE         = (39, 18)
W09 HOUSE_C_GATE         = (67, 18)

W10 NORTH_WALKWAY_WEST   = (18, 19)
W11 NORTH_WALKWAY_CENTER = (42, 19)
W12 NORTH_WALKWAY_EAST   = (66, 19)
```

## South Row

```text
W13 HOUSE_D_GATE         = (11, 32)
W14 HOUSE_E_GATE         = (39, 32)
W15 HOUSE_F_GATE         = (67, 32)

W16 SOUTH_WALKWAY_WEST   = (18, 31)
W17 SOUTH_WALKWAY_CENTER = (42, 31)
W18 SOUTH_WALKWAY_EAST   = (66, 31)
```

## Special Points

```text
W19 ALLEY_1              = (29, 25)
W20 ALLEY_2              = (53, 25)
W21 REST_AREA            = (25, 33)
W22 TRASH_ZONE           = (54, 36)
```

`W21`과 `W22`는 Object / Zone 내부가 아니라
인접한 접근 가능한 Tile이다.

Mailbox는 Navigation Waypoint와 분리된 Interaction Anchor로 관리한다.

```text
MAILBOX_A_APPROACH = (9, 17)
MAILBOX_B_APPROACH = (37, 17)
MAILBOX_C_APPROACH = (65, 17)

MAILBOX_D_APPROACH = (9, 33)
MAILBOX_E_APPROACH = (37, 33)
MAILBOX_F_APPROACH = (65, 33)
```

---

# 21. 주거지역 행동 목록

## 일반 행동

```text
Walk
Leave Home
Return Home
Wait
Talk
Rest
Quiet Walk
Mailbox Check
Take Out Trash
```

## 수상한 분위기 행동

```text
Stop
Look Around
Mailbox Check
Alley Enter
House 방향 관찰
Lamp / Shadow 아래 정지
선글라스 / 모자 / 후드 계열 외형 상태
Look Around → Move
```

---

# 22. NPC 밀도 목표

주거지역은 세 지도 중 가장 낮은 체감 밀도를 가진다.

초기 목표:

```text
약 25~30 NPC
```

예상 분포:

```text
Main Street
≈ 7~9

Walkway
≈ 5~7

Yard
≈ 4~6

Rest Area
≈ 2~4

Narrow Alley
≈ 1~3

House 내부 상태
= 일부

나머지
= 이동 중
```

고정 숫자가 아니라 확률 기반 분포로 사용한다.

---

# 23. Species Theme 가독성 원칙

Species Habitat Theme를 표현하더라도
CCTV 관찰성과 Character Readability가 우선이다.

우선순위:

```text
CCTV Readability
>
Navigation
>
Character Visibility
>
Habitat Theme Accuracy
>
Decoration Density
```

예:

Tiger Yard:

```text
Tall Grass Patch × 2
Log × 1
Rock × 2
Water Decoration × 1
```

정도로 제한해도 충분하다.

---

# 24. 향후 확장 아이디어 — Species Residential Areas

현재 프로토타입:

```text
Residential Area
└─ Mixed Species Neighborhood
   ├─ Rabbit House
   ├─ Fox House
   ├─ Tiger House
   ├─ Cat House
   ├─ Dog House
   └─ Variant House
```

향후 확장 가능:

```text
Residential District

├─ Rabbit-oriented Area
├─ Fox-oriented Area
├─ Tiger-oriented Area
├─ Cat-oriented Area
├─ Dog-oriented Area
└─ Mixed Residential Area
```

이 확장에서는:

- Species별 Residential CCTV 추가
- Species-specific Interaction 추가
- Habitat 표현 강화
- NPC 수 증가
- Area별 Behavior 차별화

등을 고려할 수 있다.

현재 프로토타입 구현 범위에서는 제외한다.

---

# 25. Layer 기본 구조

Visible:

```text
Ground
Ground_Detail
House_Base
Yard_Detail
Object_Base
Characters
Foreground
Roof
Lighting
Effects
```

Logic:

```text
Collision
Navigation
Spawn
Interaction
Mailbox_Zone
Yard_Zone
Camera_Zone
```

---

# 26. Map Design Priority

```text
1. CCTV Visibility
2. NPC Movement
3. Character Readability
4. House / Yard Species Identity
5. Tracking 가능성
6. Suspicious-behavior Ambiguity
7. Visual Decoration
```

---

# 27. 현재 확정 요약

```text
Map
= 84×52

House
= 6채

Species
= Rabbit / Fox / Tiger / Cat / Dog
+ Variant Slot

House Base
= 2~3종 재사용

Species 차이
= Habitat Yard Kit 중심

Main Residential Street
= 5 tiles

Walkway
= 3 tiles

Narrow Alley
= 2개
= 2 tiles

Mailbox
= 각 House 앞
= 일반 / 수상 행동 모두 가능

Lamp
= 중앙 도로 중심
= 야간 / 그림자 연출

Rest Area
= 1개

Trash Zone
= 1개

Entry / Exit
= West / East / South

CCTV
= CCTV 5 하나
= 전체 Coverage
= 제한적 Pan

NPC
= 약 25~30

Suspicious Tone
= Stop
+ Look Around
+ Mailbox Check
+ Alley
+ House 관찰
+ 조명 / 가림
+ 외형 Variant

Future Expansion
= Species별 Residential Area / CCTV 추가 가능
