# SWfestival Shopping District Map Specification

## 1. 문서 목적

이 문서는 지도학습 구역 중 **상점가(Shopping District)** 맵의 실제 제작 기준을 정의한다.

상점가는 광장·공원과 달리, 넓게 퍼지는 생활 공간이 아니라 **Main Street를 중심으로 NPC 흐름이 집중되는 골목시장형 공간**으로 설계한다.

핵심 목적은 다음과 같다.

- CCTV 3 / CCTV 4를 통한 상점가 감시
- Main Street 중심의 높은 NPC 이동 밀도
- Stall 앞의 Browse / Buy / Wait / Talk 행동
- Merchant의 제한된 상점 운영 행동
- Delivery NPC의 Box 운반 행동
- Service Alley를 활용한 보조 이동
- Main Street와 Service Alley 사이의 추적
- 여러 Species와 다양한 판매 품목을 통한 시각적 흥미 제공
- 건물 내부 구현 없이도 상점가 특유의 밀도와 생활감 표현

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
- 한 구역에 약 30~35 NPC가 실제 이동
- CCTV를 통해 NPC를 관찰
- Citizen / Villain 여부는 Species, 위치, 행동과 1:1로 연결하지 않음

---

# 3. 맵 전체 크기

## 확정

```text
Map Size = 96 × 50 tiles
Tile Size = 32 × 32 px
World Pixel Size = 3072 × 1600 px
```

좌표 기준:

```text
좌상단 = (0, 0)
우하단 = (95, 49)

X → 오른쪽 증가
Y → 아래쪽 증가
```

전체 맵은 한 화면에 전부 표시하지 않는다.

## 3.1 좌표 / 충돌 해석 규칙

모든 좌표 범위는 양 끝을 포함한다.

```text
Zone
= 기능 / Behavior / Camera용 논리 영역
= 자체 Collision 아님

Stall Visual Footprint
= Stall의 외형 / 운영 범위
= 전체 10×6을 하나의 Solid Block으로 취급하지 않음

Counter / Structure
= 실제 Collision을 가질 수 있는 부분

Merchant Zone
= Merchant가 Stall 내부에서 이동 가능한 영역

Customer Front
= 고객 NPC가 Stall과 상호작용하는 외부 접근 영역

Box Zone
= 물류 Interaction / Prop 배치 영역
= 전체 영역을 Solid로 채우지 않음
```

Waypoint는 Stall / Box Object 중심이 아니라 접근 가능한 Tile에 둔다.

---

# 4. 전체 공간 구조

상점가는 다음 공간으로 구성한다.

```text
1. Main Street
2. North Walkway
3. South Walkway
4. North Stall Row
5. South Stall Row
6. North Service Alley
7. South Service Alley
8. Arch Entrances
9. Box / Delivery Zones
10. Market Center
11. Main Exit
12. Back Exit
```

상점가의 핵심 구조는 다음과 같다.

```text
North Service Alley
        ↓
Shop A / B / C / D
        ↓
North Walkway
        ↓
Main Street
        ↓
South Walkway
        ↓
Shop E / F / G / H
        ↓
South Service Alley
```

---

# 5. Main Street

상점가의 가장 중요한 공공 이동축.

```text
Main Street
X = 0 ~ 95
Y = 22 ~ 27

Width = 6 tiles
```

역할:

- 일반 시민 고밀도 이동
- Shop 간 이동
- CCTV 3 / 4 추적 중심축
- Market Center 연결
- West / East Exit 연결

Main Street는 차량 도로가 아니라 **보행 중심 상업 거리**로 취급한다.

---

# 6. Market Center

별도 Pocket Plaza는 만들지 않는다.

대신 Main Street의 중앙 일부를 넓게 느껴지도록 설계해 시장의 중심성을 표현한다.

```text
Market Center
X = 43 ~ 52
Y = 18 ~ 31
```

역할:

- 군중 교차
- Wait / Talk / Meet
- CCTV 3 / 4 Coverage overlap 중심
- Main Street의 시각적 중심점

배치 후보:

```text
Market Sign × 1
Bench × 1~2
Lamp × 2
Planter / Decoration
```

중앙을 오브젝트로 과도하게 채우지 않는다.

`Market Center`가 North / South Walkway, Main Street,
Arch B 일부와 겹치는 것은 **의도적인 논리 Zone overlap**이며 Collision 충돌이 아니다.

---

# 7. North / South Walkway

## North Walkway

```text
X = 0 ~ 95
Y = 18 ~ 20

Width = 3 tiles
```

## South Walkway

```text
X = 0 ~ 95
Y = 29 ~ 31

Width = 3 tiles
```

주요 행동:

- Browse
- Buy
- Wait
- Talk
- Walk
- Carry Bag
- Observe

3-tile 폭은 Corridor Capacity Test에서 일반적인 공공 보행로로 충분히 기능한 기준을 재사용한다.

---

# 8. Stall 구성

건물 내부는 만들지 않는다.

상점은 모두 **오픈형 매대 / 노점 Stall** 구조로 제작한다.

총 8개:

```text
North Stall Row
A / B / C / D

South Stall Row
E / F / G / H
```

각 Stall 기본 크기:

```text
10 × 6 tiles
```

각 Stall은 다음 구조를 가진다.

```text
Rear Merchant Space
Counter / Goods
Customer-facing Front
```

Merchant는 Stall 내부에서 약 1~2 tiles 범위로 이동할 수 있다.

---

# 9. Stall 좌표

## North Row

### Shop A

```text
X = 11 ~ 20
Y = 11 ~ 16
```

### Shop B

```text
X = 32 ~ 41
Y = 11 ~ 16
```

### Shop C

```text
X = 53 ~ 62
Y = 11 ~ 16
```

### Shop D

```text
X = 74 ~ 83
Y = 11 ~ 16
```

---

## South Row

### Shop E

```text
X = 11 ~ 20
Y = 33 ~ 38
```

### Shop F

```text
X = 32 ~ 41
Y = 33 ~ 38
```

### Shop G

```text
X = 53 ~ 62
Y = 33 ~ 38
```

### Shop H

```text
X = 74 ~ 83
Y = 33 ~ 38
```

북쪽과 남쪽 Stall Row는 전체적으로 대칭에 가깝게 구성한다.

매대 간 간격은 시각적으로 일정하게 유지한다.

## 9.1 Stall 내부 Navigation / Collision 규칙

Stall의 `10×6` 좌표는 **Visual / Functional Footprint**다.
전체 범위를 Solid Collision으로 만들지 않는다.

North Stall은 남쪽을 바라본다.

```text
North Counter Front Row
Y = 16

North Customer Front Strip
Y = 17
```

South Stall은 북쪽을 바라본다.

```text
South Counter Front Row
Y = 33

South Customer Front Strip
Y = 32
```

Customer Front Strip은 Collision 없이
Browse / Buy / Wait Interaction Point를 배치할 수 있는 영역이다.

Merchant는 Counter 뒤쪽의 Stall 내부에서 제한적으로 이동한다.
정확한 Goods Prop은 Stall마다 달라도 되지만,
Merchant의 1~2 tile 이동 공간과 Service Alley 접근을 막지 않는다.

Box Zone도 전체가 Solid가 아니다.
Box / Crate / Cart는 Zone 일부에만 배치하고
별도의 접근 Anchor를 유지한다.

---

# 10. Stall 판매 테마

판매 품목은 Stall을 구별하는 시각적 테마로 사용한다.

초기 후보:

```text
Shop A
= Bakery / Snacks

Shop B
= Clothes / Accessories

Shop C
= Fruit / Fresh Food

Shop D
= Toys / Small Goods

Shop E
= Books / Stationery

Shop F
= Outdoor / Travel Goods

Shop G
= Home / Daily Goods

Shop H
= Craft / Curios
```

중요 원칙:

```text
Species와 판매 품목을 1:1로 고정하지 않는다.
```

예:

- Cat Merchant가 Bakery 운영 가능
- Rabbit Merchant가 Outdoor Goods 운영 가능
- Tiger Merchant가 Books 판매 가능

모든 Species는 모든 Stall의 손님이 될 수 있다.

Species 다양성과 Stall 테마 다양성을 조합하여
같은 상점가에서도 시각적 변화가 생기도록 한다.

---

# 11. Merchant NPC

Merchant는 일반 NPC보다 이동 범위가 제한된다.

기본 행동:

```text
Idle at Stall
→ Serve
→ Rear Move
→ Box Zone
→ Return
```

선택 행동:

```text
Stall
→ Service Alley
→ 다른 Merchant와 Talk
→ Return
```

Merchant는 일반 시민처럼 맵 전체를 지속적으로 돌아다니지 않는다.

영업 중 대부분의 시간은 자신의 Stall과 근처 Service Alley에 머문다.

---

# 12. Service Alley

Stall 뒤에는 상인과 배달원이 사용하는 Service Alley를 둔다.

## North Service Alley

```text
X = 0 ~ 95
Y = 7 ~ 9

Width = 3 tiles
```

## South Service Alley

```text
X = 0 ~ 95
Y = 41 ~ 43

Width = 3 tiles
```

2-tile이 아니라 3-tile을 사용하는 이유:

- Corridor Test에서 2-tile Large 양방향 이동은 교착 발생
- Merchant와 Delivery NPC의 교행 가능성 존재
- 별도의 복잡한 회피 로직을 만들지 않고 안정적인 이동 확보

Service Alley는 시각적으로는 좁은 골목처럼 연출하되
실제 Navigation 폭은 3 tiles를 유지한다.

---

# 13. Arch Entrance

Service Alley는 Main Street와 분리되어 있지만,
여러 아치형 통로를 통해 연결된다.

## Arch A — North West

```text
X = 24 ~ 26
Y = 9 ~ 22
```

## Arch B — South Center

```text
X = 46 ~ 48
Y = 27 ~ 43
```

## Arch C — North East

```text
X = 68 ~ 70
Y = 9 ~ 22
```

실제 타일 배치에서는 완전 직선 통로보다
입구 일부를 굽히거나 주변 Stall / Decoration으로 감싸
아치형 골목 진입 느낌을 만든다.

역할:

- Main Street ↔ Service Alley 연결
- Merchant / Delivery 이동
- 일반 시민의 낮은 확률 우회 경로
- CCTV Tracking 전환 포인트

---

# 14. Box / Delivery Zone

Stall 2개당 공유 Box Zone 하나를 둔다.

총 4개.

## North West Box Zone

```text
Box Zone N1
X = 27 ~ 30
Y = 10 ~ 13

Shop A / B 공유
```

## North East Box Zone

```text
Box Zone N2
X = 63 ~ 66
Y = 10 ~ 13

Shop C / D 공유
```

## South West Box Zone

```text
Box Zone S1
X = 24 ~ 27
Y = 37 ~ 40

Shop E / F 공유
```

## South East Box Zone

```text
Box Zone S2
X = 66 ~ 69
Y = 37 ~ 40

Shop G / H 공유
```

Box Zone에는 다음 Object를 사용할 수 있다.

- Box
- Crate
- Bag
- Small Cart
- Delivery Stack

통로 전체를 막지 않도록 배치한다.

---

# 15. Delivery NPC

Delivery NPC는 상점가의 물류 행동을 담당한다.

기본 루프:

```text
Back Exit
→ Service Alley
→ Box Zone
→ Box 획득
→ Stall
→ Box 전달
→ 다음 Stall 또는 Box Zone
→ Back Exit
```

실제 Inventory / Economy System은 구현하지 않는다.

상태 기반 Behavior 연출로 충분하다.

---

# 16. Main Exit

일반 시민이 상점가에 들어오고 나가는 주요 출입구.

## West Exit

```text
X = 0 ~ 1
Y = 23 ~ 26
```

## East Exit

```text
X = 94 ~ 95
Y = 23 ~ 26
```

가장 많은 일반 NPC가 사용하는 출입구다.

---

# 17. Back Exit

Service Alley 전용 Spawn / Despawn 성격의 출입구.

## North-West Back Exit

```text
X = 0 ~ 2
Y = 7 ~ 9
```

## South-East Back Exit

```text
X = 93 ~ 95
Y = 41 ~ 43
```

주 사용 NPC:

- Merchant
- Delivery NPC
- 낮은 확률의 일반 시민

Back Exit는 다른 도시 구역으로 이동하는 주요 출입구라기보다
시장 운영 인력과 물류의 보조 출입구로 취급한다.

---

# 18. 상점가 전용 행동

상점가에서 가능한 주요 Behavior:

```text
Browse
Buy
Wait
Talk
Carry Bag
Carry Box
Deliver
Rest
Look Around
Whisper
Peek
Look Around → Run
```

주의:

```text
특정 행동 = Villain
```

으로 직접 연결하지 않는다.

예:

- 시민도 골목으로 이동할 수 있음
- 시민도 Box를 들 수 있음
- 시민도 주변을 살필 수 있음
- Villain도 평범하게 쇼핑할 수 있음

---

# 19. CCTV 구조

상점가는 CCTV 2대를 사용한다.

---

## CCTV 3 — West Market Camera

Coverage 후보:

```text
X = 0 ~ 55
Y = 4 ~ 47
```

주요 담당:

- Shop A
- Shop B
- Shop E
- Shop F
- West Main Street
- West Service Alley
- Box Zone N1
- Box Zone S1
- West Exit
- Market Center 일부

---

## CCTV 4 — East Market Camera

Coverage 후보:

```text
X = 40 ~ 95
Y = 4 ~ 47
```

주요 담당:

- Shop C
- Shop D
- Shop G
- Shop H
- East Main Street
- East Service Alley
- Box Zone N2
- Box Zone S2
- East Exit
- Market Center

---

## CCTV 3 / 4 Overlap

```text
X = 40 ~ 55
Y = 4 ~ 47
```

핵심 Tracking 흐름:

```text
CCTV 3 only
→ CCTV 3 + CCTV 4
→ CCTV 4 only
```

Market Center가 대표적인 overlap 영역이다.

Service Alley에서도 동일 NPC 추적이 가능해야 한다.

---

# 20. Waypoint Skeleton

상점가 Graybox 구현에서 사용할 **확정 Navigation Anchor 26개**다.

## Main Street

```text
W01 WEST_EXIT          = (1, 24)
W02 MAIN_WEST          = (20, 24)
W03 MAIN_CENTER        = (38, 24)
W04 MARKET_CENTER      = (47, 24)
W05 MAIN_EAST          = (75, 24)
W06 EAST_EXIT          = (94, 24)
```

## Stall Front

North Stall은 `Y17`, South Stall은 `Y32`의 Customer Front Strip에 둔다.

```text
W07 SHOP_A_FRONT       = (15, 17)
W08 SHOP_B_FRONT       = (36, 17)
W09 SHOP_C_FRONT       = (57, 17)
W10 SHOP_D_FRONT       = (78, 17)

W11 SHOP_E_FRONT       = (15, 32)
W12 SHOP_F_FRONT       = (36, 32)
W13 SHOP_G_FRONT       = (57, 32)
W14 SHOP_H_FRONT       = (78, 32)
```

## North Service Alley

```text
W15 NORTH_ALLEY_WEST   = (12, 8)
W16 NORTH_ALLEY_CENTER = (48, 8)
W17 NORTH_ALLEY_EAST   = (80, 8)
```

## South Service Alley

```text
W18 SOUTH_ALLEY_WEST   = (12, 42)
W19 SOUTH_ALLEY_CENTER = (48, 42)
W20 SOUTH_ALLEY_EAST   = (80, 42)
```

## Box Zone Access

Box Object 중심이 아니라 Service Alley 쪽 접근 Anchor를 사용한다.

```text
W21 BOX_N1             = (28, 9)
W22 BOX_N2             = (64, 9)
W23 BOX_S1             = (25, 41)
W24 BOX_S2             = (68, 41)
```

## Back Exit

```text
W25 BACK_EXIT_NW       = (1, 8)
W26 BACK_EXIT_SE       = (94, 42)
```

Merchant 전용 Stall 내부 Point는
일반 Navigation Waypoint와 별도 관리한다.

---

# 21. NPC 밀도 목표

한 구역에 약 30~35 NPC를 사용한다.

상점가는 광장·공원보다 Main Street에 밀도가 집중된다.

예상 분포:

```text
Main Street / Walkway
≈ 12~15

Stall Front
≈ 6~8

Market Center
≈ 5~7

Service Alley / Box Zone
≈ 2~4

Merchant / Delivery
≈ 별도 역할 NPC 포함

나머지
= 이동 중
```

고정 숫자가 아니라 확률 기반 분포로 사용한다.

---

# 22. 환경 Object 후보

상점가에 필요한 주요 Object:

```text
Stall
Counter
Awning
Goods Display
Streetlamp
Bench
Trash Bin
Market Sign
Store Sign
Box
Crate
Bag
Small Cart
Planter
Arch
Fence / Divider
```

Tree는 공원보다 훨씬 적게 사용한다.

필요하면 작은 가로수나 Planter 정도만 사용한다.

Flower는 Decoration으로 사용할 수 있으며
Collision / Gameplay Logic을 갖지 않는다.

---

# 23. Object Classification

## Navigation Object

- Main Street
- North Walkway
- South Walkway
- North Service Alley
- South Service Alley
- Arch Entrance
- Main Exit
- Back Exit

## Interactive / Behavior Object

- Stall Front
- Merchant Point
- Box Zone
- Bench
- Market Center
- Delivery Point
- Waiting Point

## Decoration

- Goods Display
- Flower
- Planter
- Store Sign
- Small Decoration
- Non-interactive Prop

---

# 24. Layer 기본 구조

Visible:

```text
Ground
Ground_Detail
Stall_Base
Object_Base
Characters
Foreground
Awning
Effects
```

Logic:

```text
Collision
Navigation
Spawn
Interaction
Merchant_Zone
Delivery_Zone
Camera_Zone
```

---

# 25. Map Design Priority

우선순위:

```text
1. CCTV Visibility
2. Main Street NPC Flow
3. Stall Readability
4. Character Readability
5. Tracking 가능성
6. Merchant / Delivery Behavior
7. Visual Decoration
```

상점가가 복잡해 보이더라도
NPC가 Stall과 배경에 묻히지 않아야 한다.

---

# 26. 광장·공원과의 역할 차이

```text
Plaza & Park
= 넓게 퍼지는 생활 공간
= 자연물 중심
= 산책 / 휴식 / 광장 행동

Shopping District
= Main Street 중심 고밀도 공간
= Stall 중심
= Browse / Buy / Carry / Deliver / Talk
= Service Alley / Box Zone
```

두 맵은 같은 NPC 시스템을 사용하되
공간 구조와 행동 확률이 다르게 느껴져야 한다.

---

# 27. 현재 확정 요약

```text
Map
= 96×50

Main Street
= 6 tiles

North / South Walkway
= 3 tiles

Stall
= 총 8개
= North 4 / South 4
= 10×6 tiles
= 오픈형 골목시장 구조

Buildings / Interior
= 없음

Service Alley
= North / South
= 3 tiles

Arch Entrance
= 3개

Box Zone
= 총 4개
= Stall 2개당 1개 공유

Main Exit
= West / East

Back Exit
= NW / SE

Market Center
= Main Street 중앙 확장 구간
= 별도 Pocket Plaza 없음

Merchant
= Stall 중심 제한 이동

Delivery NPC
= Back Exit → Alley → Box Zone → Stall

CCTV
= CCTV 3 / CCTV 4
= Market Center 중심 overlap

Waypoint
= 약 26개

Species
= Merchant / Customer 다양화에 사용
= 판매 품목과 1:1 고정하지 않음
