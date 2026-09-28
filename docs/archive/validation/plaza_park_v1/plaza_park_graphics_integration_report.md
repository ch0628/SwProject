# Plaza/Park Environment Graphics Integration Report

## 1. 변경 파일
- `src/PlazaParkScene.ts`
- `public/assets/environment/` (에셋 복사)

## 2. Asset 연결 방식
- **원본 경로:** `assets/environment/`
- **runtime 경로:** `public/assets/environment/`
- **copy 여부:** Vite 개발 서버 및 빌드 시의 정적 파일 제공을 위해 `public/` 디렉터리로 복사(Copy)하여 사용했습니다. 원본 파일은 삭제하거나 리사이즈, 픽셀 수정 없이 원형 그대로 보존했습니다.

## 3. Structural Graphics
- **Grass:** `grass_base` 구현 완료 (TMJ Ground Tile 1, 2, 4)
- **Path:** `park_path_center` 구현 완료 (TMJ Ground Tile 3)
- **Plaza:** `plaza_paving_base` 구현 완료 (TMJ Ground Tile 5, 7)
- **Road:** `main_route_base` 구현 완료 (TMJ Ground Tile 6)
- **Cafe:** `cafe_base`, `cafe_foreground`를 `Collision/Object_Base` 좌표 기준 분리 배치
- **Facility:** `public_facility_base`, `public_facility_foreground`를 `Collision/Object_Base` 좌표 기준 분리 배치
- **Fence:** `fence_horizontal`, `fence_vertical` 구현 완료 (가로/세로 비율에 따라 동적 타일링 처리)

## 4. Y-sort
- **Tree:** `tree_b` (anchor: bottom-center, depth: `groundContactY`)
- **Bush:** `bush_a` (B1-B4), `bush_b` (B5-B8) (anchor: bottom-center, depth: `groundContactY`)
- **Bench:** `bench` (anchor: bottom-center, depth: `groundContactY`)
- **Lamp:** `lamp_base` (anchor: bottom-center, depth: `groundContactY`)

## 5. Detail
- **Flower:** `flower_patch_b` 적용 (TMJ Ground_Detail Tile 8 기준 위치)
- **Grass Detail:** 명시적 Marker 부족으로 이번 1차 패스에서 Skip
- **Manhole:** `manhole_closed` (Ground_Detail layer 위치에 적용, depth: -90)
- **Lamp Glow:** `lamp_glow` (Effects layer 분리, depth: 8900으로 캐릭터 위 렌더링)
- **Variants:** 명시적 Marker가 없고 기존 TMJ 구조를 보호하기 위해 기본 타일(base)만 적용 (Skip)

## 6. Source-of-Truth 보존
- **Geometry:** 변경 없음
- **Collision:** 변경 없음
- **W01~W22:** 변경 없음
- **R1~R8:** 변경 없음
- **Door:** 기존 Trigger 및 Opening 동작 유지
- **10 active movers policy:** 유지됨

## 7. Regression
- **typecheck:** PASS
- **tests:** PASS (35 / 35 통과)
- **build:** PASS

## 8. Visual Validation

Antigravity 구현 후 실제 브라우저에서 Plaza/Park 화면을 수동 확인했다.

확인 결과:

```text
Cafe fit = PASS
Public Facility fit = PASS
Door readability = PASS
Path readability = PASS
Main Route / Plaza / Park 시각 구분 = PASS
주요 Environment Object 렌더링 = PASS
FPS 관찰값 ≈ 60~61
```

Cafe / Public Facility의 실제 Enter / Exit 동작도 사용자 수동 확인에서 정상 동작했다.

현재 화면에서 Prototype 진행을 막는 Graphics FAIL은 확인되지 않았다.

---

## 9. Graphics WARN

현재 남은 Graphics WARN:

```text
terrain / grass detail 반복감
tree variant 사용이 제한적
minor pixel alignment 가능성
일부 sprite visual overlap 가능
Debug overlay 상태에서는 최종 미관 판단이 제한적
```

위 항목은 현재 Prototype을 막지 않는다.

---

## 10. 10 NPC Browser Regression

Graphics 적용 후 10 NPC all-routes smoke를 실제 브라우저에서 실행했다.

Functional / Safety 측면:

```text
collision safety 유지
Door 동작 유지
FPS ≈ 60~61
```

그러나 실제 화면에서
합류 지점 부근의 약 4 NPC가 군집한 채
약 30초 이상 실질적으로 같은 위치에 머무는 현상이 관찰됐다.

관찰 당시 telemetry는:

```text
Moving = 10
Waiting = 0
Blocked = 0
Severe = 0
20s+ = 0
```

등으로 표시되어,
실제 progress stall을 완전히 포착하지 못하는 blind spot이 확인됐다.

이 문제는 Graphics Integration 실패가 아니라
기존 Traffic / Progress Detection의 Known Issue로 분리한다.

Source of Truth:

```text
docs/archive/plaza_park_npc_traffic_known_issue.md
```

---

## 11. 최종 판정

Graphics:

```text
PASS with WARN
```

Traffic:

```text
Functional Safety = 유지
Progress / Crowd Flow = KNOWN ISSUE
```

따라서 Graphics Integration 단계는 종료한다.

Traffic Fix5는 현재 시작하지 않는다.

---

## 12. 다음 단계

```text
Plaza/Park CCTV1 / CCTV2 설계
```

Traffic은 현재 Prototype Movement v1 상태로 Freeze한다.

향후 전체 Map topology 확정 후:

```text
NPC Navigation v2
```

에서 Route / Itinerary / Local Avoidance / Progress Watchdog을 재설계한다.
