# Plaza & Park Graybox 검증 결과

## 재개 상태

최신 map_plaza_park_spec.md를 기준으로 이미 생성된 맵과 코드를 이어받았다.
맵 재생성, 좌표 수정, 기존 결과 덮어쓰기는 하지 않았다.
작업 폴더에 .git이 없어 git diff 대신 현재 파일 내용을 확인했다.
이전 preflight는 최신 설계를 대체하지 않는다.

이어받은 파일:
- public/maps/plaza-park.tmj, public/maps/graybox.svg
- scripts/generate-plaza-park.mjs
- src/PlazaParkScene.ts, src/plazaPark.ts
- src/main.tsx, src/style.css
- src/ScaleValidationScene.ts (Tiger import 4줄)
- tests/plazaPark.test.ts

이번 재개에서 추가한 파일은 이 결과 문서다. Tiger import는 이미
assets/characters/tiger/base/male/tiger_male_{down,left,right,up}.png로 수정되어 있었다.
재개 후 최종 build에서 네 PNG가 모두 출력되고 브라우저에서 Tiger 표시도 확인했다.

## 실행 / Tiled 파이프라인

`npm run dev` → http://127.0.0.1:5173/ → **Plaza & Park**.
Tiled에서 public/maps/plaza-park.tmj를 열 수 있는 JSON 형식으로 작성했다.
인접 graybox.svg는 단순 8색 검증용 타일 이미지다. Tiled 데스크톱 직접 열기는 미검증이다.
브라우저에서는 Phaser load.tilemapTiledJSON → make.tilemap → addTilesetImage → createLayer로 로드한다.

| Layer | Tiled type | 역할 |
|---|---|---|
| Ground | tilelayer | Grass, Park, Main/Narrow Path, Plaza, Route |
| Ground_Detail | tilelayer | 충돌 없는 Flower 색 타일 |
| Object_Base | objectgroup | 건물/벤치/나무/덤불/램프/울타리/맨홀/문 표시 |
| Foreground | objectgroup | 나무 수관·램프 상부, foot-Y depth |
| Collision | objectgroup | 실제 고정 충돌 영역 |
| Navigation | objectgroup | Zone/Path/Approach/DoorOpening 및 W01~W22 point |
| Interaction | objectgroup | 문 Trigger, Bench, Manhole |
| Camera_Zone | objectgroup | CCTV1, CCTV2, Overlap |

맵96×56, tile32×32, world3072×1792. 기존 logical viewport960×540보다 넓다.
각 Scene은 별도 world 크기를 사용하며 기존 Scale 크기를 바꾸지 않았다.
Spawn layer 없이 W01에서 시작한다. Footprint26×16 Debug Character를 사용한다.
이것은 Tiger 80px Sprite 및 Large 시각 여유 검증이 아니다. 기존 Tiger 여유 상수는 유지했다.
이동은 기존 collision.ts AABB 함수를 사용하며 작은 축별 substep으로 검사한다.
Navigation은 의미/위치 데이터이며 Collision 이외의 잔디도 이동 가능하다.
실내 및 Enter 후 소멸/재등장 행동은 구현하지 않았다.

Waypoint jump는 점검용 순간이동이다. 이 조작 자체를 경로 연결성 증거로 취급하지 않았다.
연결성은 테스트에서 별도로 4px 구간 샘플을 검사하는 flood fill로 확인했다.
이 탐색은 테스트 전용이며 게임 runtime에 Pathfinding을 추가하지 않았다.

## 자동 검사 — PASS

최종 Tiger import 상태에서 `npm run build`(typecheck 포함), `npm test` 재실행 성공.
기존 Scale4 + Corridor5 + Graybox5 = **14/14 PASS**.
lint script 없음: **lint 미설정**.
Build warning: 기존 Phaser 포함 JS1,638.20kB / gzip451.19kB, 500kB chunk 경고.

Graybox 검사는 다음을 확인했다.
- 맵 크기, 8개 Layer, 고정 Zone/Path/Connector/Opening/Approach 좌표.
- Tree6/Bush8/Lamp10/Bench7/Fence4 위치와 충돌; Bench3×1.
- Flower 타일 이동 가능, Open Core 고정 충돌 없음, Manhole 위치.
- W01~W22의 정확한 tile 중심 좌표, 충돌 비포함, North Entry에서 전부 연결.
- Cafe 동쪽/Facility 남쪽 개구부 안으로 실제 moveProbe 이동 및 내부 차단.
- 큰 delta에서도 50ms clamp / <=4px substeps로 관통하지 않음.

## CCTV — PASS (데이터 + 브라우저 표시)

| 영역 | inclusive tiles | pixel rectangle x/y/w/h |
|---|---|---|
| CCTV1 | X0~52 Y0~30 | 0 / 0 / 1696 / 992 |
| CCTV2 | X18~95 Y16~55 | 576 / 512 / 2496 / 1280 |
| Overlap | X18~52 Y16~30 | 576 / 512 / 1120 / 480 |

교집합 계산을 별도로 검사했다. 브라우저에서 W01은 CCTV1,
W09/W12는 CCTV1+CCTV2+Overlap, W17/W19는 CCTV2로 표시된다.
파랑/주황/보라 오버레이 표시와 ON/OFF 확인. CCTV 카메라 게임 기능은 없다.

## 브라우저 실제 관측

Phaser 맵 로딩, Debug Character, Follow, Overview, 오브젝트/Waypoint marker 표시 확인.
아래 수치는 실제 키 입력 또는 명시한 점검 이동에서 읽은 값이다.

| 항목 | 관측 / 검사 범위 |
|---|---|
| North 진입 | W01 (1520,80)에서 Down → (1520,125) |
| Main Walkway | W03 (976,368)에서 Right → (1072,368), 이후 Tree 접근 이동 |
| Upper Narrow | W02 (848,176)에서 왼쪽으로 경로 및 잔디 이동 |
| Lower Narrow | W09 (1552,528) → (1576,528) |
| Park→Plaza | W12 (1552,720)에서 Down → (1552,819), Plaza Y25 진입 |
| Main Route | W20 (1552,1680)에서 Right → (1597,1680) |
| West/East Exit | W21(48,1680), W22(3024,1680) 점검 이동·좌표 확인; 전체 연결은 자동 검사 |
| Cafe | W17에서 Left → (623,1296), opening X19 안으로 진입, 내부 차단 |
| Facility | W18에서 Up → (2704,520), opening Y16 진입, 내부 차단 |
| Bench A | W04(368,336)에서 Left → x365 정지 |
| Tree T5 | x1168에서 Up → y299 정지, 추가 Up에도 유지 |
| Flower | (725,137), tile(22,4) Flower 영역 안으로 이동 |
| Manhole | W11에서 Right → (2363,592), tile(73,18), Interaction Manhole |
| Waypoints | 22개 모두 UI 점검 이동과 표시 좌표 확인, 자동 검사로 충돌 비포함 확인 |

Plaza→Main Route의 전 구간 연속 수동 주행은 미실행이다. 연결성은 자동 검사 PASS이며,
브라우저에서는 Plaza/Route 구간을 각각 검사했다. 순간이동과 연속 주행 결과를 구분한다.

## 기존 Scene 회귀 / 한계

Scale: Scene READY, Tiger80/26×16 표시, W로 (640,480)→(640,447),
NPC35 선택, Zoom1.25, Gameplay75/25 화면 확인. 기존4개 충돌 테스트 PASS.
Corridor: A~D 자동120초 검사 PASS(실험 A 교착은 기존 결과 그대로).
브라우저 C에서98.1초 / 도착52 / 최장대기1.6초 / events296 / 무전진0초 / FPS61 확인.
과거 Scale/Corridor 결과 문서는 수정하지 않았다.

Graybox 관측 FPS 약60~61. 최종 브라우저 console error/warn 로그는 빈 배열이었다.
Tiled JSON/색 타일과 Tiger 이미지 로딩 성공, 관측된 로딩 오류 없음.
장시간 성능, 30~35명 새 맵 Flow, Tiger/Large clearance의 새 맵 적합성은 미검증이다.
전체 보기에서는 label이 작고 상단 일부는 Toolbar에 가려진다. Follow 및 Waypoint 점검으로 확인 가능하다.
이 화면은 최종 맵/UI가 아니며 좌표는 임의 보정하지 않았다.

## 다음 단계

사용자가 Follow/Overview와 W01~W22 점검으로 구조를 검토한다.
그다음 별도 범위에서 Large 시각 여유/문턱 접근 및 제한된 NPC Flow를 검증한다.
Final Art, ML State, Shopping/Residential, Animation 확장은 이번 단계에 포함하지 않는다.
Generator 재실행은 Tiled 수작업 수정 파일을 덮어쓰므로, 직접 편집 후에는 별도 보존 없이 재실행하지 않는다.
