# SWfestival — Implementation Architecture Snapshot (2026-09-29)

> **기록 범위 안내 (2026-10-01)**: 아래 본문은 2026-09-29 시점의 기술 스냅샷이다. 그 뒤 Hub와 AI Basics가 구현·배포되어 본문의 `NOT IMPLEMENTED`/배포 `UNKNOWN` 표기는 현재 상태가 아니다. 현재 진입 구조와 상태는 `docs/project/project_state_current.md`, AI Basics 구현은 `docs/modules/ai_basics/module_spec.md`를 따른다.

> **Snapshot date**: 2026-09-29
> **Purpose**: 실제 repository 코드·설정을 확인해 기록한 현재 구현 상태. 계획이나 희망 구조가 아닌 실제 코드 기준.
> **Rule**: 확인되지 않은 항목은 `UNKNOWN` 또는 "현재 repository에서 확인되지 않음"으로 기록.
> **Modified source files**: NONE

---

## 1. Purpose

이 문서는 SWfestival 프로젝트의 현재 구현 상태를 다음 세션에서 즉시 이해할 수 있도록
실제 repository를 읽고 작성한 스냅샷이다.

- 게임 플레이 코드 수정 없음
- 신규 기능 추가 없음
- 아키텍처 리팩터 없음

오직 **READ + VERIFY + DOCUMENT**.

---

## 2. Runtime Environment

| 항목 | 확인된 값 | 근거 |
|---|---|---|
| 실행 환경 | 브라우저 단독 (client-side only) | 서버 코드 없음, HTML+JS only |
| 화면 방향 | Landscape (16:9) | `style.css` `.stage { aspect-ratio: 16 / 9 }` |
| 해상도 기준 | Logical 960×540 | `config.ts LOGICAL = { width: 960, height: 540 }` |
| Desktop/Mobile | Desktop 우선, 마우스 입력 중심 | `ml_prototype_technical_requirements.md §1` |
| Viewport | CSS container-query 기반 scale | `.stage { width: min(100vw, 177.777778vh) }` |
| Backend | 없음 | 서버/API 코드 없음 |
| Database | 없음 | 현재 repository에서 확인되지 않음 |
| Authentication | 없음 | 현재 repository에서 확인되지 않음 |
| Persistence | 없음 (세션 내 in-memory only) | localStorage 사용 코드 없음 |
| localStorage | 사용 안 함 | grep 결과 0건 |

---

## 3. Technology Stack

| Layer | Actual Technology | Version | Evidence |
|---|---|---|---|
| Language | TypeScript | ~5.9.2 | `package.json devDependencies`, `tsconfig.json` |
| UI Framework | React | ^19.1.1 | `package.json`, `main.tsx` `createRoot` |
| Game Engine | Phaser | 4.2.1 | `package.json dependencies` |
| Build Tool | Vite | ^7.1.3 | `package.json devDependencies`, `vite --host` script |
| Package Manager | npm | (package-lock.json 존재) | `package-lock.json` 확인 |
| Test Framework | Node.js built-in test runner | — | `package.json "test": "node --experimental-strip-types --test"` |
| Map Format | Tiled JSON (`.tmj`) | — | `public/maps/plaza-park-v2.tmj`, `plaza-park.tmj` |
| Styling | Vanilla CSS (단일 파일) | — | `src/style.css`, Tailwind 없음 |
| Type Check | `tsc --noEmit` | — | `package.json "typecheck"` script |
| Bundler | Vite (내장 rollup) | — | vite build |
| Deployment platform | UNKNOWN | — | vercel config 파일 없음 |
| JSX 설정 | `react-jsx` | — | `tsconfig.json "jsx": "react-jsx"` |
| Module | ESNext / Bundler resolution | — | `tsconfig.json "module": "ESNext"` |

### 기술 스택 역할 분리 (실제 코드 기준)

**React** (`main.tsx`):
- App 컴포넌트 (전체 orchestration)
- AriGuideOverlay (START, ROUND1_INTRO, FIRST_TRAINING_INTRO, ROUND2_INTRO, RETRAINING_INTRO, AI_ASSISTED_INTRO, FINAL_SCAN_INTRO, FINAL_ARI)
- 우측 aside panel (MANUAL_LABELING, HUMAN_AI_COMPARE, AI_ASSISTED_MONITORING)
- Tracking Review 오버레이 (DOM dialog)
- Training 애니메이션 오버레이 (FIRST_TRAINING, RETRAINING, FINAL_SCAN)
- City-Wide Result 오버레이 / Complete 화면
- Player Toolbar (CCTV 선택 버튼) / Developer Toolbar (debug 모드)

**Phaser 4** (`PlazaParkScene`, `ScaleValidationScene`, `CorridorCapacityScene`):
- 맵 렌더링 (Tilemap + 개별 Image 오브젝트)
- NPC 스프라이트 (Phaser Container: Image + Text + Ellipse)
- CCTV 구역 시각화 (Phaser Graphics)
- 카메라 제어 (Phaser Camera)
- NPC 이동 시뮬레이션 (update loop)
- 충돌 / 내비게이션 (커스텀 pure-logic)
- 디버그 시각화

---

## 4. Repository Structure

```
SWproject/
├── src/                   ← 모든 소스 코드 (TypeScript/TSX/CSS, flat 구조)
├── public/                ← Vite public (빌드 시 그대로 복사)
│   ├── maps/              ← Tiled TMJ 맵 파일
│   └── assets/            ← 런타임 URL로 로드하는 에셋
│       ├── characters/    ← NPC 스프라이트 (species/base/gender/*.png)
│       └── environment/   ← 환경 오브젝트 이미지
├── assets/                ← Vite static import용 에셋 (빌드 해시됨)
│   ├── ai/                ← fairy.png, central_ai_core.png
│   ├── characters/
│   ├── environment/
│   └── fonts/             ← Dongle, Noto_Sans_KR
├── tests/                 ← Node.js test runner용 (*.test.ts)
├── scripts/               ← 검증/측정용 .mjs 스크립트
├── docs/                  ← 프로젝트 문서
│   ├── shared/technical/
│   ├── modules/
│   ├── project/
│   ├── reference/
│   ├── validation/
│   ├── archive/
│   └── templates/
├── ai/                    ← UNKNOWN (내용 미확인)
├── artifacts/             ← UNKNOWN (내용 미확인)
├── dist/                  ← Vite 빌드 출력
├── index.html             ← HTML entry point
├── package.json
├── tsconfig.json
├── generate_map.py        ← 맵 생성 Python 스크립트
├── rebuild_map_v2.py
└── sync_layers*.py
```

---

## 5. Application Architecture

### App Entry Flow

```
index.html
  → <script type="module" src="/src/main.tsx">
    → createRoot(document.getElementById('root')).render(<App />)
      → App() [React 컴포넌트, 706줄]
        ├── useEffect: Phaser.Game 초기화
        │   ├── ScaleValidationScene (debug용)
        │   ├── CorridorCapacityScene (debug용)
        │   └── PlazaParkScene (main gameplay)
        ├── useState: flow (GameFlowState), guideStep (AriGuideStep),
        │            manual (ManualLabelingState)
        └── JSX render: 조건부 오버레이/패널
```

### Mode 분기 (URL Query Parameter)

```
/                         → Hub
?mode=ai-basics           → AI Basics
?mode=supervised          → PlazaParkScene, guideStep='START'
```

### Scene 관리

- Phaser SceneManager sleep/wake/start 전환
- 활성 Scene 항상 하나
- main gameplay: `PlazaParkScene` (mapVersion='v2')

### State 관리

| State | 관리 위치 | 타입 |
|---|---|---|
| gameplay phase (FSM) | `App` `useState<GameFlowState>` | React state |
| Ari guide step | `App` `useState<AriGuideStep>` | React state |
| Manual labeling state | `App` `useState<ManualLabelingState>` | React state (Phaser → callback) |
| NPC 위치/행동 | `PlazaParkScene` 내부 (Phaser update loop) | Phaser Scene class state |
| Round1 NPC 그룹 | `PlazaParkScene.round1: Round1Group` | Phaser Scene class field |
| Tracking history | `App` `useState<BehaviorHistoryEntry[]>` | React state |
| 전역 store/Redux/Zustand | 없음 | — |
| localStorage | 없음 | — |

---

## 6. Rendering Ownership

| 화면 요소 | 렌더링 담당 | 구현 방식 |
|---|---|---|
| 맵 타일 | Phaser | `map.createLayer()` → `this.add.image()` |
| 환경 오브젝트 | Phaser | `this.add.image()`, `this.add.tileSprite()` |
| CCTV 구역 시각화 | Phaser | `this.add.graphics()` |
| NPC 스프라이트 | Phaser | `Phaser.GameObjects.Container` |
| NPC 선택 링 | Phaser | Container 내부 `Ellipse` |
| NPC 라벨/배지 마커 | Phaser | Container 내부 `Text` |
| 충돌/경로 디버그 | Phaser | `Graphics` (debug 모드) |
| Ari 가이드 오버레이 | React DOM | `<AriGuideOverlay>` (overlay CSS class) |
| 우측 패널 | React DOM | `<aside className="manual-panel">` |
| Tracking Review 모달 | React DOM | `<div className="overlay tracking-overlay">` |
| Training 애니메이션 | React DOM + CSS | `@keyframes progressFill`, `pulseSlow/Fast` |
| Final Scan 오버레이 | React DOM + CSS | `@keyframes scanDown` |
| City-Wide Result | React DOM | result-overlay |
| Complete 화면 | React DOM | complete-overlay |
| CCTV 탭 Toolbar | React DOM | `<header className="toolbar">` |
| Ari 이미지 | React DOM `<img>` | Vite static import `../assets/ai/fairy.png` |
| Central AI Core 이미지 | React DOM `<img>` | Vite static import `../assets/ai/central_ai_core.png` |

---

## 7. Supervised Learning Implementation

### Entry

- **file**: `src/main.tsx`
- **FSM module**: `src/supervisedGameFlow.ts`
- **initial state**: `useState(createGameFlow)` — phase='MANUAL_LABELING'

### 8-state FSM (SupervisedGameState)

```
MANUAL_LABELING
  → 사용자 NPC 클릭 → CITIZEN/VILLAIN 라벨링
  → verifiedTrainingSampleCount >= 8 시 FIRST_TRAINING 가능

FIRST_TRAINING
  → doStartFirstTraining() 호출
  → setTimeout(4000ms) → completeFirstTraining() + PlazaParkScene.applyRound2()
  → 자동 전환: HUMAN_AI_COMPARE (round=2)

HUMAN_AI_COMPARE
  → Round 2 대상 8명 비교
  → 불일치 시 TRACKING_REVIEW 진입 가능
  → 모두 완료 + aiWrongVerifiedCount 기준 시 RETRAINING 가능

TRACKING_REVIEW (재사용 sub-state)
  → context: 'VERIFICATION' | 'COMPARE' | 'MONITORING'
  → 닫으면 returnPhase로 복귀

RETRAINING
  → doStartRetraining() 호출
  → setTimeout(4000ms) → completeRetraining()
  → 자동 전환: AI_ASSISTED_MONITORING

AI_ASSISTED_MONITORING
  → MONITORING_TARGET_IDS = ['NPC15', 'NPC16', 'NPC26'] 3명 확인
  → 3명 완료 시 FINAL_SCAN 가능

FINAL_SCAN
  → doStartFinalScan() 호출
  → setTimeout(4000ms) → completeFinalScan()
  → 자동 전환: COMPLETE + guideStep='CITY_WIDE_RESULT'

COMPLETE
  → guideStep: 'CITY_WIDE_RESULT' → 'FINAL_ARI' → 'COMPLETE' → 'COMPLETE_CLOSED'
```

### State 전이 방식

- `supervisedGameFlow.ts` pure function이 `GameFlowState` 객체 직접 mutation
- `App.tsx`: `setFlow(f => { fn(f); return { ...f }; })` 패턴으로 React re-render
- Training 단계: `setTimeout` 4000ms 고정 딜레이

### AriGuideStep (별도 React state)

```typescript
type AriGuideStep =
  | 'START' | 'ROUND1_INTRO' | 'FIRST_TRAINING_INTRO'
  | 'ROUND2_INTRO' | 'RETRAINING_INTRO' | 'AI_ASSISTED_INTRO'
  | 'FINAL_SCAN_INTRO' | 'CITY_WIDE_RESULT' | 'FINAL_ARI'
  | 'COMPLETE' | 'COMPLETE_CLOSED' | null
```

### Round 구조

| Round | NPC 수 | 특징 | 구현 파일 |
|---|---|---|---|
| Round 1 | 35명 | MANUAL_LABELING 단계, 5 CCTV 구역 | `plazaRound1.ts`, `ROUND1_SCENARIO` |
| Round 2 | 35명 (pool 재사용) | HUMAN_AI_COMPARE 단계, AI 예측 포함 | `plazaRound2.ts`, `ROUND2_COMPARISON_PLAN` |

Round 전환: Map reload 없이 `PlazaParkScene.applyRound2()` 호출.

### AI 예측 데이터 (하드코딩)

```
ROUND2_COMPARISON_PLAN (8명):
  NPC08: AI=CITIZEN (WRONG - 실제 VILLAIN)
  NPC10: AI=CITIZEN (CORRECT)
  NPC18: AI=CITIZEN (CORRECT)
  NPC20: AI=VILLAIN (WRONG - 실제 CITIZEN)
  NPC23: AI=CITIZEN (CORRECT)
  NPC27: AI=CITIZEN (WRONG - 실제 VILLAIN)
  NPC31: AI=VILLAIN (CORRECT)
  NPC06: AI=VILLAIN (CORRECT)

MONITORING_TARGET_IDS: ['NPC15', 'NPC16', 'NPC26']
```

---

## 8. Map / Navigation / Collision

### Map 파일

| 항목 | 값 | 근거 |
|---|---|---|
| 메인 맵 (gameplay) | `public/maps/plaza-park-v2.tmj` | `PlazaParkScene.preload()` mapVersion='v2' |
| 구형 맵 | `public/maps/plaza-park.tmj` | mapVersion='v1' |
| 맵 크기 | 96×56 tiles | PlazaParkScene 내 루프 상수 `x < 96, y < 56` |
| Tile 크기 | 32×32 px | `config.ts TILE_SIZE = 32` |
| Map format | Orthogonal Tiled JSON | PlazaParkScene 로드 방식 |

> **불일치 기록**: `config.ts WORLD_SIZE = { width: 48*32, height: 32*32 }`(48×32 tiles)는 ScaleValidationScene 전용 상수. PlazaParkScene 실제 맵은 96×56 tiles.

### 레이어 구조

```
Ground               - 타일 기반 지형 (렌더링 후 invisible, 개별 Image로 대체)
Ground_Detail        - 꽃 등 디테일 타일
Collision            - 충돌 오브젝트 레이어
Navigation           - Waypoint (구형 v1 전용)
Navigation_v2        - 내비게이션 노드 (점)
Navigation_Edges_v2  - 내비게이션 엣지
Navigation_Edges_Lanes_v2 - 레인 정보
Object_Base          - 빌딩, 나무, 벤치, 램프, 맨홀, 펜스
Camera_Zone          - CCTV 구역 5개 (PLAZA_CAM_A~E)
Interaction          - 상호작용 구역
```

### CCTV 구역

```
PLAZA_CAM_A, PLAZA_CAM_B, PLAZA_CAM_C, PLAZA_CAM_D, PLAZA_CAM_E
```

- `cctvManualLabeling.ts loadCameraZones()` 로 TMJ에서 로드
- 각 구역: `{ name, x, y, width, height }` — Coverage 오브젝트
- 판정: `isInsideCameraZone(position, zone)` — point-in-rect

### Navigation V2

- 그래프: `NavigationGraph { nodes: Map, edges: [], adjacency: Map }`
- 경로 탐색: `findNavigationPath()` — Dijkstra (거리 최소화)
- 레인: `PlazaLaneRuntime` — 양방향 레인, Stop Point reservation/defer
- NPC 이동 속도: walkSpeed=96px/s, runSpeed=144px/s
- 충돌 판정: footprint AABB (커스텀, Phaser physics 미사용)
- NPC footprint: 26×16 px
- Architecture clearance (Large Species): halfWidth=30, above=56, below=8

### Debug 시각화

- 충돌 오브젝트: 빨간색 outline
- Interaction 구역: 청록색 outline
- Navigation waypoint: 흰색 점 + 이름
- Navigation 레인: 파란/핑크 선
- CCTV 구역: 반투명 color fill + outline (항상 표시)
- NPC 디버그: `toggleDebug()` on/off

---

## 9. Asset Pipeline

### Vite Static Import (빌드 해시 적용)

```typescript
// src/main.tsx
import fairyImg from '../assets/ai/fairy.png';           // Ari 캐릭터 (174KB)
import centralAiCoreImg from '../assets/ai/central_ai_core.png'; // AI 코어 (756KB)
```

빌드 시 Vite가 content hash를 붙여 번들링.

### Public URL 방식 (Phaser runtime load)

```typescript
// PlazaParkScene.preload()
this.load.tilemapTiledJSON('plaza-park', '/maps/plaza-park-v2.tmj');
this.load.svg('graybox', '/maps/graybox.svg');
this.load.image(key, '/assets/environment/...');
this.load.image(texture, '/assets/characters/...');
```

- NPC 스프라이트 경로: `/assets/characters/{species}/base/{gender}/{species}_{gender}_{facing}.png`
- 5 species × 2 genders × 4 facings = 40개 NPC 이미지 로드

### 캐릭터 에셋 구조

```
species: rabbit, cat, fox, dog, tiger
gender: male, female
facing: down, left, right, up

예: /assets/characters/rabbit/base/female/rabbit_female_down.png
```

- Sprite sheet 없음 (개별 PNG)
- 걸음 애니메이션: **NOT IMPLEMENTED** (4방향 정지 이미지만)

### Font

- `assets/fonts/Dongle/` — `.dongle-font` CSS class
- `assets/fonts/Noto_Sans_KR/` — `.noto-font` CSS class

---

## 10. Styling / Animation

### UI 스타일링

- Vanilla CSS 단일 파일 (`src/style.css`, 1033줄)
- 단위: `cqw` (container query width unit, `.stage`가 container)
- 기본 폰트: `system-ui, sans-serif`
- 커스텀 폰트: `.dongle-font`, `.noto-font`, `.ari-font`
- Tailwind: **사용 안 함**

### CSS Animations (@keyframes 확인됨)

```
@keyframes fadeIn            — 오버레이 등장
@keyframes pulseSlow         — AI 코어 pulse (FIRST_TRAINING)
@keyframes pulseFast         — AI 코어 pulse 빠름 (RETRAINING)
@keyframes progressFill      — 학습 progress bar
@keyframes subtlePulse       — 미세 pulse
@keyframes scanDown          — FINAL_SCAN 스캔 라인
@keyframes blink             — 점멸
@keyframes packet-enter-left — data packet 애니메이션
@keyframes packet-enter-right
```

### NPC / Game Animation

- NPC 방향 전환: texture key 교체 (`setTexture`)
- NPC 이동: Phaser update loop에서 position 직접 업데이트 (tween 없음)
- 걸음 애니메이션: **NOT IMPLEMENTED**
- Phaser tween: **NOT IMPLEMENTED**

### Cutscene Animation

- FIRST_TRAINING / RETRAINING: React DOM + CSS animation
- FINAL_SCAN: React DOM + CSS animation (`@keyframes scanDown`)
- Phaser 기반 cutscene: **NOT IMPLEMENTED**

---

## 11. State Management

### React useState (App 컴포넌트)

```typescript
const [flow, setFlow]                   // GameFlowState — 8-state FSM
const [guideStep, setGuideStep]          // AriGuideStep — Ari 가이드 흐름
const [trackingHistory, setTrackingHistory] // BehaviorHistoryEntry[] — NPC 행동 히스토리
const [manual, setManual]               // ManualLabelingState — Phaser → React push
const [controls, setControls]           // Controls — debug 전용
const [stats, setStats]                 // Stats — debug 전용
```

### Phaser Scene class state (PlazaParkScene)

```typescript
private round1: Round1Group | null
private cameraZones: readonly CameraZone[]
private selectedCctv: CameraZone | null
private selectedCharacterId: CharacterId | null
private currentRound: 1 | 2
private manualStateSignature: string    // dirty check용
```

### 사용하지 않는 것

- Zustand / Redux / MobX: **없음**
- Context API: **없음**
- 전역 store: **없음**
- localStorage: **없음**

### Phaser → React 연결 방식

```
PlazaParkScene.reportManual(state: ManualLabelingState) → App.setManual(state)
PlazaParkScene.report(string) → App.setPlazaStats(string)
```

생성자 인자로 callback 전달 (의존성 주입).  
update loop에서 state signature 변화 시 callback 호출.

---

## 12. Navigation / Routing

### URL-based Mode 분기

```
/                         → Hub
?mode=ai-basics           → AI Basics
?mode=supervised          → 지도학습 (plaza-park-v2)
```

- React Router: **사용 안 함** (dependency 없음)
- SPA routing: **없음**
- 단일 URL, production `mode` query parameter로 모듈 구분

### Scene 간 전환

- Phaser `SceneManager.sleep()` / `wake()` / `start()` 사용
- DOM routing 아님

### Hub (모듈 간 내비게이션)

**NOT IMPLEMENTED** — 현재 단일 supervised learning 모듈만 존재

---

## 13. Build / Deployment

### npm scripts

```
"dev":       "vite --host 127.0.0.1"
"typecheck": "tsc --noEmit"
"build":     "npm run typecheck && vite build"
"preview":   "vite preview --host 127.0.0.1"
"test":      "node --experimental-strip-types --test tests/*.test.ts"
```

### 빌드 설정

- `vite.config.*` 파일 없음 → Vite default 설정
- Output: `dist/` (Vite default)
- `assets/` (Vite static import): hash 붙음
- `public/`: hash 없이 그대로 복사

### Deployment

**Platform: UNKNOWN**
- `vercel.json` 없음, `.vercelignore` 없음
- vercel 관련 파일 전혀 없음
- 현재 repository에서 deployment platform 확인 불가

---

## 14. Testing / Validation

### Test 파일 (tests/, 13개)

```
candidateRoutes.test.ts
cctvManualLabeling.test.ts
collision.test.ts
corridor.test.ts
fullFlowHarness.test.ts          (20771바이트 — 대형 테스트)
plazaJunctionStopReservation.test.ts
plazaLaneRuntime.test.ts
plazaPark.test.ts
plazaRound1.test.ts
plazaTraffic.test.ts
supervisedConcurrency.test.ts
supervisedGameFlow.test.ts
supervisedRuntime.test.ts
```

### Test 실행

```bash
npm test
# node --experimental-strip-types --test tests/*.test.ts
```

- Framework: Node.js 내장 test runner (Jest/Vitest 없음)
- Browser test: **없음** (Playwright/Cypress 등 없음)

### 검증 스크립트 (scripts/)

```
validate-plaza-park-navigation-v2.mjs
validate-plaza-supervised-concurrency.mjs
measure-plaza-*.mjs
generate-plaza-park.mjs
```

---

## 15. Frozen / Stable Areas

`plazaRound2.ts` 상단 주석에 명시:

```
FROZEN: plazaRound1.ts / plazaLaneRuntime.ts / plazaNavigationV2.ts / characterPool.ts
```

안정화 완료된 모듈 (코드+문서 기준):

| 파일 / 모듈 | 내용 |
|---|---|
| `plazaRound1.ts` | Round 1 시나리오, `ROUND1_SCENARIO` |
| `plazaLaneRuntime.ts` | 레인 런타임, Stop Point reservation |
| `plazaNavigationV2.ts` | Navigation v2 그래프, Dijkstra |
| `characterPool.ts` | `CHARACTER_POOL`, 모든 타입 정의 |
| `cctvManualLabeling.ts` | CCTV 구역 로드, 라벨링 함수 |
| `collision.ts` | AABB 충돌 판정 |
| `characterManifest.ts` | Species/Gender/Facing 타입 |
| `supervisedGameFlow.ts` | 8-state FSM (완전 구현) |
| `plazaRound2.ts` | Round 2 시나리오, `ROUND2_COMPARISON_PLAN` |
| `public/maps/plaza-park-v2.tmj` | v2 승인된 맵 |
| Round 1 Gameplay | MANUAL_LABELING, FIRST_TRAINING 구현 완료 |
| Round 2 Gameplay | HUMAN_AI_COMPARE → COMPLETE 전 단계 구현 완료 |

---

## 16. Known Limitations

| 항목 | 상태 |
|---|---|
| NPC 걸음 애니메이션 | NOT IMPLEMENTED (4방향 정지 이미지만) |
| Phaser tween | NOT IMPLEMENTED |
| Hub (모듈 선택 화면) | NOT IMPLEMENTED |
| AI Basics 모듈 | NOT IMPLEMENTED |
| 비지도학습 모듈 | NOT IMPLEMENTED |
| 강화학습 모듈 | NOT IMPLEMENTED |
| 모바일 / 터치 지원 | NOT IMPLEMENTED |
| 오디오 (BGM / 효과음) | NOT IMPLEMENTED |
| Phaser 기반 cutscene | NOT IMPLEMENTED (React DOM 오버레이로 대체) |
| Persistence (세션 간 저장) | NOT IMPLEMENTED |
| Backend / API | NOT IMPLEMENTED |
| 상점가 맵 | NOT IMPLEMENTED |
| 주거지역 맵 | NOT IMPLEMENTED |
| Shopping District CCTV 3/4 | NOT IMPLEMENTED |
| Residential Area CCTV 5 | NOT IMPLEMENTED |
| NPC Side-step / Personal Spacing | NOT IMPLEMENTED |
| Final Scan 수백 명 실제 렌더 | CSS animation 연출 (실제 수백 Phaser 오브젝트 아님) |
| Deployment 자동화 | 현재 repository에서 확인되지 않음 |

---

## 17. Requirement vs Actual

참조 문서: `docs/shared/technical/ml_prototype_technical_requirements.md`

| # | Requirement | Actual | Status |
|---|---|---|---|
| 1 | React + TypeScript + Vite | React 19.1.1 + TypeScript 5.9.2 + Vite 7.1.3 | MATCH |
| 2 | Phaser 4 | Phaser 4.2.1 | MATCH |
| 3 | Tile Size 32×32 | `TILE_SIZE = 32` in config.ts | MATCH |
| 4 | Orthogonal Tilemap | plaza-park-v2.tmj Orthogonal | MATCH |
| 5 | PC 브라우저 우선, 마우스 중심 | 브라우저 전용, pointer 이벤트 | MATCH |
| 6 | Landscape, 1920×1080급 | 16:9 aspect ratio, logical 960×540 | MATCH |
| 7 | Top-down 2.5D, Pixel Art | `pixelArt: true`, depth-based sorting | MATCH |
| 8 | 5 CCTV, PLAZA_CAM_A~E | 구현 완료 | MATCH |
| 9 | Round 1/2 각 35 NPC | ROUND1_SCENARIO 35개, ROUND2 재사용 | MATCH |
| 10 | 상태 관리 "미확정" | React useState + plain object mutation | MATCH (미확정 → 결정됨) |
| 11 | 애니메이션 Frame 수 "미확정" | 4방향 정지 이미지 | PARTIAL |
| 12 | Sprite Sheet Packing "미확정" | 개별 PNG | PARTIAL |
| 13 | 효과음 필수 | 오디오 없음 | NOT IMPLEMENTED |
| 14 | Cutscene (게임 에셋 재사용) | React DOM 오버레이 + CSS animation | PARTIAL |
| 15 | Final Scan 수백 명 시각 연출 | CSS animation grid | PARTIAL |
| 16 | Tracking Review (텍스트 기반) | BehaviorHistoryEntry 목록 | MATCH |
| 17 | Round 1→2 Scenario Round Reset | `applyRound2()` (Map reload 없이) | MATCH |
| 18 | NPC Side-step "미확정" | 없음 | NOT IMPLEMENTED |
| 19 | 강화학습 5개 Simulation | NOT IMPLEMENTED | NOT IMPLEMENTED |
| 20 | 비지도학습 홀로그램 45~50명 | NOT IMPLEMENTED | NOT IMPLEMENTED |
| 21 | 3-Zone 전체 맵 | 광장·공원만 구현 | PARTIAL |
| 22 | Hub | NOT IMPLEMENTED | NOT IMPLEMENTED |
| 23 | 세션 내 진행 유지 | React state + Phaser runtime (in-memory) | MATCH |
| 24 | 로그인/DB/클라우드 제외 | 완전히 없음 | MATCH |

### 주요 불일치

**`ml_prototype_technical_requirements.md §21` 마지막 단락**:
> "다음 단계는 FIRST_TRAINING verification interaction 설계이며, FIRST_TRAINING 이후 flow와 Round 2는 아직 구현되지 않았다."

**실제 코드**:
> Round 2 전체 (HUMAN_AI_COMPARE → TRACKING_REVIEW → RETRAINING → AI_ASSISTED_MONITORING → FINAL_SCAN → COMPLETE) 이미 구현 완료.

**Status: DIFFERENT** — 문서가 구형 상태. 실제 코드가 최신.

---

## 18. Quick Reference

| Item | Current Implementation |
|---|---|
| Runtime | Browser-only, client-side, no server |
| Language | TypeScript ~5.9.2 |
| UI Framework | React 19.1.1 (JSX, hooks, useState) |
| Game Engine | Phaser 4.2.1 |
| Build Tool | Vite 7.1.3 |
| Package Manager | npm |
| Map Format | Tiled JSON (.tmj), Orthogonal, 32×32 tile |
| Map File (gameplay) | `public/maps/plaza-park-v2.tmj` |
| Logical Resolution | 960×540 |
| Aspect Ratio | 16:9 |
| Deployment | UNKNOWN |
| State Management | React useState + plain object mutation FSM |
| Current Module | Supervised Learning (완전 구현) |
| Next Module | NOT IMPLEMENTED (Hub, AI Basics, Unsupervised, RL) |
| Testing | Node.js built-in test runner (`npm test`) |
| Audio | NOT IMPLEMENTED |
| Persistence | None (in-memory session only) |

### 새 모듈 구현 전에 반드시 확인할 파일

```
package.json                      — 실제 dependency 버전
src/main.tsx                      — App 전체 구조, GameFlowState, AriGuideStep
src/supervisedGameFlow.ts         — 8-state FSM (참조 모델)
src/config.ts                     — TILE_SIZE, LOGICAL, SPEED 등 전역 상수
src/characterPool.ts              — CHARACTER_POOL, 모든 타입 정의
src/plazaRound1.ts                — Round 시나리오 패턴
src/PlazaParkScene.ts             — Phaser Scene 구조, NPC 관리
src/cctvManualLabeling.ts         — CCTV 구역 타입 정의
src/style.css                     — UI 스타일 전체 (cqw 단위 주의)
public/maps/plaza-park-v2.tmj     — 맵 데이터
docs/shared/technical/ml_prototype_technical_requirements.md
```

### 다음 세션 주의사항

1. `ml_prototype_technical_requirements.md §21` 마지막 단락 ≠ 실제 코드 → **실제 코드가 진실**
2. `config.ts WORLD_SIZE`는 ScaleValidationScene 전용; PlazaParkScene 실제 맵은 96×56 tiles
3. `assets/ai/` 이미지 — Vite static import (`'../assets/ai/...'` 경로)
4. 환경/캐릭터 에셋 — Phaser `this.load.image(key, '/assets/...')` (public URL)
5. Cat Female NPC는 4방향 걸음 애니메이션, 나머지 NPC는 정적 방향 전환 사용
6. 지도학습은 `?mode=supervised`에서 Plaza gameplay 시작 (START 화면부터)
