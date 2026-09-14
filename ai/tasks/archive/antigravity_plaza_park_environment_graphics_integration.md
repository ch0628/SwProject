# Antigravity Task — Plaza/Park Environment Graphics Integration

## 목적

현재 검증 완료된 Plaza/Park Graybox 구조 위에
`assets/environment/`의 Environment Graphics를 실제 게임 화면에 통합한다.

이번 작업은 **Graphics Integration**이다.

다음은 하지 않는다.

```text
Traffic tuning
Fix5
Route 수정
Waypoint 수정
Collision 수정
Door Trigger 수정
Map Geometry 수정
CCTV Gameplay 구현
Shopping / Residential 확장
```

현재 Prototype Operating Density는:

```text
10 active movers
```

이며 이번 작업에서 변경하지 않는다.

---

# 1. 먼저 읽을 파일

반드시 아래 순서로 읽는다.

```text
ai/RULES.md
ai/WORKFLOW.md
ai/CONTEXT_MAP.md

docs/session_handoff_current.md
docs/map_plaza_park_spec.md
docs/archive/plaza_park_environment_graphics_start.md
docs/reference/plaza_park_environment_graphics_integration_spec.md

public/maps/plaza-park.tmj

src/PlazaParkScene.ts
src/plazaPark.ts
src/plazaTraffic.ts
```

그 다음 현재 project의 asset loading / rendering 구조를 확인하는 데 필요한 파일만 최소한으로 추가로 읽는다.

대규모 repository 탐색은 하지 않는다.

---

# 2. Environment Asset Source

현재 Environment Asset Source:

```text
assets/environment/
```

구성:

```text
buildings/
nature/
special/
street/
terrain/
```

총 PNG:

```text
58
```

`terrain/plaza.zip`은 사용하지 않는다.

Vite/Phaser에서 현재 경로를 직접 사용할 수 없다면,
**기존 repository asset convention을 먼저 확인**한 뒤
가장 작은 방식으로 browser-loadable 위치에 연결한다.

규칙:

```text
원본 asset 삭제 금지
원본 이미지 resize 금지
이미지 재생성 금지
임의 pixel 수정 금지
```

asset copy가 필요하면 원본은 그대로 두고,
복사된 경로와 이유를 최종 보고에 명시한다.

---

# 3. 절대 유지할 Source of Truth

Graphics Integration 전후 다음은 동일해야 한다.

```text
Map Size = 96 × 56 tiles
Tile Size = 32 px

W01~W22
R1~R8
Collision Objects
Door Opening
Door Trigger
Door Approach
Upper Narrow
Lower Narrow
Main Walkway
Main Route
CCTV Coverage Geometry

10 active movers policy
```

특히 다음 파일의 Movement semantics를 변경하지 않는다.

```text
src/plazaTraffic.ts
```

가능하면 해당 파일은 수정하지 않는다.

---

# 4. 구현 방식 원칙

기존 map / renderer 구조를 확인한 후
**가장 작은 변경으로 Graphics를 얹는다.**

우선순위:

```text
기존 TMJ layer/object 활용
→ 기존 Phaser map loader 활용
→ 필요한 최소 renderer 추가
```

금지:

```text
새 Graybox 작성
새 waypoint 작성
기존 object 좌표 재배치
collision box 재설계
기존 map region resize
```

Object 위치가 이미 TMJ에 존재한다면
반드시 그 위치를 사용한다.

정확한 위치 marker가 없는 decorative asset은
이번 1차 Integration에서 **임의 좌표를 만들어 배치하지 않는다.**

그 경우:

```text
SKIPPED — no approved placement marker
```

로 보고한다.

---

# 5. Layer 정책

다음 의미를 유지한다.

```text
Ground
Ground_Detail
Object_Base
Characters
Foreground
Roof
Effects
```

repository에 이미 동일 의미의 layer가 존재하면
새 이름을 만들지 말고 기존 것을 재사용한다.

## Ground

```text
grass_base
park_path_*
plaza_paving_*
plaza_border_*
main_route_*
```

## Ground_Detail

```text
grass_detail_*
flower_patch_*
manhole_closed
```

Ground detail은 non-blocking이다.

## Y-sort Object

```text
tree_*
bush_*
bench
lamp_base
```

NPC와 같은 ground-contact / feetY 기준으로 depth를 결정한다.

```text
depth = groundContactY
```

sprite top-left Y를 depth로 사용하지 않는다.

## Foreground

```text
cafe_foreground
public_facility_foreground
```

Characters보다 위에 렌더링한다.

## Effects

```text
lamp_glow
```

---

# 6. Building Integration

## Cafe

Source:

```text
assets/environment/buildings/cafe/cafe_base.png
assets/environment/buildings/cafe/cafe_foreground.png
```

Pixel size:

```text
416 × 256
```

Map footprint:

```text
13 × 8 tiles
X7~19
Y37~44
```

규칙:

```text
scale = 1.0
resize 금지
base / foreground 동일 기준 위치
base → Characters 아래
foreground → Characters 위
```

Door / Trigger / Approach geometry는 변경하지 않는다.

## Public Facility

Source:

```text
assets/environment/buildings/public_facility/public_facility_base.png
assets/environment/buildings/public_facility/public_facility_foreground.png
```

Pixel size:

```text
416 × 288
```

Map footprint:

```text
13 × 9 tiles
X79~91
Y8~16
```

Cafe와 동일 원칙.

---

# 7. Terrain Integration

## 기본 World

비도로 / 비광장 기본:

```text
grass_base
```

## Park Path

기존 approved geometry에만 적용:

```text
Main Walkway
Upper Narrow
Lower Narrow
North Entry Connector
Park connectors
Park → Plaza Transition
```

사용 가능:

```text
park_path_center
park_path_edge_*
park_path_corner_*
park_path_inner_*
```

path geometry를 Graphics 때문에 변경하지 않는다.

## Central Plaza

기본:

```text
plaza_paving_base
```

외곽:

```text
plaza_border_*
plaza_corner_*
```

Open Core는 시각적으로도 읽혀야 한다.

## Main Route

기본:

```text
main_route_base
```

외곽:

```text
main_route_edge_top
main_route_edge_bottom
```

West / East Exit가 명확히 연결되어 보여야 한다.

---

# 8. Variant 규칙

Variant는 geometry 변경이 아니라 반복감 완화용이다.

runtime random 사용 금지.

deterministic placement만 허용한다.

## Plaza

목표 비율:

```text
base ≈ 70%
variant_a ≈ 15%
variant_b ≈ 15%
```

단:

- exact grid position이 기존 TMJ / approved tile data에서 결정되지 않았다면
  1차 structural integration에서는 `plaza_paving_base`만 사용해도 된다.
- variant를 넣기 위해 임의 좌표 목록을 새로 만들지 않는다.

## Main Route

동일:

```text
base ≈ 70%
variant_a ≈ 15%
variant_b ≈ 15%
```

exact approved placement가 없으면 base-only 허용.

## Grass Detail

전체 grass 중 10~20% 수준이 목표지만,
approved placement marker가 없으면 이번 1차 pass에서는 생략한다.

---

# 9. Nature Variant Assignment

실제 이미지 성격은 다음과 같이 확정한다.

## Tree

```text
tree_a
→ 대칭적 / 정돈된 느낌
→ Plaza 경계 / Entry / 정돈된 구역 우선

tree_b
→ 비대칭적 / 자연스러운 느낌
→ Park 내부 우선
```

목표 비율:

```text
A ≈ 40%
B ≈ 60%
```

하지만 가장 중요한 원칙:

> 기존 Tree object 좌표만 사용한다.

Tree anchor:

```text
bottom-center
origin ≈ (0.5, 1.0)
depth = groundContactY
```

## Bush

```text
bush_a
→ 단순 / 가장자리 / fence 주변

bush_b
→ 볼륨 / 코너 / tree 주변
```

목표:

```text
50 / 50
```

기존 Bush marker만 사용한다.

## Flower

```text
flower_patch_b → 기본
flower_patch_a → 보조
flower_patch_c → 강조
```

목표:

```text
A 25%
B 50%
C 25%
```

단:

```text
grass 위만
path 중앙 금지
plaza 금지
main route 금지
```

기존 marker가 없으면 생략한다.

---

# 10. Street Objects

## Bench

```text
96 × 48
ground-contact 기준
Y-sort
```

기존 Bench 위치 사용.

## Lamp

```text
lamp_base = 32 × 80
lamp_glow = 32 × 80
```

같은 기준 좌표 사용.

```text
base → Y-sort
glow → Effects
```

## Fence

기존 Fence geometry만 시각화한다.

필요 asset:

```text
fence_horizontal
fence_vertical
fence_corner_*
fence_end_*
```

Graphics를 맞추기 위해 Collision geometry를 변경하지 않는다.

## Manhole

```text
32 × 32
Ground_Detail
non-blocking
```

기존 marker가 있을 때만 배치한다.

---

# 11. Visual Density 보호

## Park

자연스럽고 풍부하게 보이되:

```text
Main Walkway
Upper Narrow
Lower Narrow
Connector
```

가 시각적으로 좁아 보이면 안 된다.

## Central Plaza

우선순위:

```text
정돈됨
이동 경로 가독성
CCTV 가독성
```

Open Core에 큰 foreground object를 추가하지 않는다.

## Cafe / Facility

Door가 즉시 식별 가능해야 한다.

Door 앞에 새 decorative object를 임의 배치하지 않는다.

## Main Route / EntryExit

장식보다 이동 경로 가독성이 우선이다.

---

# 12. CCTV 보호

이번 task에서 CCTV Gameplay를 구현하지 않는다.

하지만 Graphics가 다음을 방해하면 안 된다.

```text
CCTV1 / CCTV2 관찰 대상 식별
interaction 위치 식별
coverage 내 NPC 시야
```

특히 큰 tree crown / foreground가
CCTV2의 Park + Plaza 시야를 지속적으로 가리지 않도록 한다.

---

# 13. 구현 순서

## Phase 1 — Structural Graphics

먼저:

```text
grass
park path
plaza
main route
Cafe
Public Facility
Fence
```

를 통합한다.

이 상태에서:

```text
geometry alignment
door readability
path readability
building exact-fit
```

를 확인한다.

## Phase 2 — Y-sort Objects

그 다음:

```text
Tree
Bush
Bench
Lamp
```

를 통합한다.

NPC와 앞/뒤 관계를 확인한다.

## Phase 3 — Detail

마지막:

```text
grass detail
flower
manhole
lamp glow
terrain variant
```

를 적용한다.

approved placement가 불명확한 detail은 skip 가능하다.

---

# 14. Visual Validation

가능하면 실제 application을 실행하고
Plaza/Park scene을 직접 확인한다.

반드시 확인:

```text
Cafe fit
Facility fit

Cafe door visible
Facility door visible

Main Walkway visible
Upper / Lower Narrow visible
Main Route visible

Tree/NPC depth
Bush/NPC depth
Bench/NPC depth
Lamp/NPC depth

Foreground clipping
building foreground behavior

CCTV1/CCTV2 주요 시야 방해 여부
```

가능하면 before / after screenshot을 남긴다.

---

# 15. Regression

최소:

```text
npm run typecheck
npm test
npm run build
```

현재 Traffic / Harness tests를 Graphics 변경 때문에 약화시키지 않는다.

기존 테스트 실패가 발생하면
expectation을 바꿔 PASS시키지 말고 원인을 보고한다.

---

# 16. PASS / WARN / FAIL

## FAIL

다음이면 수정 필요:

```text
Door 가림
주요 Path 시각적 차단
명백한 depth 역전
심각한 clipping
CCTV 대상 식별 불가
Geometry 변경
Collision 변경
Waypoint/Route 변경
Door Trigger 변경
Traffic regression
```

## WARN

진행 가능:

```text
minor pixel alignment
small shadow mismatch
약간의 visual overlap
detail 반복감
장식 밀도 약간 어색
```

원칙:

```text
Prototype을 막는 FAIL만 수정
WARN은 기록하고 진행
```

---

# 17. 변경 범위

가능한 변경:

```text
Plaza/Park graphics renderer / loader
TMJ visual-only layer / tileset references
asset manifest / preload
graphics-specific helper
```

필요한 경우 최소 범위로만 수정한다.

가급적 수정하지 않을 것:

```text
src/plazaTraffic.ts
collision code
route code
Full Flow Harness
```

---

# 18. 문서 업데이트

이번 작업에서는 Source-of-Truth 문서를 자동으로 다시 작성하지 않는다.

구현 결과를 보고한 뒤
사용자 검토 후 문서를 갱신한다.

---

# 19. 최종 보고 형식

## 1. 변경 파일

## 2. Asset 연결 방식

예:

```text
원본 경로
runtime 경로
copy 여부
```

## 3. Structural Graphics

```text
Grass
Path
Plaza
Road
Cafe
Facility
Fence
```

각각 구현 여부.

## 4. Y-sort

```text
Tree
Bush
Bench
Lamp
```

anchor / depth 방식.

## 5. Detail

```text
Flower
Grass Detail
Manhole
Lamp Glow
Variants
```

적용 / skip 및 이유.

## 6. Source-of-Truth 보존

명시:

```text
Geometry
Collision
W01~W22
R1~R8
Door
10 active movers policy
```

변경 여부.

## 7. Regression

```text
typecheck
tests
build
```

## 8. Visual Validation

```text
Cafe fit
Facility fit
Door readability
Path readability
Y-sort
Foreground
CCTV visibility
```

PASS / WARN / FAIL.

## 9. 남은 WARN

## 10. 최종 판정

```text
PASS
PASS with WARN
FAIL
```

## 11. 중단

보고 후 멈춘다.

다음 단계인:

```text
Graphics Regression 보완
CCTV1 / CCTV2
```

로 자동 진행하지 않는다.
