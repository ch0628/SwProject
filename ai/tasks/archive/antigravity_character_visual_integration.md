# Antigravity Task — Character Visual Integration (40 Directional PNGs)

## 목적

현재 Plaza/Park Prototype의 임시 도형 NPC를
사용자가 직접 제작한 5 Species × Male/Female × 4 Direction
정적 캐릭터 PNG로 교체한다.

이번 작업은 **Character Visual Integration**만 수행한다.

현재 Traffic v1 / Map / Collision / Route / Waypoint / CCTV Gameplay를 수정하지 않는다.

---

# 1. 먼저 확인할 파일

아래를 먼저 읽고 현재 최신 repository 상태를 확인한다.

```text
ai/RULES.md
ai/WORKFLOW.md
ai/CONTEXT_MAP.md

docs/session_handoff_current.md
docs/archive/plaza_park_npc_traffic_known_issue.md
docs/validation/plaza_park_v1/plaza_park_graphics_integration_report.md
docs/graphics_character_asset_spec.md

src/PlazaParkScene.ts
src/ScaleValidationScene.ts
src/plazaTraffic.ts
src/config.ts
```

추가 파일은 Character loading/rendering 구조 확인에 필요한 최소 범위만 읽는다.

---

# 2. Character Asset Source

원본:

```text
assets/characters/
```

Species:

```text
rabbit
cat
fox
dog
tiger
```

각 Species는 Male / Female이 있고,
실제 runtime에 사용할 이미지는 **4방향 개별 PNG**다.

현재 repository tree 기준 개별 PNG 위치는:

```text
assets/characters/<species>/base/<gender>/<species>_<gender>_down.png
assets/characters/<species>/base/<gender>/<species>_<gender>_left.png
assets/characters/<species>/base/<gender>/<species>_<gender>_right.png
assets/characters/<species>/base/<gender>/<species>_<gender>_up.png
```

총:

```text
5 species × 2 gender × 4 direction = 40 PNG
```

예:

```text
assets/characters/rabbit/base/male/rabbit_male_down.png
assets/characters/rabbit/base/female/rabbit_female_left.png
...
assets/characters/tiger/base/female/tiger_female_up.png
```

---

# 3. 절대 사용하지 않을 파일

다음 종류의 Sheet는 runtime character texture로 사용하지 않는다.

```text
game_ready_sheet_*.png
game_sheet_*.png
game_sheets_*.png
```

현재 tree에서:

```text
assets/characters/<species>/reference/game_ready_sheet_male.png
assets/characters/<species>/reference/game_ready_sheet_female.png
```

는 4방향이 한 장에 들어 있는 reference / sheet 이미지이므로
이번 Runtime Integration에서 사용하지 않는다.

Sheet crop / frame slicing도 하지 않는다.

반드시 **개별 directional PNG 40개**를 사용한다.

주의:
현재 실제 tree와 위 경로가 다르다면 임의 추정하지 말고
개별 directional PNG가 실제 어디 있는지 확인한 뒤 보고한다.

---

# 4. 원본 Asset 보존

금지:

```text
원본 PNG 삭제
원본 PNG resize
원본 PNG trim
원본 PNG crop
원본 PNG padding 변경
원본 PNG alpha 변경
sheet에서 sprite 재추출
이미지 재생성
```

browser runtime용 복사가 필요하면:

```text
public/assets/characters/
```

아래에 구조를 보존해서 복사한다.

예:

```text
public/assets/characters/rabbit/base/male/rabbit_male_down.png
```

원본 `assets/characters/`는 그대로 보존한다.

---

# 5. Runtime Manifest

파일 경로를 `PlazaParkScene.ts` 여러 곳에 직접 하드코딩하지 않는다.

Character visual lookup을 위한 단일 manifest/helper를 만든다.

권장 개념:

```ts
type Species = 'rabbit' | 'cat' | 'fox' | 'dog' | 'tiger'
type Gender = 'male' | 'female'
type Facing = 'down' | 'left' | 'right' | 'up'

characterTexture(species, gender, facing)
```

또는 동등한 최소 구조.

목표:

```text
NPC visual identity
↓
manifest
↓
texture key / runtime PNG
```

향후 PNG 교체 시 Traffic 코드나 Gameplay 코드를 수정하지 않아도 되게 한다.

---

# 6. 현재 10 NPC Visual Assignment

현재 Limited Prototype에는 10 active movers가 존재하지만
`SmokeNpc` 자체는 현재 species / gender gameplay data를 갖고 있지 않을 수 있다.

이번 작업에서는 Traffic data model을 바꾸지 않는다.

필요하다면 **renderer-only temporary visual assignment**를 별도 helper로 둔다.

10개 visual을 한 번씩 사용하는 deterministic assignment:

```text
NPC 1  → rabbit male
NPC 2  → rabbit female
NPC 3  → cat male
NPC 4  → cat female
NPC 5  → fox male
NPC 6  → fox female
NPC 7  → dog male
NPC 8  → dog female
NPC 9  → tiger male
NPC 10 → tiger female
```

이 assignment는:

```text
temporary visual mapping
```

일 뿐이며 시민/악당/정답 label 의미를 부여하지 않는다.

금지:

```text
userLabel
aiLabel
verifiedLabel
citizen/villain truth
behaviorHistory
```

등 Gameplay 의미를 이번 task에서 추가하지 않는다.

향후 Supervised Learning NPC model이 생기면
이 renderer-only mapping은 그 데이터로 교체 가능해야 한다.

---

# 7. Direction 변경

각 NPC는 실제 이동 방향에 따라 다음 texture를 사용한다.

```text
dx > 0 → right
dx < 0 → left
dy > 0 → down
dy < 0 → up
```

중요:

- Route target만 보고 방향을 추정하지 않는다.
- 가능하면 **직전 frame position → 현재 frame position의 실제 delta**를 사용한다.
- diagonal 이동이 존재하면 absolute delta가 큰 축을 기준으로 facing을 결정한다.
- 실제 이동량이 거의 0이면 마지막 facing을 유지한다.
- 초기 facing은 `down`으로 해도 된다.

Traffic movement 자체는 변경하지 않는다.

---

# 8. Rendering

현재 임시 rectangle / circle NPC visual은
실제 Character Sprite로 교체한다.

Character:

```text
origin = bottom-center
depth = feetY
```

즉:

```ts
sprite.setOrigin(0.5, 1)
sprite.setDepth(npc.y)
```

와 동등한 semantics를 유지한다.

NPC physical footprint는 sprite 크기와 분리한다.

절대:

```text
sprite pixel size를 collision box로 사용
```

하지 않는다.

---

# 9. Visual Scale

현재 collision / Traffic size는 변경하지 않는다.

기존 `SMOKE_SIZES[n.size].visual` 등
현재 Prototype이 사용하던 visual-height 기준이 있다면
그 기준을 렌더링 scale에만 재사용한다.

원칙:

```text
원본 PNG는 수정하지 않음
runtime display scale만 사용 가능
collision footprint는 기존 값 유지
```

Species별 최종 visual scale이 아직 확정되지 않은 항목은
새 상수를 임의로 확정하지 않는다.

현재 renderer가 사용하던 visual proxy에 맞추는 최소 변경을 우선한다.

Tiger의 기존 검증된 visual height / footprint semantics는 깨지지 않게 한다.

---

# 10. Player / Tiger Probe

현재 Player / Tiger Probe가 별도로 존재하면
기존 기능을 유지한다.

이미 실제 Tiger directional texture를 사용하고 있다면
새 manifest와 중복 loader가 생기지 않게 정리할 수 있다.

단:

```text
movement
collision
door enter/exit
camera follow
debug probe
```

동작을 변경하지 않는다.

---

# 11. Traffic Known Issue 보호

현재 Traffic v1에는 장기 군집 / progress detection Known Issue가 있다.

이번 task에서 해결하지 않는다.

절대 수정하지 않을 것:

```text
src/plazaTraffic.ts movement semantics
SMOKE_ROUTES
W01~W22
collision
narrow reservation
W12 FIFO
side-step
density
spawn
```

Character Integration 전후
Traffic 결과 차이를 만들지 않는 것이 목표다.

---

# 12. Map 보호

이번 task에서:

```text
public/maps/plaza-park.tmj
```

를 수정하지 않는다.

사용자가 별도 단계에서 직접 Map을 재설계할 예정이다.

Character Visual Integration과 Map redesign을 섞지 않는다.

---

# 13. Validation

최소:

```text
npm run typecheck
npm test
npm run build
```

기존 expectation을 변경해서 테스트를 억지로 PASS시키지 않는다.

가능하면 실제 Plaza/Park를 실행해 다음을 확인한다.

```text
5 Species 모두 화면에 표시
Male / Female 각각 표시
4방향 texture 전환
bottom-center anchor
feetY Y-sort
건물/나무/벤치/램프와 depth 관계
door enter/exit 유지
10 NPC rendering
FPS에 큰 회귀 없음
```

Visual check가 자동화 환경에서 불가능하면
그 사실을 명확히 보고하고 사용자의 수동 검증 항목을 제시한다.

---

# 14. PASS / FAIL

PASS:

```text
40 individual directional PNG preload 가능
10 NPC가 actual character sprite로 표시
direction 전환 정상
collision / traffic / door 동작 변경 없음
typecheck PASS
tests PASS
build PASS
```

WARN:

```text
minor visual scale 차이
species별 최종 scale 미확정
minor pixel alignment
```

FAIL:

```text
sheet image를 runtime sprite로 사용
direction texture 잘못 연결
alpha/background 문제
collision semantics 변경
traffic semantics 변경
map 수정
door regression
build/test failure
```

---

# 15. 최종 보고

다음 형식으로 보고한다.

## 1. 변경 파일

## 2. Runtime Asset 경로
- source
- public/runtime copy
- copy된 PNG 수

## 3. Sheet 미사용 확인

```text
game_ready_sheet / game_sheet / game_sheets
runtime 사용 여부 = NO
```

## 4. Manifest 구조

## 5. 10 NPC Visual Mapping

## 6. Facing 결정 방식

## 7. Scale / Anchor / Depth 방식

## 8. Source-of-Truth 보존

```text
Traffic
Collision
Route
Waypoint
Map
Door
```

## 9. Regression

```text
typecheck
tests
build
```

## 10. Visual Validation

## 11. WARN

## 12. 최종 판정

```text
PASS
PASS with WARN
FAIL
```

보고 후 중단한다.

CCTV1 / CCTV2 또는 Map redesign으로 자동 진행하지 않는다.
