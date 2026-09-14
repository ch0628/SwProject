# ScaleValidationScene 구현 검증 — 2026-09-12

## Corridor Capacity 추가 검증

기존 Scale 규칙 변경 없이 A~D Debug Scene을 추가했다.
조건별 관측과 한계는 [Corridor Capacity 결과](corridor_capacity_results.md)에 기록한다.
3-tile / 4-tile의 최종 Standard는 미결정이다.

## 후속 반영: 승인된 Scale / Wall Clearance

아래 내용은 기존 첫 검증 기록보다 우선합니다. Tiger **80px는 Large Species 기준으로 승인**되었습니다.
공공 Bench는 **96×32px (3×1 tile)**, 공공 입구 최소 폭은 **64px**입니다.

### 변경 파일

- `src/config.ts`: 승인값, Bench 크기, Large 접근 여유, wall 확인 위치.
- `src/collision.ts`: 발 기준 Navigation 영역 계산.
- `src/npcMotion.ts`: 작은 patrol 이동, 경로 구간 충돌 검사와 대기 시 시간 정지.
- `src/ScaleValidationScene.ts`: 구조물 분류, 별도 접근 여유 검사, Bench·NPC 반영.
- `src/main.tsx`: 기존 Debug 범례에 보라색 벽 여유 표기만 추가.
- `tests/collision.test.ts`: Clearance·출입구·NPC 대기/재개·35명 비관통 테스트.
- `docs/map_scale_validation_spec.md`, `README.md`, 이 파일: 승인값과 검증 기록.

### Wall Clearance 구현

- 발 충돌은 기존 **26×16** 유지. NPC/나무/벤치/램프는 이 Footprint만 사용.
- `architecture`로 표시한 벽·건물·길 경계·울타리에만 별도 Navigation AABB 검사.
- `ARCHITECTURE_CLEARANCE.large`: 발에서 좌우 **30px**, 위 **56px**, 아래 **8px**.
  렌더 Sprite나 Physics Body를 확대하지 않으며 방향/비교 높이에 따라 흔들리지 않음.
- Debug 보라색 = 접근 여유, 노란색 = 실제 Footprint. 기존 축별 이동·슬라이딩 유지.
- 64px 입구/통로는 통과 가능. 60px 폭 Clearance라 중심 정렬 여유는 총4px이며 체감은 재확인 대상.
- **32px testDoor는 일반 공공 입구가 아니며 현재 Large 진입은 제한됨.**
  별도 Door Permission System은 만들지 않음. 접근 여유가 캐릭터 규격 상수로 분리되어
  향후 Size Class별 조정 및 문별 추가 접근 검사와 충돌하지 않음.

### 후속 검증 결과

| 검증 | 결과 | 근거 |
|---|---|---|
| typecheck / build | PASS | `npm run build`에 typecheck 포함, 성공 |
| 기존 + 추가 테스트 | PASS | `npm test` 4/4 통과 |
| Wall 접근 | PASS | 실제 좌측 키 입력에도 x158 유지(벽 우측128 + 여유30), 좌/하 방향 몸체가 벽 밖에 표시 |
| Public entrance | PASS | 실제 W/Up으로 (288,440) → (288,323), 64px 문 통과 |
| Narrow path | PASS | 실제 Up으로 (1120,400) → (1120,361), 64px 통로 진입 |
| Bench 3×1 | PASS | 실제 화면에서 3개 grid 폭과 96×32 label, 상수 단언 |
| 이동/4방향/80px/Footprint | PASS | W/A/S/D 및 화살표, 화면·좌표·방향 확인. 80px, 26×16 유지 |
| Y-depth / Object occlusion / Camera | PASS | 나무 앞에서 노출, (608,688)에서 수관 뒤 가림, 이동 시 카메라 추종 |
| Zoom / Layout / Debug | PASS | 1 ↔ 1.25, Full ↔ Gameplay, Debug ON/OFF 왕복 |
| NPC 12 / 24 / 35 / 선택 | PASS | 실제 전환·운동·일시정지, 1번 클릭 → selected 1 |
| NPC끼리 비관통 | PASS (자동 테스트) | 35명 1,200 step / 60초 simulation에서 매 step의 쌍별 footprint 비겹침 확인 |
| Tiger에 막힌 NPC 대기/재개 | PASS (자동 테스트) | 막힌 1,000 step 동안 위치·시간 고정, 장애 제거 후 1px 미만 이동으로 재개 |
| Console error | PASS | 최종 검증 탭 error/warn 로그 빈 배열 |
| 성능·브라우저 도구 | WARN | 새 검증 탭 약60FPS. 오래 열린 탭에서 저하·도구 timeout 재발, 새 탭으로 기능 검증 완료. 원인 확정/장시간 성능 판정 미수행 |
| Build 경고 | WARN | 기존 Phaser 포함 약1.62MB chunk 크기 경고 유지 |

### 직접 재확인할 항목

- `wall`: 벽 옆 여유와 건물 각 면의 체감 거리.
- `doors` / `narrow`: 중앙 정렬 여유가 좁아 답답하지 않은지. 필요 시 Large 상수만 조정.
- `objects`: 3×1 공공 Bench 비율.
- `density`: 실제 키보드로 NPC 길을 막고 기다렸다가 비켜줄 때 대기·재개 체감.
- 실제 Chrome에서 장시간 FPS. Tiger 80px 자체는 재승인 대상으로 돌리지 않음.

---

## 최초 검증 기록 (후속 승인 이전)

## 결과

기능 검증 PASS. 성능 및 최종 체감 Scale은 WARN / 사용자 검토 대기.
최종 Map Scale의 승인으로 간주하지 않습니다.

| 항목 | 결과 | 관측 / 근거 |
|---|---|---|
| TypeScript | PASS | `npm run typecheck` (build 포함) |
| Production build | PASS / WARN | 빌드 성공, Phaser 포함 JS 약 1.62MB / gzip 447KB의 chunk size 경고 |
| Collision test | PASS | `npm test`: 발 중앙, 32px 문 여유, 벽 접촉·겹침, world 경계 |
| Lint | N/A | 기존 Skeleton 및 lint 설정 없음 |
| 실제 Scene load / asset load | PASS | Codex Chromium 계열 브라우저, 4 PNG 렌더 확인 |
| WASD / arrows / 4방향 | PASS | 실제 키 입력과 위치·방향 표기, 화면 텍스처 확인 |
| Camera follow | PASS | 캐릭터 위치 변화 시 배경 이동, world 가장자리 제한 |
| Collision | PASS | 나무 x≈641에서 위로 이동 시 y≈730에서 정지, 밑동 영역 진입하지 않음 |
| Public entrance | PASS | x288, y440 → y329 이동. 문틀 foreground 가림 확인 |
| Test door | PASS | x400, y440 → y350 이동. 32px 틈에 26px footprint 통과 |
| Narrow path | PASS | x1120, y400 → y340, 64px 통로 진입 |
| Anchor / depth / occlusion | PASS | bottom-center, foot-Y sorting, 나무 뒤에서 수관 가림·앞에서 캐릭터 노출 |
| Zoom | PASS | 1.0 ↔ 1.25와 화면 확대 확인 |
| Height comparison | PASS | 72 / 80 / 88 선택, 기본값 80 |
| NPC density / selection | PASS | 12 / 24 / 35 전환·간단한 이동, 클릭 오프셋 수정 후 1번 클릭 → 1번 선택 |
| Full / Gameplay | PASS | 960×540 canvas, Gameplay camera 720×540, 오른쪽 패널 25% |
| 1920×1080 | PASS | DOM stage 1920×1080, panel x1440 width480; 전체 화면 스크린샷 확인 |
| Resize | PASS | 960×540 및 비 16:9 창에서 stage 비율 유지·letterbox 확인 |
| Debug toggle | PASS | grid / collision / anchor / NPC bounds ON/OFF 확인 |
| Console | PASS | 관측된 browser error/warn 없음, 에셋 로드 오류 없음 |
| Cleanup | PASS (코드 확인) | React unmount 시 game destroy, window error / game ready listener 제거, Scene shutdown 시 key 제거. 반복 reload 정상. Scene stop/start 별도 자동 테스트는 미실행 |
| FPS | WARN | 새 탭에서 58~61FPS 수준, 일부 46~53FPS; 오래 열린 탭에서 1~2FPS까지 감소 후 새 탭에서 약60FPS 회복. 탭 실행 제한 영향 추정이며 원인 확정·일반 Chrome 장시간 측정은 미완료 |

## Placeholder / 검증 한계

- 맵, 건물, 문틀, 나무, 벤치, 램프, 벽은 단순 도형.
- NPC는 도형이며 단순 국소 운동. 통로 교행 AI, pathfinding 없음.
- 패널은 공간 점유용. 실제 CCTV/ML UI 없음.
- 35 NPC에서 어깨·몸 겹침이 보임. Gameplay + 1.25는 world coverage가 줄어
  일부 가장자리 NPC가 화면 밖에 있을 수 있음. 밀도 수치를 임의로 낮추지 않음.
- Tiger 원본의 미세한 알파 노이즈는 런타임 경계 계산에서 제외.
  source 수정 없이 발 중심 여백 정렬·80px 균일 배율 적용.
- 자동 키 입력은 짧은 key pulse이므로 실제 사람의 연속 이동감·입력 지연은 직접 확인 필요.
- 고해상도 화면은 브라우저 viewport override로 확인했으며 물리 모니터 체감은 미확정.

## 사용자 최종 확인 필요

1. Tiger 80px의 체감 크기와 방향별 발 위치.
2. Camera 최종값 1.0 / 1.25.
3. Door 32/64px, Walkway 64/96px의 체감 Scale.
4. 35 NPC 밀도, 겹침, 선택 용이성 및 Gameplay Layout 가독성.
5. 실제 Chrome 창에서 장시간 60FPS 목표 충족 여부.

재현 조작은 루트 README의 화면 검토 순서를 따릅니다.

## Corridor 최종 검증 — 2026-09-13 재개

중단 전 구현과 A/B 기록을 유지했다. 이번 재개에서는 구현을 다시 작성하거나
Scale/Architecture를 변경하지 않았고 결과 문서만 보완했다. 작업 폴더에 `.git`이 없어
git diff 대조는 불가능했으며 현재 코드·테스트·기존 결과 문서로 상태를 확인했다.
선택 항목 E는 기존 결정대로 생략했다.

### 동일 조건 재측정

각 120 simulation seconds, 60Hz. C/D는 동일한 Small/Medium/Large 각2명이다.
브라우저 실제 시간/FPS 비교가 아닌 동일 입력 시뮬레이션 결과다.

| Test | 폭 | 편도 도착 합계 | 최장 차단 | 차단 시작 횟수 | 판정 |
|---|---|---:|---:|---:|---|
| A | 2 tiles / 64px | 0 | 117.02초 | 2 | FAIL: 지속 교착 |
| B | 3 tiles / 96px, Large 2 | 34 | 0.75초 | 2 | PASS: 반복 교행 |
| C | 3 tiles / 96px, Mixed 6 | 65 | 1.52초 | 370 | 흐름 PASS / 시각·빈번한 멈춤 WARN |
| D | 4 tiles / 128px, Mixed 6 | 64 | 2.48초 | 311 | 흐름 PASS / 시각·대기 체감 WARN |

20/30/60Hz 전체에서 발 관통·벽/경계 침범 없음. B~D 모든 NPC가 8회 이상 도착했고
10초 이상 연속 차단 없음. A의 교착은 실험 관측 FAIL이며 테스트 코드 실패가 아니다.
D는 C보다 차단 시작은 적지만 최장 대기는 길었다. 최종 통로 규격은 결정하지 않는다.

### 브라우저 관측과 회귀

- 중단 전 A: 22.1초 / 도착0 / 최장19.1초 / events2, B: 36.1초 / 도착10 /
  최장0.8초 / events2 기록 보존.
- 중단 전 C: 97.9초 / 도착52 / 최장1.6초 / events303 기록 보존.
  재개 C: 19.4초 / 도착8 / 최장1.4초 / events66. 왕복·대기 후 이동 확인.
  Pause에서 Moving0 / Waiting6 확인, Resume 및 Restart 작동.
- D 재개 관측: 9.1초 Moving2/Waiting4 → 9.5초 Moving6/Waiting0,
  도착4 / 최장0.9초 / events40. 일시 정체 후 회복 확인.
  이후 72.1초까지 도착39 / 최장2.2초 / events182 / Moving5 / Waiting1(끝 대기1),
  No forward progress0.0초 / FPS61로 반복 왕복 유지.
  서로 다른 관측 길이의 브라우저 도착 횟수로 폭 우열을 비교하지 않는다.
- C/D 모두 몸통·머리 시각 겹침이 보인다. 실제 충돌 판정은 발 기준이며 시각 평가 WARN.
- 기존 Scene 복귀 후 W/A/D 및 Down으로 up/left/right/down 방향과 위치 변화 확인.
  Tiger80px / Footprint26×16 유지. Left 접근 시 wall 위치 x158 유지.
  64px 입구 x288에서 y440→392→335로 통과. Bench96×32 / 3×1 화면 확인.
- Density12/24/35 전환, NPC5 선택, Pause/Move, Zoom1/1.25,
  Full/Gameplay75/25, Debug ON/OFF 확인. Scene 왕복 후 위치·선택5·설정 유지.
- Y-depth/occlusion은 기존 코드 유지 및 object 화면 점검. Tiger가 NPC를 막을 때의
  장시간 대기/재개와 NPC 간 비관통은 기존 자동 검사로 재검증했다.
- 1920×1080 Corridor 화면에 주요 텍스트/통로 clipping 없음. viewport override 복원.
- 관측 콘솔 error/warn 없음. typecheck/build 성공, 기존4+Corridor5=9 tests PASS.
  Phaser bundle 500kB 초과 경고는 유지된다.
- FPS는 정상 구간 약59~61이나 일부 탭에서1~2로 저하했다가 회복했다.
  장시간 성능 및 사람의 연속 조작 체감은 WARN으로 남긴다.

사용자는 C/D를 같은 simulation 시간 동안 반복 관찰하여 시각 겹침·정체·옆걸음의
자연스러움, 실제 창에서의 연속 이동/가림/장시간 FPS를 확인해야 한다.
세부 조건과 한계: [Corridor 결과](corridor_capacity_results.md).
