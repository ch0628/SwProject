# 지도학습 프로토타입 규칙

## 1. 문서 목적

이 문서는 SWfestival 공모전용 AI 학습 게이미피케이션 웹의 **머신러닝 - 지도학습 프로토타입 규칙**을 기록한다.

현재 단계의 목적은 다음 세 가지를 검증하는 것이다.

1. 설계한 핵심 상호작용을 웹 브라우저에서 성능·조작 측면에서 무리 없이 구현할 수 있는가.
2. 상호작용 자체가 초등학생에게 재미있고 반복해서 플레이할 만한가.
3. 플레이 후 사용자가 지도학습의 핵심 개념을 직관적으로 이해할 수 있는가.

그래픽 완성도, 전체 AI 마을 구현, 경제 시스템 등은 이번 지도학습 프로토타입의 핵심 목적이 아니다.

---

## 2. 핵심 학습 목표

플레이 후 아이가 알아야 하는 핵심 개념은 하나로 고정한다.

> **사람이 정답을 알려주면 AI가 그 예시를 보고 배운다.**

전문 용어를 먼저 설명하지 않는다.

기본 UX 흐름은 다음과 같이 한다.

> 문제 발생 → 바로 조작 → 결과/실패 경험 → 재시도 → 성공 → 짧은 사후 설명

지도학습이라는 용어는 플레이가 끝난 뒤 핵심 개념과 연결해서 짧게 알려준다.

---

## 3. 전체 스토리

도시의 CCTV 자동 판별 AI가 고장 나서 시민과 위험 인물을 제대로 구분하지 못한다.

사용자는 도시의 여러 CCTV를 직접 확인하면서 일부 인물을 시민 또는 악당으로 판단하고, 관제 시스템의 추적 기록을 통해 실제 행동을 확인하여 **검증된 정답 데이터**를 만든다.

이렇게 수집한 정답 데이터를 중앙 AI에게 학습시키면 AI가 처음 보는 인물도 스스로 판별하기 시작한다.

초기 AI는 완벽하지 않기 때문에 사용자 판단과 AI 판단이 일치하거나 충돌하는 상황이 발생한다. 판단이 충돌하거나 AI가 불확실해하는 경우 사용자가 해당 인물의 CCTV 행동 기록을 확인하여 정답을 검증하고, 필요한 경우 AI의 판단을 수정한다.

추가 학습이 끝나면 AI가 사용자가 한 명씩 처리하던 작업을 대규모로 자동화하고, 마지막에는 도시 전체 CCTV에서 수많은 사람을 동시에 판별하는 CITY-WIDE SCAN / Final Lock-on 연출로 마무리한다.

---

## 4. 세계 및 캐릭터 전제

### 4.1 캐릭터 세계관

- 전체 서비스는 사람의 형태를 한 귀여운 동물 캐릭터 세계관을 고려한다.
- 특정 동물 종 자체가 시민/악당 여부를 결정하지 않는다.
- 외모나 종족만 보고 선악을 판단하도록 만들지 않는다.
- 시민과 악당 모두 여러 종류의 동물 캐릭터로 구성한다.

### 4.2 캐릭터 이동

지도학습 규칙이 자연스럽게 작동하려면 캐릭터는 정지해 있는 객체가 아니라 **시간에 따라 도시 공간을 이동하는 존재**여야 한다.

- 캐릭터들은 observation zone 안과 사이를 이동한다.
- 같은 캐릭터가 `PLAZA_CAM_A`에서 `PLAZA_CAM_B`로 이동해 보일 수 있다.
- 각 NPC의 Round별 소속은 `homeObservationZone`으로 고정하며, 현재 보이는 observation zone과 분리한다.
- A 소속 NPC가 B에 보여도 `homeObservationZone`은 A로 유지한다.
- NPC가 한 zone에서 빠지거나 다른 zone에 들어와도 자동 spawn/exit로 인원수를 맞추지 않는다.
- 이동은 Round별 `behaviorPlan`, `target`, entry/exit policy를 따르며 완전 무작위 Pixel 이동을 사용하지 않는다.
- 캐릭터는 시간에 따라 행동이 달라질 수 있다.

현재 playable prototype의 lifecycle은 다음 네 종류를 사용한다.

```text
STATIC_HOLD
ENTER_AND_STAY
ENTER_HOLD_EXIT
THROUGH_TRAFFIC
```

Exit형 NPC는 `EXIT → OFFSCREEN → 동일 identity 재진입`이 가능하다. Finite concurrency validation의 itinerary 완료 후 영구 `EXITED`는 validation 전용이며, gameplay의 Round population을 줄이지 않는다.

Full-game target 예시:

`공원 산책 → 상점가 이동 → 쇼핑 → 절도 → 주거지역 방향으로 이동`

이러한 시간 흐름이 추적 기록 상호작용의 기반이 된다.

---

## 5. CCTV 지역

### 5.1 A. Target Full-Game Architecture

향후 3-Zone 확장 목표의 global CCTV namespace는 다음과 같다.

```text
CCTV1 / CCTV2 = Plaza/Park
CCTV3 / CCTV4 = Shopping District
CCTV5         = Residential
```

이 구조는 삭제하지 않지만 현재 playable prototype의 camera ID로 사용하지 않는다.

### 5.2 B. Current Playable Prototype Profile

현재 우선 완성할 playable flow는 `public/maps/plaza-park-v2.tmj` 한 Map의 다음 prototype observation zone만 사용한다.

```text
PLAZA_CAM_A
PLAZA_CAM_B
PLAZA_CAM_C
PLAZA_CAM_D
PLAZA_CAM_E
```

`PLAZA_CAM_A~E`는 local prototype observation-zone namespace다. global target ID인 `CCTV1~5`와 이름·개수·의미를 대응시키지 않는다. 실제 geometry는 `docs/map_plaza_park_spec.md`와 TMJ를 따른다.

Map별 실제 크기 / 좌표 / Object / Waypoint는 다음 문서를 Source of Truth로 사용한다.

Target architecture Map Size:

```text
Plaza & Park = 96×56
Shopping District = 96×50
Residential Area = 84×52
```


```text
docs/map_plaza_park_spec.md
docs/map_shopping_district_spec.md
docs/map_residential_spec.md
```

### 5.3 Full-game target에 포함되는 특수 공간

이전에는 골목 / 맨홀 등을 별도 확장 후보로 보았으나,
현재 설계에서는 다음 요소가 기본 Map Scope에 포함된다.

```text
광장·공원
→ Manhole Interaction Point

상점가
→ North / South Service Alley
→ Arch Entrance
→ Box / Delivery Zone

주거지역
→ Narrow Alley ×2
→ Mailbox
→ Lamp / Shadow 연출
```

다만 별도의 네 번째 '골목 지역'을 추가하는 것은 현재 Scope가 아니다.

---

## 6. 학습 데이터 구조

현재 playable prototype의 학습 데이터와 라벨은 Round 단위다. 35 Character Pool은 visual/identity pool이며 고정 gameplay label을 제공하지 않는다.

```text
Round 1 = 35 NPC / 28 CITIZEN / 7 VILLAIN
Round 2 = 35 NPC / 28 CITIZEN / 7 VILLAIN
```

각 Round의 `RoundCharacterAssignment.actualLabel`이 숨겨진 실제 정답이다. 동일 `characterId`도 Round 1과 Round 2에서 다른 `actualLabel`을 가질 수 있다. `verifiedLabel`은 검증 전 `null`이며, 확인되면 해당 Round의 `actualLabel`과 일치한다.

### 6.1 Observation zone별 데이터 수집량

각 observation zone에는 해당 화면에서 얼마나 많은 검증된 학습 데이터를 수집했는지를 보여주는 표시가 존재한다.

예:

`광장 CCTV - 학습 데이터 4/6`

이 값은 **AI 학습 정도**가 아니라 해당 CCTV에서 확보한 **검증된 데이터 수량**을 뜻한다.

### 6.2 중앙 AI 학습 게이지

CCTV별 데이터 수집량과 별도로 중앙 AI의 전체 학습 상태를 보여주는 게이지가 존재한다.

구조:

`여러 CCTV에서 검증된 데이터 수집 → 중앙 AI가 통합 학습`

CCTV마다 별도의 AI가 학습하는 것처럼 보이지 않도록 한다.

---

## 7. 시민과 악당 판별 규칙

### 7.1 기본 원칙

악당은 항상 나쁜 행동만 하고, 시민은 항상 평범한 행동만 하는 구조로 만들지 않는다.

그렇게 하면 사용자가 단순히 현재 행동 하나만 보고 답을 맞히는 규칙 게임이 될 가능성이 높다.

### 7.2 비교적 명확한 행동 예시

시민의 일반 행동 예시:
- 산책
- 쇼핑
- 벤치에 앉아 휴식
- 출근 또는 귀가
- 대화
- 배달

악당의 비교적 명확한 행동 예시:
- 절도
- 시설물 파손
- 타인 위협
- 물건 탈취
- 도주

### 7.3 애매한 사례

일부 캐릭터는 현재 행동만으로 시민/악당 여부를 확신하기 어렵게 만든다.

예:
- 현재는 평범하게 쇼핑하고 있지만 이전 CCTV에서 절도한 캐릭터
- 빠르게 뛰고 있지만 범죄자가 아니라 단순히 급하게 이동하는 시민
- 금속 장비를 들고 있지만 실제로는 수리공
- 평범하게 산책하는 것처럼 보이지만 앞선 시점에 수상한 행동을 한 캐릭터

이러한 사례는 지나치게 많이 넣지 않는다.

초기에는 비교적 명확한 사례를 중심으로 조작을 익히게 하고, 이후 AI 판단 비교 및 수정 단계에서 애매한 사례를 활용한다.

---

## 8. 기본 사용자 조작

사용자는 CCTV의 관제 화면을 본다.

현재 프로토타입은 PC / 노트북 웹을 대상으로 한다.

- 마우스로 대상을 조준 / 선택한다.
- 대상에게 두 가지 라벨 중 하나를 지정한다.
- CCTV에 따라 Coverage 내부 제한적 Pan이 가능할 수 있다.

### 라벨

- `🔴 위협 / 악당`
- `🛡️ 보호 / 시민`

키보드 단축키는 추후 편의 기능으로 추가할 수 있으나 핵심 interaction은 마우스만으로 가능해야 한다.
모바일 / 터치 환경은 현재 프로토타입 지원 대상이 아니다.

---

## 9. 정답 확인 방식

### 9.1 해결해야 하는 설정상의 문제

고장 난 CCTV AI가 사용자의 판단이 정답인지 확인해 주는 구조는 모순이다.

따라서 **CCTV 자동 판별 AI**와 **정답을 검증하는 관제 기록 시스템**을 분리한다.

### 9.2 관제 시스템

고장 난 것은 CCTV 영상을 보고 자동 판별하는 AI이다.

도시에는 별도로 각 캐릭터의 CCTV 행동 기록을 조회할 수 있는 관제 기록 시스템이 남아 있다.

이 시스템은 한 명씩 확인해야 하므로 느리며, 도시의 수많은 인물을 모두 직접 조사하는 것은 현실적으로 어렵다.

따라서:

`소수 인물 직접 조사 → 검증된 정답 생성 → AI 학습 → 대규모 자동 판별`

이라는 지도학습의 필요성이 생긴다.

---

## 10. 추적 기록 상호작용

### 10.1 기록 방식

사용자와 AI가 판단을 내린 시점까지 해당 캐릭터가 observation zone에 잡혔던 행동을 시스템이 Round별로 기억한다.

사용자는 필요할 때 해당 캐릭터의 **이전 CCTV 행동 기록**을 확인할 수 있다.

예:

- 13:04 공원 산책
- 13:21 상점가 입장
- 13:25 물건 절도
- 13:29 도주

추적 기록은 미리 작성된 텍스트 설명만 보여주는 것이 아니라, 가능하다면 실제 CCTV에 기록되었던 행동 장면을 다시 확인하는 방식으로 구성한다.

### 10.2 사용 시점

추적 기록을 모든 캐릭터에게 매번 길게 보여주지 않는다.

주요 사용 시점:
- 사용자와 AI 판단이 서로 다를 때
- AI의 판단 확신이 낮을 때
- 현재 행동만으로 정답을 판단하기 어려운 캐릭터일 때
- 특수한 애매한 사례를 보여줄 때

일반적인 캐릭터는 빠르게 확인하고 넘어갈 수 있게 한다.

---

## 11. Phase 1 - 사용자가 직접 학습 데이터 생성

초기에는 AI가 자동 판별하지 못한다.

사용자가 CCTV 화면을 보며 직접 시민/악당 여부를 판단한다.

기본 흐름:

`캐릭터 선택 → 사용자 판단 → 필요 시 추적 기록 확인 → 정답 검증 → 검증된 라벨을 AI 학습 데이터에 추가`

### 데이터 수량

현재 playable prototype의 Round 1에서는 **약 8개의 distinct Character**를 수동 라벨링 목표로 한다.

기존 15~20개는 full-scope/future tuning 참고값일 뿐 현재 `FIRST_TRAINING` 전이 조건이 아니다.

너무 많은 수동 라벨링으로 반복감이 생기지 않도록 한다.

---

## 12. 사용자 판단과 검증

사용자의 최초 판단이 항상 정답인 것은 아니다.

예:

`사용자: 시민 → 추적 기록 확인 → 실제 행동 기록상 악당`

이 경우 검증된 정답은 악당으로 등록한다.

잘못된 사용자 판단을 그대로 학습 데이터로 사용하지 않는다.

검증된 데이터만 중앙 AI 학습에 사용한다.

---

## 13. Phase 2 - 중앙 AI 1차 학습

Round 1에서 약 8 distinct Characters의 검증 데이터와 필요한 label 다양성이 모이면 중앙 AI가 학습한다.

학습 연출은 짧게 유지한다.

예:

`검증된 시민 사례 + 검증된 악당 사례 → AI 분석 → READY`

실제 ML 모델을 브라우저에서 반드시 학습시킬 필요는 없다.

프로토타입의 핵심은 사용자가 지도학습 과정을 이해하고 상호작용을 재미있게 느끼는지 확인하는 것이다.

---

## 14. Phase 3 - 사용자와 AI가 함께 판단

AI가 처음 학습한 직후에는 사용자와 AI가 **같은 새로운 대상**을 각각 판단하는 구간을 둔다.

목적:
- AI가 이제 스스로 판단하기 시작했다는 것을 체감
- 사용자 판단과 AI 판단을 비교하는 재미 제공
- AI가 아직 완벽하지 않다는 것을 보여줌

대상 수는 약 5~10명 정도를 초기 후보로 둔다.

---

## 15. 라벨 표시 방식

사용자가 붙인 라벨과 AI가 붙인 라벨은 시각적으로 구분한다.

### 사용자만 판단

`👤 🛡️` 또는 `👤 🔴`

### AI만 판단

`AI 🛡️` 또는 `AI 🔴`

### 사용자와 AI 판단 일치

`👤 + AI 🛡️ ✓`

또는

`👤 + AI 🔴 ✓`

### 사용자와 AI 판단 불일치

예:

- 사용자: `🛡️`
- AI: `🔴`
- 화면: `⚠ 판단 불일치`

불일치 상태의 대상은 추적 기록 확인 대상으로 연결한다.

---

## 16. Phase 4 - 판단 불일치 확인 및 AI 수정

사용자와 AI 판단이 다르면 해당 캐릭터의 CCTV 추적 기록을 확인한다.

결과 예시 1:

- 실제: 악당
- 사용자 판단: 시민 ❌
- AI 판단: 악당 ✓

결과 예시 2:

- 실제: 시민
- 사용자 판단: 시민 ✓
- AI 판단: 악당 ❌

AI가 틀린 경우 올바른 검증 라벨을 추가 학습 데이터로 사용한다.

중요:
- 항상 인간이 맞고 AI가 틀리는 구조로 만들지 않는다.
- AI가 맞고 사용자가 틀리는 사례도 존재한다.
- 목표는 AI와 경쟁해서 이기는 것이 아니라, 불일치 사례를 확인하며 AI를 개선하는 것이다.

---

## 17. Phase 5 - AI 중심 자동 판별

사용자와 AI가 함께 판단하는 구간이 끝나고 추가 학습이 이루어지면 역할을 바꾼다.

이후에는 AI가 대부분의 사람을 자동 판별한다.

사용자는 다음 대상만 주로 검수한다.

- AI가 확신하지 못하는 대상
- 사용자 눈에 이상하게 보이는 판단
- 판단 불일치 가능성이 높은 대상

이 단계는 사용자가 초반에 직접 하던 작업을 AI가 점점 대신하는 느낌을 주어야 한다.

전체 성장 흐름:

`사용자가 전부 판단 → 사용자와 AI가 같이 판단 → AI가 대부분 판단 → 사용자는 어려운 사례만 검수 → AI가 대규모 자동 판별`

---

## 18. AI의 오판과 재학습

초기 AI는 완벽하지 않다.

일부 오판이 발생할 수 있으며 사용자가 이를 발견하고 추적 기록을 확인한 후 올바른 라벨을 추가한다.

일정량의 수정 데이터가 모이면 AI가 다시 학습한다.

두 번째 학습 연출은 첫 학습보다 짧게 한다.

예:

`UPDATE → AI 개선 완료`

재학습 이후 새로운 대상에 대한 판별 성능이 이전보다 좋아진 것처럼 보여준다.

프로토타입에서는 실제 정확도 계산보다 체감 가능한 시각적 변화가 중요하다.

---

## 19. Final - CITY-WIDE SCAN / Lock-on

마지막에는 수동 판별과 검수 과정을 끝내고 대규모 자동 판별을 보여준다.

초반에는 사용자가 Round 1에서 약 8명을 판단하고, 마지막에는 AI가 여러 observation zone의 수많은 사람을 거의 동시에 판별한다.

연출 예:

`CITY-WIDE SCAN`

→ 여러 CCTV 화면 동시 활성화  
→ 화면을 스캔하는 효과  
→ 시민에게 보호 표시  
→ 악당에게 위협 표시 / Lock-on  
→ 수십~수백 명 규모의 판별이 한 번에 이루어지는 것처럼 표현

Final Scan의 수백 명 표현은 모든 캐릭터에 실제 고비용 이동 / 행동 로직을 부여하지 않고,
저비용 Crowd / 반복 Asset / Effect 등을 이용해 시각적으로 규모감을 표현한다.

핵심은:

> **사용자가 하나씩 하던 일을 AI가 대규모로 동시에 처리한다는 체감**

이다.

---

## 20. 종료 학습 메시지

Final 연출이 끝난 뒤에만 지도학습 개념을 짧게 설명한다.

예시:

> AI가 처음부터 악당을 알아본 건 아니야!  
> 네가 시민과 악당의 정답을 알려줬고, AI는 그 예시를 보고 새로운 사람을 판단하는 법을 배웠어.  
> 이렇게 정답이 있는 예시를 보고 배우는 방법을 **지도학습**이라고 해!

긴 이론 설명은 넣지 않는다.

---

## 21. 전체 플레이 흐름

```text
CCTV 자동 판별 AI 고장
↓
Plaza/Park의 PLAZA_CAM_A~E 탐색
↓
사용자가 캐릭터를 시민/악당으로 판단
↓
필요한 경우 CCTV 추적 기록 확인
↓
약 8 distinct Characters의 검증된 정답 데이터 수집
↓
중앙 AI 1차 학습
↓
Round 1 world simulation은 계속 움직이며 FIRST_TRAINING 진행
↓
Scenario Round Reset으로 Round 2 적용
↓
사용자와 AI가 같은 대상을 각각 판단
↓
판단 일치 / 불일치 표시
↓
불일치 또는 불확실 사례의 추적 기록 확인
↓
AI가 틀렸다면 올바른 라벨로 수정
↓
추가 학습
↓
AI가 대부분의 대상을 자동 판별
↓
사용자는 어려운 사례 위주로 검수
↓
대규모 군중 등장
↓
CITY-WIDE SCAN / Final Lock-on
↓
짧은 지도학습 설명
```

---

## 22. 현재 확정 사항

- 지도학습 스테이지는 CCTV 관제 시스템을 중심으로 진행한다.
- full-game target 지역은 광장/공원, 상점가, 주거지역이다.
- current playable prototype은 Plaza/Park 한 Map과 `PLAZA_CAM_A~E`만 사용한다.
- current prototype의 Round 1/2는 각각 35 NPC, 28 Citizen / 7 Villain이다.
- 35 Character Pool은 identity pool이며 실제 정답은 Round별 assignment가 결정한다.
- CCTV별 학습 데이터 수집량과 중앙 AI 전체 학습 게이지를 분리한다.
- Round 1 수동 라벨링은 약 8 distinct Characters를 목표로 한다.
- 캐릭터는 시간에 따라 이동하며 행동이 변한다.
- 같은 캐릭터가 다른 CCTV 영역에 나타날 수 있다.
- 사용자 라벨과 AI 라벨을 구분한다.
- 둘의 판단이 같을 경우 일치 표시를 한다.
- 둘의 판단이 다를 경우 추적 기록 확인 대상으로 연결한다.
- CCTV 자동 판별 AI와 정답을 확인하는 관제 기록 시스템은 별개다.
- 추적 기록은 해당 캐릭터가 과거 CCTV에서 보였던 행동을 확인하는 방식이다.
- AI 학습 이후 초반에는 사용자와 AI가 함께 일부 대상을 판별한다.
- 이후 AI가 대부분을 자동 판별하고 사용자는 불확실하거나 의심스러운 판단을 검수한다.
- 마지막에는 수십~수백 명 규모의 대규모 자동 판별 연출을 보여준다.
- 실제 ML 모델 학습은 프로토타입 필수 조건이 아니다.
- 설명보다 상호작용을 먼저 경험하게 하고, 학습 개념 설명은 플레이 종료 후 짧게 제공한다.

---

## 23. 수치 및 세부 구현에서 추후 조정할 항목

다음 항목은 현재 규칙은 확정하되 정확한 수치는 프로토타입 테스트 후 조정한다.

- Round 1 수동 라벨링 수: 약 8 distinct Characters
- full-scope/future tuning 참고값: 15~20개
- CCTV별 필요한 데이터 수
- 사용자와 AI가 함께 판단할 대상 수: 약 5~10개 후보
- 재학습에 필요한 수정 데이터 수
- CCTV 화면 한 번에 보이는 캐릭터 수
- 캐릭터 이동 속도
- 지역 이동 주기
- AI 자동 판별 속도
- Final에서 보이는 군중 규모
- 추적 기록의 길이와 연출 시간
- AI 오판 비율 및 불확실 사례 빈도

---

## 24. 이번 프로토타입에서 제외할 확장 아이디어

다음 내용은 향후 확장 아이디어로 보존하되 현재 Codex 구현 프롬프트에는 넣지 않는다.

### 확률적 스토리 분기

예:
- 데이터가 적은 상태에서 AI가 우연히 전부 맞히는 Lucky Run
- 다음 시도에서는 새로운 데이터에서 실패
- 한 번의 성공이 충분한 학습을 의미하지 않는다는 것을 자연스럽게 보여주는 분기

이번 프로토타입에서는 기본 루트 하나만 구현한다.

### 추가 지역 / 확장 이벤트

현재 Map 내부의 Manhole / Service Alley / Narrow Alley는 기본 Scope에 포함된다.
향후 별도 확장으로 남기는 것은 다음과 같다.

- 독립적인 네 번째 골목 지역
- 대규모 수상한 단체 행동 이벤트
- 희귀 행동 이벤트
- Species별로 분리된 주거 구역과 추가 CCTV
- Species-specific Residential Interaction 확대

### 기타 확장

- CCTV 업그레이드
- 장비 구매
- 난이도
- 희귀 악당
- 경제 시스템
- 도시 복구 시스템
- 랜덤 스토리 이벤트
- 전체 마을 진행도와의 연동

---

---

## 25. 지도학습 Game State

지도학습 전체 진행은 다음 8개의 메인 State로 구성한다.

```text
INTRO
↓
MANUAL_LABELING
↓
FIRST_TRAINING
↓
HUMAN_AI_COMPARE
↓
RETRAINING
↓
AI_ASSISTED_MONITORING
↓
FINAL_SCAN
↓
COMPLETE
```

`TRACKING_REVIEW`는 독립적인 메인 State가 아니라, 여러 단계에서 필요할 때 열리는 **서브 상태 / 오버레이**로 처리한다.

### 25.1 INTRO

앞선 전체 메인 스토리와 직접 연결한다.

상황:

> 지난번 제어실 고장 때문에 도시의 CCTV AI도 제대로 작동하지 않고 있어!  
> CCTV AI가 누가 위험한지 구분하지 못하고 있어.  
> 먼저 몇 명을 직접 확인해서 AI에게 알려주자!

핵심 원칙:
- 지도학습 스테이지가 독립적으로 갑자기 시작되지 않도록 한다.
- 앞선 AI 전원 장치 / 제어실 문제의 연장선으로 CCTV AI 고장을 제시한다.
- 긴 설명 없이 바로 조작으로 넘어간다.

전이:

```text
INTRO
→ 시작
→ MANUAL_LABELING
```

### 25.2 MANUAL_LABELING

사용자가 직접 검증된 지도학습 데이터를 만드는 단계이다.

가능한 행동:
- CCTV 지역 전환
- 캐릭터 선택
- 시민 / 악당 판단
- 필요 시 추적 기록 확인
- 검증된 정답 데이터 확보

기본 흐름:

```text
캐릭터 선택
↓
사용자 판단
↓
필요 시 추적 기록 확인
↓
정답 검증
↓
검증된 라벨을 중앙 AI 학습 데이터로 추가
```

현재 Round 1의 초기 수동 데이터는 약 **8 distinct Characters**를 목표로 한다.

각 CCTV에는 해당 구역의 `학습 데이터 수집량`이 존재하고, 별도로 중앙 AI의 전체 `AI 학습 게이지`가 존재한다.

전이 조건:
- Round 1에서 약 8 distinct Characters가 검증됨
- 필요한 label 다양성이 확보됨

```text
MANUAL_LABELING
→ FIRST_TRAINING
```

### 25.3 FIRST_TRAINING

중앙 AI가 Round 1에서 사용자가 만든 검증 데이터를 처음 학습하는 단계이다.

핵심 원칙:
- 학습 중에도 도시는 멈추지 않는다.
- 캐릭터들은 계속 이동하고 행동한다.
- 전체 화면을 막는 긴 학습 연출은 피한다.
- Round 1 내부에서는 기존 캐릭터가 나가고 동일 identity로 재진입할 수 있다.
- zone별 보이는 수를 맞추기 위한 자동 population replacement는 하지 않는다.

학습이 끝나면 Scenario Round Reset으로 Round 2 assignment를 적용한다. Character visual identity roster는 유지할 수 있지만 Round 2의 `actualLabel`, `homeObservationZone`, lifecycle/behavior/route와 label 상태를 사용한다.

```text
AI TRAINING 진행
↓
도시는 계속 움직임
↓
학습에 사용되지 않은 주민이 CCTV 화면에 자연스럽게 진입
↓
TRAINING COMPLETE
```

전이:

```text
FIRST_TRAINING
→ 학습 완료
→ Scenario Round Reset
→ Round 2 HUMAN_AI_COMPARE
```

### 25.4 HUMAN_AI_COMPARE

AI가 처음으로 스스로 판단하기 시작하는 단계이다.

사용자와 AI가 같은 새로운 대상을 각각 판단한다.

예:

```text
사용자: 시민
AI: 시민
→ 판단 일치
```

또는:

```text
사용자: 시민
AI: 악당
→ 판단 불일치
```

핵심 원칙:
- 사용자와 AI의 판단이 같다고 해서 자동으로 정답이라고 간주하지 않는다.
- 사용자와 AI가 모두 틀릴 수도 있다.
- 필요할 경우 추적 기록을 확인하여 실제 정답을 검증한다.
- 항상 인간이 맞고 AI가 틀리는 구조로 만들지 않는다.
- AI가 맞고 사용자가 틀리는 사례도 존재한다.
- 목표는 AI와 경쟁해서 이기는 것이 아니라, 불일치 사례를 확인하면서 AI를 개선하는 것이다.

비교 대상 수는 약 **5~10명**을 초기 후보로 둔다.

전이:

```text
HUMAN_AI_COMPARE
→ 비교 및 수정 데이터 확보
→ RETRAINING
```

### 25.5 TRACKING_REVIEW

`TRACKING_REVIEW`는 메인 State가 아니라 필요할 때 열리는 서브 상태이다.

주요 진입 조건:
- 사용자와 AI의 판단이 다름
- AI의 판단 확신이 낮음
- 현재 행동만으로 정답을 판단하기 어려움
- 사용자가 특정 AI 판단을 의심하여 직접 확인하고 싶음

프로토타입에서는 우선 **텍스트 기반 CCTV 행동 기록**으로 구현한다.

예:

```text
12:41 공원 - 산책
12:53 상점가 - 상점 입장
12:56 상점가 - 절도
13:01 주거지역 - 도주
```

향후 확장에서는 텍스트 기록을 다음 방식으로 발전시킬 수 있다.
- 짧은 CCTV 영상
- 짧은 컷신
- 기존 캐릭터 / 배경 / 애니메이션을 재사용하는 scripted scene
- 여러 짧은 장면을 선택하거나 순서대로 보는 인터랙티브 무비 형태

프로토타입에서는 interaction 자체를 검증하기 위해 텍스트 방식을 우선한다.

### 25.6 RETRAINING

사용자와 AI의 비교 및 추적 확인 과정에서 얻은 수정 데이터를 중앙 AI가 추가로 학습하는 단계이다.

첫 번째 학습보다 짧게 처리한다.

```text
새로운 검증 데이터 추가
↓
AI UPDATE
↓
개선 완료
```

전이:

```text
RETRAINING
→ AI_ASSISTED_MONITORING
```

### 25.7 AI_ASSISTED_MONITORING

이 단계부터 사용자와 AI의 역할이 바뀐다.

초반:

```text
사용자가 대부분의 대상을 직접 판단
```

후반:

```text
AI가 대부분 자동 판단
↓
사용자는 불확실하거나 이상한 대상 위주로 검수
```

사용자가 주로 검수하는 대상:
- AI confidence가 낮은 캐릭터
- 사용자 눈에 이상하게 보이는 AI 판단
- 사용자와 AI 판단이 충돌하는 대상
- 추적 기록 확인이 필요한 애매한 대상

이 단계의 핵심 경험:

> **아까는 내가 하나씩 하던 일을 이제 AI가 대부분 대신한다.**

전이:

```text
AI_ASSISTED_MONITORING
→ 최종 학습 조건 충족
→ FINAL_SCAN
```

### 25.8 FINAL_SCAN

지도학습 스테이지의 최종 보상 연출이다.

여러 CCTV가 동시에 활성화되고 `CITY-WIDE SCAN`이 실행된다.

AI가 수십~수백 명 규모의 시민과 악당을 거의 동시에 판별하는 것처럼 보여준다.

- 악당: `LOCK-ON`
- 시민: `PROTECTED`

핵심은 실제 렌더링 숫자가 아니라 다음 체감이다.

> **사용자가 하나씩 하던 작업을 AI가 대규모로 동시에 수행한다.**

전이:

```text
FINAL_SCAN
→ 연출 종료
→ COMPLETE
```

### 25.9 COMPLETE

Final 연출이 끝난 뒤 지도학습 개념을 짧게 설명한다.

예:

> 네가 시민과 악당의 정답을 알려줬고,  
> AI는 그 예시를 보고 새로운 사람을 판단하는 법을 배웠어.  
> 이렇게 정답이 있는 예시를 보고 배우는 방법을 **지도학습**이라고 해!

긴 이론 설명은 넣지 않는다.

---

## 26. Character State

게임 전체의 Game State와 별도로 각 캐릭터는 자신의 상태를 가진다.

정적 identity, Round별 truth, runtime을 분리한 최소 구조:

```text
CharacterDefinition
- id
- species
- gender
- visualIdentity

RoundCharacterAssignment
- roundId
- characterId
- actualLabel
- homeObservationZone
- lifecycle
- behaviorPlan
- target
- entryExitPolicy

RoundRuntime
- currentPosition
- currentObservationZone
- currentBehavior
- behaviorHistory
- userLabel
- aiLabel
- verifiedLabel
- aiConfidence
- usedForTraining
```

필드 의미:
- `CharacterDefinition`: 종·성별·visual identity를 가진 35개 identity pool
- `RoundCharacterAssignment.actualLabel`: 해당 Round의 숨겨진 실제 정답
- `homeObservationZone`: 이동 중에도 변하지 않는 해당 Round의 소속 observation zone
- `currentObservationZone`: 현재 화면에 보이는 zone이며 소속과 다를 수 있음
- `currentBehavior`: 현재 행동
- `behaviorHistory`: 현재 Round에서 observation zone에 기록된 행동과 이동 기록
- `userLabel`: 사용자의 시민 / 악당 판단
- `aiLabel`: AI의 시민 / 악당 판단
- `verifiedLabel`: 추적/검증 전 `null`, 확인 후 현재 Round `actualLabel`과 같은 값
- `aiConfidence`: AI가 자신의 판단을 얼마나 확신하는지 나타내는 값
- `usedForTraining`: 해당 캐릭터의 검증 데이터가 이미 AI 학습에 사용되었는지 여부

아직 판단 또는 검증이 존재하지 않는 Label 값은 `null`로 둔다.

---

## 27. 별도 저장하지 않는 계산 상태

다음 값은 별도의 boolean 상태로 중복 저장하지 않는다.

```text
isUserLabeled
isAiLabeled
isVerified
needsReview
```

기존 필드에서 계산한다.

```text
isUserLabeled = userLabel != null
isAiLabeled = aiLabel != null
isVerified = verifiedLabel != null
```

`needsReview`는 다음과 같은 조건으로 계산한다.

```text
사용자와 AI 판단 불일치
OR
AI confidence가 기준 이하
```

같은 정보를 두 군데 저장하여 상태가 서로 불일치하는 문제를 피하기 위한 결정이다.

---

## 28. 캐릭터 이동 및 행동 상태

Game State와 개별 캐릭터의 행동 상태는 서로 분리한다.

게임 전체가 `MANUAL_LABELING`이더라도 각 캐릭터는 동시에 서로 다른 행동을 할 수 있다.

행동 예:

```text
WALKING
SHOPPING
RESTING
TALKING
STEALING
RUNNING
...
```

캐릭터는 하나의 observation zone에 고정되지 않지만 `homeObservationZone`은 Round 안에서 고정된다.

```text
광장
↓
광장 출구로 이동
↓
화면 밖으로 사라짐
↓
OFFSCREEN
↓
동일 identity로 Plaza/Park에 재진입 가능
```

이동 및 행동 정보는 `behaviorHistory`에 축적되며 이후 `TRACKING_REVIEW`에서 사용된다.

---

## 29. CCTV State

현재 prototype의 각 observation zone은 최소한 다음 데이터를 가진다.

```text
ObservationZone
- id
- visibleCharacters[]
- verifiedDataCount
```

- `id`: `PLAZA_CAM_A~E` 중 하나
- `visibleCharacters[]`: 현재 zone에 보이는 캐릭터 목록이며 `homeObservationZone` 소속 목록이 아님
- `verifiedDataCount`: 해당 observation zone에서 확보한 검증된 학습 데이터 수

---

## 30. 중앙 AI 학습 상태

중앙 AI는 CCTV와 별도로 전체 학습 상태를 가진다.

초기 구조:

```text
AITraining
- totalVerifiedData
- correctionData
- trainingStage
```

- `totalVerifiedData`: 전체 CCTV에서 확보한 검증된 학습 데이터 수
- `correctionData`: 사용자와 AI 비교 이후 추가로 확보한 수정 / 검증 데이터
- `trainingStage`: 중앙 AI가 현재 어느 학습 단계에 있는지 나타내는 값

정확한 필드 구조는 실제 구현 단계에서 필요한 최소 형태로 조정할 수 있다.

---

## 31. State 설계 핵심 원칙

### 31.1 Within Round 지속과 Scenario Round Reset을 구분한다

같은 Round 안에서 camera를 전환하거나 Game State가 진행될 때는 runtime을 유지한다. 예:

```text
Round 1: MANUAL_LABELING → FIRST_TRAINING
Round 2: HUMAN_AI_COMPARE → RETRAINING → AI_ASSISTED_MONITORING
```

world simulation, NPC runtime, label/history를 유지하며 자동 population replacement를 하지 않는다.

**게임 단계에 따라 사용자가 할 수 있는 행동과 AI의 역할만 달라진다.**

Round 1에서 Round 2로 넘어갈 때는 **Scenario Round Reset**을 수행한다. Map 자체나 전체 application/world architecture를 파괴해 새로 만들 필요는 없지만 다음 RoundScenario를 적용한다.

```text
유지 가능: Map, Character visual identity roster
재배정 가능: actualLabel, homeObservationZone, lifecycle, behaviorPlan, route
초기화: userLabel, aiLabel, verifiedLabel, selection, stop/action reservations
분리: behaviorHistory는 Round별 저장
```

이를 통해 Round 안에서는 다음 요소를 자연스럽게 유지한다.
- 같은 캐릭터가 다른 CCTV에 등장
- 과거 행동을 CCTV로 추적
- 시간에 따라 행동이 변화
- AI 학습 전 / 후의 자연스러운 비교

### 31.2 메인 State와 캐릭터 상태를 분리한다

`MANUAL_LABELING`, `HUMAN_AI_COMPARE` 등은 게임 전체 진행 상태이다.

캐릭터의 위치, 이동, 행동, 사용자 판단, AI 판단, 검증 결과는 각각 별도로 유지한다.

### 31.3 TRACKING_REVIEW는 재사용 가능한 서브 상태로 둔다

추적 기록은 특정 한 Phase에만 종속시키지 않는다.

수동 라벨링, 사용자/AI 비교, AI 중심 모니터링 등 여러 단계에서 필요할 때 호출할 수 있도록 한다.

---

## 32. 지도학습 State 설계 완료 상태

현재 지도학습에 대해서는 다음 수준까지 설계가 완료되었다.

- 메인 Game State 정의
- 각 State의 목적
- 주요 사용자 행동
- State 전이 조건의 방향
- TRACKING_REVIEW 서브 상태
- Character State
- CCTV State
- 중앙 AI 학습 상태
- 중복 boolean 상태 제거 원칙
- Within Round runtime 지속 원칙
- Round 1 → Round 2 Scenario Round Reset 원칙

다음 단계에서는 지도학습 State를 더 세분화하지 않는다.

정확한 시간, confidence threshold, 애니메이션 프레임, UI 배치 등은 실제 구현 및 테스트 단계에서 조정한다. Round 1/2 population `35`, label 비율 `28:7`, Round 1 manual target `약 8`은 current profile의 확정값이다.

---

## 33. 현재 구현 준비 상태 및 다음 작업

지도학습의 규칙 및 State 설계는 현재 단계에서 종료한다.

또한 지도학습용 3개 Map의 상세 설계도 완료되었다.

```text
docs/map_plaza_park_spec.md
docs/map_shopping_district_spec.md
docs/map_residential_spec.md
```

Scale / Corridor 검증도 현재 Map 폭 기준에 반영되었다.

Plaza/Park에서는 Map v2, 35 Character Pool, semantic intent/runtime,
Dijkstra routing, two-way lane, junction continuity, Stop Point reservation/defer,
`behaviorHistory`, watchdog 및 5~15 NPC deterministic concurrency 검증까지 완료했다.

기존 2-camera technical baseline의 구현 완료 범위는:

```text
CCTV1 / CCTV2 Camera_Zone runtime 연결
→ CCTV별 visibleCharacters
→ NPC 선택
→ 시민 / 악당 Manual Labeling
→ MANUAL_LABELING vertical slice
```

구현된 Manual Labeling에서는 `CharacterRuntimeState.labels.userLabel`을 Source of Truth로 사용한다.
값은 `null → CITIZEN → VILLAIN → CITIZEN`처럼 lock 없이 반복 변경할 수 있다.
CCTV 전환/이탈은 선택만 해제하며 runtime의 `userLabel`과 `behaviorHistory`를 초기화하지 않는다.
UI-facing model에는 `verifiedLabel`, definition label, `aiLabel`, `aiConfidence`를 포함하지 않는다.

이 baseline은 historical validation으로 보존한다. current `PLAZA_CAM_A~E` profile과 Round 1
`RoundScenario`/persistent lifecycle은 `src/plazaRound1.ts` 및 관련 runtime에서 구현·검증되었다.
Round 1 manual label은 `userLabel`만 기록하며 자동으로 `verifiedLabel`이 되지 않는다. 별도 verification
interaction이 없으므로 현재 UI의 `trainingReady`는 8개 distinct verified sample이 생기기 전까지 대기한다.

`FIRST_TRAINING`, Round 2, Tracking Review UI, AI prediction/compare/retraining은 아직 구현하지 않았다.

Shopping District와 Residential의 실제 runtime route는 각 Map의 구현 단계에서 연결한다.

이미 확정된 Map Size / Path Width와 full-game target/current prototype namespace 분리를 구현 과정에서 임의로 변경하지 않는다.
