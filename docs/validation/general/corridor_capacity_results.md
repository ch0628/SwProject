# Corridor Capacity Validation

## 실행 / 비교 조건

`npm run dev` → 기존 화면의 **Corridor Tests** → A/B/C/D 선택.
Restart test로 초기 상태·측정값을 초기화하고, Pause / Resume으로 정지·재개한다.
Back to Scale은 기존 Scene의 위치·NPC·Zoom·Layout을 유지한 채 복귀한다.

기존 통로와 맵은 수정하지 않았다. 별도 Debug Scene에 폭만 바뀌는 수직 검증 통로를 표시한다.
E는 생략했다. 새로운 지도나 최종 NPC AI를 의미하지 않는다.

| Test | 폭 | NPC |
|---|---:|---|
| A | 64px / 2 tiles | Large 2명, 서로 반대 방향 |
| B | 96px / 3 tiles | Large 2명, A와 동일 조건 |
| C | 96px / 3 tiles | Small/Medium/Large 각2명, 총6명 |
| D | 128px / 4 tiles | C와 동일 초기 위치·구성·속도·이동 로직 |

속도 48px/s, 양 끝 y144/448에서 0.6초 대기 후 반전한다. 앞이 막히면 0.35초 기다린 후
진행 방향의 오른쪽으로 최대32px/s의 작은 옆걸음을 시도한다. 모든 이동은 기존 AABB
Footprint/Navigation 계산으로 검사한다. 후진·양보 우선권·문제 자동 리셋·관통은 사용하지 않는다.

검증 전용 후보값 (`src/corridorCapacity.ts`):

| Class | Visual W×H | Footprint W×H | Wall clearance 좌우/위/아래 |
|---|---|---|---|
| Small | 32×56 | 18×12 | 20/40/6 |
| Medium | 42×68 | 22×14 | 25/48/7 |
| Large | 56×80 | 26×16 | 기존값 30/56/8 |

이 실험의 Large placeholder에도 기존 Tiger의 구조물 접근 여유를 적용했다.
Small/Medium 값은 종별 확정 규격이 아니며 기존 Density NPC 규칙을 변경하지 않는다.

## 자동 관측: 120 simulation seconds

20/30/60Hz 각각 A~D 실행. 표는 60Hz 결과이며 실제 브라우저 성능 측정값이 아니다.
매 step 발 충돌·벽 Clearance·이동량·통로 경계를 검사했다. Trips는 편도 도착 횟수 합계다.

| Test | Trips | 최장 연속 차단 | Blocked events | 관측 판정 |
|---|---:|---:|---:|---|
| A | 0 | 117.02초 | 2 | **FAIL**: 교착 지속 |
| B | 34 | 0.75초 | 2 | **PASS**: 대기 후 반복 교행 |
| C | 65 | 1.52초 | 370 | **PASS (흐름)** / **WARN (잦은 멈춤·시각 겹침)** |
| D | 64 | 2.48초 | 311 | **PASS (흐름)** / **WARN (시각·대기 체감)** |

다른 step에서도 A는 약117초 교착, B는 최장0.75~0.77초,
C는1.50~1.53초, D는2.07~2.48초였다. B~D는 모든 NPC가 8회 이상 편도 도착했고
10초 이상 연속 차단은 없었다. 전 조건에서 발 관통·벽 침범은 없었다.

A는 64px 폭에서 Large 중심의 좌우 이동 가능 범위가 총4px이므로, 26px footprint 두 개가
나란히 지나갈 여유가 없다. 현재 허용된 전진/대기/옆걸음만으로는 교착을 해소하지 못한다.
이는 이 실험 조건의 FAIL이며 2-tile 규격을 폐기한다는 결정이 아니다.

C/D 비교에서는 D의 막힘 시작 횟수가 줄었지만 최장 대기는 길고 도착 횟수는 비슷했다.
단순 옆걸음과 끝 반전 방식에 종속된 관측이므로 폭이 넓을수록 무조건 개선된다고 해석하지 않는다.

## 측정 정의와 한계

- Moving: 현재 step에서 전진 또는 옆걸음한 수. Waiting: 나머지(끝 대기 포함).
- Longest wait: 전진이 막힌 연속 시간의 전체 최대. 옆걸음만 하면 계속 누적.
- Blocked events: 전진 가능 상태에서 차단 상태로 바뀐 횟수. 프레임 수가 아니다.
- No forward progress: 전체 NPC 중 아무도 전진하지 않은 연속 simulation 시간.
- 매 프레임 최대50ms만 진행한다. 배경 탭 FPS 저하 시 실제 시계보다 느리게 진행한다.
- 직선 통로·동일 속도·고정 초기 배치다. 랜덤 유입, 교차로, 입구 확장부, 후진 양보는 없다.
- 넓은 어깨/머리의 시각 겹침은 footprint 비관통과 별개다. 화면에서 확인해야 한다.
- 어떤 폭도 최종 Standard로 채택하거나 기존 규칙을 변경하지 않았다.

## 검사

- `npm run build`: typecheck 포함 성공. 기존 Phaser bundle 크기 경고 유지.
- `npm test`: 기존4 + Corridor5 = 9개 성공.
- 2026-09-13 최종 재실행: typecheck/build와 9개 테스트 모두 성공.
- 브라우저 선택, 왕복·대기 표시, Pause/Resume/Restart, 기존 Scene 복귀 확인.

## 최종 브라우저 관측 (기존 A/B 기록 보존)

| 실행 | Elapsed | Trips | Longest wait | Blocked events | 관측 |
|---|---:|---:|---:|---:|---|
| 중단 전 A | 22.1s | 0 | 19.1s | 2 | 전원 대기, 교착 |
| 중단 전 B | 36.1s | 10 | 0.8s | 2 | 반복 교행 |
| 중단 전 C | 97.9s | 52 | 1.6s | 303 | 흐름 유지 |
| 재개 C | 19.4s | 8 | 1.4s | 66 | 반복 도착; Pause에서 Moving0/Waiting6 |
| 재개 D 최종 | 72.1s | 39 | 2.2s | 182 | Moving5/Waiting1(끝 대기1), 무전진0초, FPS61 |

D 별도 실행에서도 9.1초 Moving2/Waiting4 → 9.5초 Moving6/Waiting0으로 회복했다.
C/D는 몸통/머리의 시각 겹침이 있어 WARN이며, 발 비관통은 자동 검사에서 확인했다.
위 표는 관측 길이가 다르므로 폭 비교의 정량 근거로 사용하지 않는다.
폭 비교는 위의 동일 120초 시뮬레이션 표를 사용한다.

Scale 회귀: Tiger4방향 이동, 80px/26×16, wall x158 정지,
64px 입구 x288/y440→335 통과, Bench96×32, 밀도12/24/35,
NPC5 선택, Zoom1/1.25, Full/Gameplay, Debug, NPC Pause/Move 확인.
Scene 왕복 시 위치·선택·설정 유지. 기존 충돌/대기/재개 검사도 PASS.
1920×1080 Corridor 표시 정상, 관측 console error/warn 없음.
일부 탭1~2FPS 저하 후 약60FPS 회복: 장시간 성능/연속 조작/가림 체감은 사용자 확인 필요.
세부 회귀 범위와 한계는 [Scale 최종 기록](scale_validation_results.md)에 구분했다.

## 사용자 직접 확인

1. A에서 두 NPC의 교착 상태와 Restart 동작.
2. B에서 Large 교행 시 어깨 겹침·좌우 이동의 자연스러움.
3. C/D를 동일 시간 관찰하여 잦은 멈춤, 최장 대기, 줄 길이, 시각 가독성 비교.
4. Back to Scale 후 기존 조작·카메라·밀도 UI.

3 tiles와 4 tiles의 최종 선택은 사용자에게 남긴다.
