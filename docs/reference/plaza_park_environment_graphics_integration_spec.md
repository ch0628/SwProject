# Plaza/Park Environment Graphics Integration Spec

## 1. 목적

현재 검증된 Plaza/Park Graybox 구조 위에 완성된 Environment Asset을 통합한다.

이번 단계는 맵 재설계가 아니다.

목표:

```text
기존 Geometry / Collision / Navigation 유지
→ Terrain 적용
→ Building 적용
→ Street / Nature Object 적용
→ Depth / Y-sort 적용
→ Visual Regression
```

현재 Prototype Operating Density:

```text
10 active movers
```

---

## 2. 절대 유지할 Source of Truth

Graphics Integration 과정에서 다음은 변경하지 않는다.

```text
Map Size = 96 × 56 tiles
Tile Size = 32 px

W01~W22
Route R1~R8
Collision
Door Opening
Door Trigger / Approach
Upper / Lower Narrow
Main Walkway
Main Route
CCTV Coverage Geometry
10 active movers
```

Graphics 작업 때문에 Route / Collision / Waypoint / Door / Path Width를 수정하지 않는다.

---

## 3. Asset Inventory

총 PNG:

```text
58
```

분류:

```text
Buildings = 4
Nature    = 7
Special   = 1
Street    = 13
Terrain   = 33
```

`terrain/plaza.zip`은 asset count에 포함하지 않는다.

---

## 4. Pixel / Tile 규격

### Buildings

```text
Cafe
cafe_base.png        = 416 × 256 = 13 × 8 tiles
cafe_foreground.png  = 416 × 256 = 13 × 8 tiles

Public Facility
public_facility_base.png        = 416 × 288 = 13 × 9 tiles
public_facility_foreground.png  = 416 × 288 = 13 × 9 tiles
```

원본 scale:

```text
1.0
```

Resize 금지.

### Nature / Street

```text
Tree  = 96 × 128
Bush  = 64 × 48
Bench = 96 × 48
Lamp  = 32 × 80
Fence = 32 × 32
Flower = 32 × 32
Manhole = 32 × 32
```

### Terrain

모든 Terrain tile:

```text
32 × 32
```

---

## 5. Layer 정책

권장 visible layer 구조:

```text
Ground
Ground_Detail
Object_Base
Characters
Foreground
Roof
Effects
```

### Ground

```text
grass_base
park_path_*
plaza_paving_*
plaza_border_*
main_route_*
```

### Ground_Detail

```text
grass_detail_*
flower_patch_*
manhole_closed
```

모두 non-blocking visual detail로 취급한다.

### Object_Base / Y-sort 대상

```text
tree_*
bush_*
bench
lamp_base
```

NPC와 동일한 ground-contact / feetY 기준 depth를 사용한다.

### Foreground

```text
cafe_foreground
public_facility_foreground
```

Character보다 위에 렌더링한다.

### Effects

```text
lamp_glow
```

lamp_base와 같은 위치에 배치하되 별도 effect layer로 처리한다.

---

## 6. Building 배치

### Cafe

```text
Building Area:
X7~19
Y37~44

Asset:
cafe_base.png
cafe_foreground.png

Size:
13 × 8 tiles

Scale:
1.0
```

두 이미지는 같은 기준 위치에 겹쳐 배치한다.

```text
base       → Character 아래
foreground → Character 위
```

Door / Trigger / Approach는 기존 Geometry를 그대로 사용한다.

### Public Facility

```text
Building Area:
X79~91
Y8~16

Asset:
public_facility_base.png
public_facility_foreground.png

Size:
13 × 9 tiles

Scale:
1.0
```

Cafe와 동일하게 base / foreground를 분리한다.

---

## 7. Terrain 적용 원칙

### 7.1 Grass

기본 비도로/비광장 영역:

```text
grass_base
```

1차 Integration에서는 `grass_base` 중심으로 적용한다.

Grass variation은 기본 구조 PASS 후 추가한다.

### 7.2 Park Path

다음 기존 Walkway Geometry에만 `park_path_*`를 적용한다.

```text
Main Walkway
Upper Narrow
Lower Narrow
North Entry Connector
Park 내부 connector
Park → Plaza Transition
```

Path Width / Shape는 기존 Geometry와 정확히 일치해야 한다.

### 7.3 Central Plaza

Central Plaza 내부:

```text
plaza_paving_base
```

가 기본이다.

외곽은:

```text
plaza_border_*
plaza_corner_*
```

를 사용한다.

Open Core의 동선 가독성을 유지한다.

### 7.4 Main Route

기본:

```text
main_route_base
```

상하 경계:

```text
main_route_edge_top
main_route_edge_bottom
```

West / East Exit 연결을 시각적으로 막지 않는다.

---

## 8. Variant 사용 규칙

Variant는 Geometry가 아니라 반복감 완화용이다.

### Plaza

```text
plaza_paving_base      ≈ 70%
plaza_paving_variant_a ≈ 15%
plaza_paving_variant_b ≈ 15%
```

Variant는 내부 paving에만 사용한다.

Border / Corner 자리는 전용 tile을 사용한다.

### Main Route

```text
main_route_base      ≈ 70%
main_route_variant_a ≈ 15%
main_route_variant_b ≈ 15%
```

Variant를 연속적으로 과도하게 반복하지 않는다.

### Grass Detail

```text
grass_detail_a = 기본 detail
grass_detail_b = 보조
grass_detail_c = 보조
```

전체 grass tile 중 약 10~20%에만 배치한다.

Path / Plaza / Road에는 사용하지 않는다.

---

## 9. Nature Variant 규칙

### Tree

시각적 성격:

```text
tree_a
- 대칭적
- 정돈된 느낌
- Plaza 경계 / 입구 / 정돈된 구역에 적합

tree_b
- 비대칭적
- 자연스러운 느낌
- Park 내부에 적합
```

권장 비율:

```text
tree_a ≈ 40%
tree_b ≈ 60%
```

Tree는 bottom-center ground-contact anchor 기준으로 배치한다.

```text
origin ≈ (0.5, 1.0)
depth = groundContactY
```

### Bush

```text
bush_a
- 단순
- 좁은 가장자리 / fence 주변

bush_b
- 볼륨감
- 코너 / tree 주변 / 시각 포인트
```

권장 비율:

```text
50 / 50
```

### Flower

```text
flower_patch_b = 기본
flower_patch_a = 보조 포인트
flower_patch_c = 강조 포인트
```

권장 비율:

```text
A = 25%
B = 50%
C = 25%
```

사용 위치:

```text
grass 위만
bench 주변 가능
tree 주변 가능
path 중앙 금지
plaza 내부 금지
main route 금지
```

---

## 10. Street Object 정책

### Bench

```text
96 × 48
ground-contact 기준
dynamic Y-sort
```

기존 Bench object 위치를 사용한다.

새 collision geometry를 만들지 않는다.

### Lamp

```text
lamp_base = 32 × 80
lamp_glow = 32 × 80
```

같은 위치에 겹친다.

```text
lamp_base → Y-sort
lamp_glow → Effects
```

### Fence

기존 Fence geometry만 시각화한다.

사용 asset:

```text
horizontal
vertical
corner TL/TR/BL/BR
end up/down/left/right
```

Fence visual 때문에 기존 collision geometry를 바꾸지 않는다.

### Manhole

```text
32 × 32
Ground_Detail
non-blocking
```

---

## 11. Y-sort / Anchor 정책

다음 요소는 NPC와 동일한 ground-contact 기준을 사용한다.

```text
NPC
Tree
Bush
Bench
Lamp
```

기본 원칙:

```text
depth = feetY 또는 groundContactY
```

큰 sprite의 top-left Y를 depth로 사용하지 않는다.

Building foreground는 dynamic Y-sort가 아니라 별도 foreground layer로 처리한다.

---

## 12. Zone별 시각 밀도

### Park

목표:

```text
자연스럽고 풍부함
```

우선순위:

```text
tree_b
bush
flower
grass_detail
```

단:

```text
Main Walkway
Upper Narrow
Lower Narrow
connector
```

주변을 시각적으로 좁혀 보이게 만들지 않는다.

### Central Plaza

목표:

```text
정돈됨
CCTV 가독성
이동 경로 가독성
```

원칙:

```text
과도한 Nature detail 금지
Open Core 유지
큰 foreground object 최소화
```

### Cafe / Public Facility

건물 존재와 Door 위치가 즉시 읽혀야 한다.

Door 앞에는:

```text
Tree
Bush
Bench
Lamp
Flower
```

를 추가 배치하지 않는다.

### Main Route / EntryExit

목표:

```text
이동 경로가 한눈에 읽힘
```

장식보다 path readability 우선.

---

## 13. CCTV 보호 원칙

Graphics 단계에서도 CCTV Gameplay 공간을 보호한다.

금지:

```text
CCTV 대상 영역을 큰 tree crown으로 지속적으로 가림
Door / CCTV interaction marker 가림
NPC가 coverage에 있지만 거의 보이지 않는 foreground 구성
```

특히 CCTV2의 Park / Plaza 관찰 영역은 충분한 캐릭터 식별성을 유지해야 한다.

---

## 14. Active NPC와 Visual Density 분리

운영 기준:

```text
active movers ≤ 10
```

이는 화면의 총 Character 수를 의미하지 않는다.

필요 시 향후:

```text
static NPC
sitting NPC
decorative NPC
```

를 추가할 수 있다.

단, 이들은 collision-aware active traffic actor와 분리한다.

1차 Graphics Integration에는 정적 NPC 추가를 필수로 하지 않는다.

---

## 15. Integration 순서

### Phase 1 — Structural Graphics

```text
grass
path
plaza
road
Cafe
Public Facility
Fence
```

목표:

```text
Graybox Geometry와 Graphics 정합성 확인
```

### Phase 2 — Y-sort Objects

```text
Tree
Bush
Bench
Lamp
```

목표:

```text
NPC 앞/뒤 관계 검증
```

### Phase 3 — Detail

```text
grass detail
flower
manhole
lamp glow
terrain variants
```

목표:

```text
반복감 완화
```

---

## 16. Graphics Regression

### FAIL

다음 중 하나면 수정 필요:

```text
Door가 가려짐
주요 Path가 시각적으로 막힘
NPC / Object depth가 명백히 뒤집힘
심각한 clipping
CCTV 대상 식별 불가
Map Geometry 변경
Collision 변경
Waypoint / Route 변경
Door Trigger 변경
```

### WARN

다음은 기록 후 진행 가능:

```text
작은 shadow mismatch
minor pixel alignment
약간의 visual overlap
장식 밀도 약간 어색
작은 반복 pattern
```

원칙:

```text
Prototype을 막는 FAIL만 수정
WARN은 기록하고 진행
```

---

## 17. PASS 후 다음 단계

```text
Environment Graphics Integration
→ Graphics Regression PASS
→ CCTV1 / CCTV2 Interaction
→ Plaza/Park Vertical Slice PASS
```
