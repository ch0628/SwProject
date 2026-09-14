# Graphics & Character Asset Specification

## 1. 문서 목적

이 문서는 SWfestival AI 학습 게이미피케이션 웹 프로토타입의 **그래픽 및 캐릭터 Asset 제작 기준**을 정의한다.

목적:
- 전체 비주얼 스타일을 일관되게 유지한다.
- 핵심 캐릭터와 일반 군중 캐릭터의 제작 방식을 분리한다.
- 캐릭터 종별 Variation과 Animation 범위를 통제한다.
- 지도학습 / 비지도학습 / 강화학습에서 필요한 Asset을 재사용 가능한 구조로 만든다.
- 추후 Codex, 디자이너, 이미지 생성 도구가 동일한 규격을 따르도록 한다.

지도학습 Map의 크기, Layer, CCTV Zone, Waypoint와 지역별 배치는 현재 다음 Map Spec에서 정의한다.

```text
docs/map_plaza_park_spec.md
docs/map_shopping_district_spec.md
docs/map_residential_spec.md
```

공통 Map 시각 원칙은 `docs/reference/map_visual_reference.md`,
Scale / Corridor 기준은 `docs/map_scale_validation_spec.md`,
`docs/validation/general/scale_validation_results.md`,
`docs/validation/general/corridor_capacity_results.md`를 따른다.

강화학습 5층 건물의 실제 Layout은 별도 설계 단계에서 정의한다.

---

# 2. 전체 비주얼 방향

## 2.1 기본 화면 스타일
- Top-down 2.5D
- Pixel Art 기반
- Orthogonal Tilemap 기반
- Full 3D는 사용하지 않는다.
- 너무 사실적이지 않고 귀엽고 명확한 실루엣을 우선한다.
- 초등학생이 한눈에 캐릭터와 행동을 구분할 수 있어야 한다.

## 2.2 분위기
### 캐릭터 / 세계관 감성
- 귀여운 의인화 동물 마을
- 밝고 친근한 캐릭터
- 위협적인 악역도 공포스럽기보다 수상하고 장난기 있는 방향
- `Zootopia`, `Animal Crossing`처럼 다양한 동물이 함께 살아가는 도시/마을 감성

### 도시 / 색감 감성
- 일반 도시/마을: 따뜻한 자연색
- 기술/AI 요소: 차가운 네온 계열
- `Zootopia`, `Elemental`처럼 생동감 있고 다양한 색채를 가진 도시 분위기

## 2.3 색상 원칙
### 일반 도시 / 마을
- 따뜻한 나무색
- 자연스러운 녹색
- 밝은 벽돌 / 돌 / 흙 / 잔디
- 친근한 상점 간판
- 포근한 실내 조명

### AI / 기술 요소
- 밝은 청록색
- 파란색
- Cyan 계열 Glow
- 차가운 네온 포인트

기본 원칙:

> **마을과 캐릭터는 따뜻하고 친근하게, AI와 홀로그램은 차갑고 미래적으로 표현한다.**

---

# 3. 캐릭터 제작 전략

## 3.1 핵심 캐릭터
스토리에서 반복적으로 등장하거나 플레이어가 기억해야 하는 캐릭터는 **개별 제작**한다.

예:
- 메인 가이드 AI 캐릭터
- 주요 주민 NPC
- 지도학습에서 서사적으로 중요한 캐릭터
- 비지도학습 사건 컷신에 반복 등장하는 주요 인물
- 강화학습 점거 사건의 핵심 인물
- 향후 스토리상 이름이 붙는 캐릭터

핵심 캐릭터는 고유한 실루엣, 의상, 색상, 필요한 경우 전용 Animation을 가질 수 있다.

## 3.2 일반 캐릭터
일반 주민, 군중, CCTV 등장 인물은 **모듈 조합형**을 기본으로 한다.

```text
Species
+
Species Variant
+
Body Variation
+
Outfit
+
Accessory
+
Equipment
+
Color / Pattern Variation
```

목표는 적은 수의 기본 Asset으로 많은 캐릭터 Variation을 만드는 것이다.

---

# 4. 기본 동물 종

프로토타입 1차 기본 종은 **5종**으로 시작한다.

1. 토끼
2. 여우
3. 호랑이
4. 고양이
5. 강아지

추후 필요에 따라 종을 확장한다.

## 4.1 향후 확장 후보
- 코끼리
- 곰
- 너구리
- 늑대
- 기타 세계관에 필요한 동물

코끼리는 현재 프로토타입 1차 범위에서는 제외한다.

---

# 5. Base Character 및 Species Variation

## 5.1 현재 기본 제작 단위

현재 1차 Character Base 제작은 **Species별 총 2마리**로 한다.

```text
Male 1
+
Female 1
=
Species별 Base Character 총 2마리
```

즉 `Male 2 + Female 2`를 만드는 것이 아니다.

각 Base Character는 다음 4방향 기준 이미지를 가진다.

```text
Down
Left
Right
Up
```

현재 1차 Base Direction Asset 상태:

```text
Rabbit: Male/Female × 4방향 완료
Fox:    Male/Female × 4방향 완료
Tiger:  Male/Female × 4방향 완료
Cat:    Male/Female × 4방향 완료
Dog:    Male/Female × 4방향 완료

총 5 Species × 2 Base × 4 Direction = 40 Direction Sprites 완료
```

Fox Female의 Alpha 문제는 별도 보정하여 완료된 상태로 취급한다.

## 5.2 추후 외형 Variation

Base Character 2마리를 확보한 뒤,
일반 주민의 시각적 다양성은 필요에 따라 다음 요소를 조합해 확장한다.

```text
Species
+
Male / Female Base
+
Fur / Pattern Variation
+
Outfit
+
Accessory
+
Equipment
+
Color Variation
```

목표는 많은 전체 Sprite Set을 수작업으로 반복 제작하는 것이 아니라
기본 Character를 중심으로 재사용 가능한 Variation을 만드는 것이다.

주의:
- 실제 생물학적 성별 표현을 과도하게 강조하는 것이 목적은 아니다.
- Male / Female은 현재 Character Base를 구분하기 위한 제작 단위로 사용한다.
- 종 내부의 색상 / 무늬 / Outfit Variation은 향후 필요한 수준에서 확장한다.

---

# 6. Species와 비지도학습 Feature의 분리

비지도학습 Feature:
1. 체격·무게
2. 장비 신호
3. 이동 속도

중요 원칙:

> **동물 종과 비지도학습 Feature를 1:1로 연결하지 않는다.**

잘못된 예:

```text
토끼 = 항상 빠름
호랑이 = 항상 무거움
강아지 = 항상 보통
```

이런 구조는 사용하지 않는다.

캐릭터 Feature는 Species와 별도로 가진다.

```text
Character
- species
- speciesVariant

Features
- bodyWeight
- equipmentSignal
- moveSpeed
```

따라서 토끼지만 이동 속도가 느릴 수 있고, 호랑이지만 장비 신호가 낮을 수 있으며, 강아지지만 체격·무게가 높을 수 있다.

이 원칙을 통해 비지도학습이 단순한 Species 분류 게임으로 변하는 것을 방지한다.

---

# 7. 시민 / 수상한 인물 / 악당 표현 원칙

> **수상한 외형이나 행동이 곧 악당임을 의미하지 않는다.**

외형만으로 시민과 악당을 명확히 분리하지 않는다.

예:
- 빠르게 뛰는 캐릭터 = 범죄자일 수도 있지만 늦은 시민일 수도 있음
- 가방을 들고 이동 = 훔친 물건일 수도 있지만 배달 중일 수도 있음
- 맨홀에서 등장 = 악당일 수도 있지만 도시 정비공일 수도 있음
- 여러 명이 속닥거림 = 범죄 계획일 수도 있지만 친구끼리 대화일 수도 있음

따라서 지도학습에서 판단은 현재 행동, 과거 행동 기록, Tracking Review, 장비 / 상황 정보, Verified Label 등을 통해 이루어진다.

Species, 색상, 의상 하나만으로 선악을 고정하지 않는다.

---

# 8. Tile 및 Sprite Frame 기본 원칙

## 8.1 Tile Size
Tile 크기는 다음으로 고정한다.

```text
32 × 32 px
```

## 8.2 Character Sprite Frame
캐릭터 Sprite Frame은 **모든 Species에 동일한 크기를 강제하지 않는다.**

Species별로 다른 Frame 크기를 사용할 수 있다.

```text
Rabbit Frame
Cat Frame
Dog Frame
Fox Frame
Tiger Frame
```

Scale Validation을 통해 다음 공통 기준이 확정되었다.

```text
Tiger
= Large 기준
= Visual Height 80px

General NPC Visual Height Max
= 96px

Tiger Collision Footprint
= 26×16px
```

Rabbit / Cat / Dog / Fox의 정확한 최종 Visual Height와
Species별 Physical Footprint는 아직 확정하지 않는다.

현재 Size Class 방향은 **후보 분류**일 뿐,
Species별 Collision Footprint 확정값을 의미하지 않는다.

현재 Size Class 방향:

```text
Rabbit
= Small 후보

Cat
= Small ~ Medium 후보

Fox
= Medium 후보

Dog
= Medium 후보

Tiger
= Large / 80px 확정
```

## 8.3 Frame 규칙
Species별 Frame 크기는 다를 수 있지만 다음 규칙은 공통으로 유지한다.

### Anchor
모든 캐릭터의 위치 기준은 **발 중앙(Bottom Center)** 으로 통일한다.

### Depth
캐릭터의 화면 앞뒤 정렬은 **발 위치의 Y 좌표**를 기준으로 한다.

### Collision Footprint
보이는 Sprite 크기와 실제 이동 충돌 범위를 분리한다.

### Species 내부 규격
같은 Species의 캐릭터는 동일한 Frame 규격을 사용한다.

예:

```text
White Tiger
Orange Tiger
Dark Tiger
```

모두 동일한 Tiger Frame 규격을 사용한다.

---

# 9. 이동 방향

일반 캐릭터는 **4방향 Animation**을 사용한다.

```text
Up
Down
Left
Right
```

8방향은 현재 프로토타입에서는 사용하지 않는다.

---

# 10. Animation 설계 원칙

목표:

> **공통 Animation 종류는 제한하면서 Species별 표현 차이와 상황 조합을 통해 다양하게 보이게 한다.**

Animation은 다음 세 계층으로 구분한다.
1. General NPC Animation
2. Optional Special Action
3. Core Character / RL Robot 전용 Animation

---

# 11. General NPC Animation

모든 일반 NPC는 다음 Animation State를 지원한다.

```text
Idle
Walk
Run
Talk
Interact
Reaction
```

총 6종을 공통 기본 Animation으로 사용한다.

## 11.1 Idle
가만히 서 있는 상태지만 완전한 정지 이미지가 아니라 작은 Micro Animation을 포함한다.

중요 원칙:

> **State 이름은 공통 `Idle`이지만 실제 표현은 Species별로 다르게 만든다.**

예:

### 토끼
- 귀가 가끔 움직임
- 눈 깜빡임

### 여우
- 꼬리를 천천히 흔듦
- 귀가 조금 움직임

### 호랑이
- 꼬리 끝 움직임
- 몸이 천천히 들썩임

### 고양이
- 눈 깜빡임
- 귀 움직임
- 꼬리 작은 움직임

### 강아지
- 가끔 꼬리 흔듦
- 몸이나 귀 움직임

## 11.2 Idle Timing Randomization
같은 Species 캐릭터 여러 명이 동시에 같은 동작을 반복하지 않도록 한다.

방법:
- Animation 시작 시점 Randomize
- Idle Micro Action 사이 대기시간 Randomize
- 가능한 경우 1~2개의 Micro Variation 중 Random 선택

목표는 적은 Asset으로 군중의 복제 느낌을 줄이는 것이다.

## 11.3 Walk
일반적인 4방향 이동 Animation.

## 11.4 Run
빠른 이동 Animation.

Run 자체는 악당을 의미하지 않는다.

## 11.5 Talk
NPC가 다른 NPC와 대화할 때 사용한다.

Talk Animation 자체도 악당 판정 근거가 아니다.

## 11.6 Interact
환경 Object와 상호작용하는 범용 Animation.

예:
- 상점 물건 보기
- 문 사용
- 기계 조작
- 자판기 사용
- 물건 집기
- 주변 Object 확인

## 11.7 Reaction
짧은 반응 Animation.

예:
- 놀람
- 발견
- 당황
- 주목
- CCTV Target Lock에 반응

필요한 경우 `!`, `?`, `💦` 등의 Overlay Effect와 결합한다.

---

# 12. Optional Special Action

다음 행동은 모든 NPC에게 필수로 제공하지 않는다.

현재 프로토타입에서 사용할 Special Action은 다음 6개로 제한한다.

```text
1. Manhole Enter / Exit
2. Peek From Behind
3. Whisper / Secret Talk
4. Sneak Take Object
5. Look Around → Run
6. Carry Box / Bag
```

## 12.1 Manhole Enter / Exit
캐릭터가 맨홀에서 등장하거나 들어가는 행동.

```text
Manhole Object Animation
+
Character Enter / Exit Animation
```

## 12.2 Peek From Behind
벽, 간판, 구조물 등 뒤에서 얼굴이나 몸 일부를 내밀어 주변을 확인하는 행동.

## 12.3 Whisper / Secret Talk
2~3명의 NPC가 가까이 모여 작게 대화하는 행동.

은밀한 분위기를 주지만 반드시 범죄 대화라는 의미는 아니다.

## 12.4 Sneak Take Object
주변 Object를 몰래 가져가는 것처럼 보이는 행동.

## 12.5 Look Around → Run
주변을 살핀 뒤 빠르게 이동하는 행동.

악당 도주에도 사용할 수 있지만 정상적인 시민 행동으로도 사용 가능하다.

## 12.6 Carry Box / Bag
상자, 가방, 물건 등을 들고 이동하는 상태.

배달원, 상점 직원, 시민, 사건 관련 인물 등 여러 상황에서 재사용한다.

---

# 13. 행동 State와 Animation Asset 분리

게임 안의 행동 State가 많다고 해서 모든 행동마다 새로운 Sprite Animation을 만들 필요는 없다.

```text
WAITING
→ Idle 사용

FOLLOWING
→ Walk 사용

FLEEING
→ Run 사용

LOOK_AROUND
→ Idle + 방향 전환

SHOPPING
→ Interact 사용
```

> **Behavior State는 풍부하게, 실제 Sprite Animation 종류는 제한적으로 유지한다.**

---

# 14. 지도학습에서 필요한 Character Asset

필수:
- 5종 Species
- Species Variant
- Outfit / Equipment Variation
- Idle
- Walk
- Run
- Talk
- Interact
- Reaction

선택적 Special Action:
- Manhole Enter / Exit
- Peek From Behind
- Whisper
- Sneak Take Object
- Look Around → Run
- Carry Box / Bag

캐릭터 Animation이 아닌 Effect로 처리:
- 빨간 Threat Target
- 초록 Shield / Protect
- AI 판단 표시
- Confidence / Review 표시
- Tracking Review Highlight

---

# 15. 비지도학습에서 필요한 Character Asset

비지도학습에서는 새로운 캐릭터 Sprite Set을 별도로 만들지 않는다.

지도학습에서 만든 일반 Character Sprite를 재사용한다.

```text
Existing Character Sprite
+
Cyan / Blue Tint
+
Transparency
+
Glow
+
Scan Ring
+
Trail / Afterimage
```

필요 Effect:
- Hologram Tint
- Alpha
- Glow
- Scan Line / Ring
- Cluster 이동 Tween
- 플랫폼 이동
- Group Link
- Ambiguity Zone Link
- Hologram Trail

> **비지도학습은 새 Character Animation보다 Effect Animation 중심으로 제작한다.**

---

# 16. 강화학습 AI 대응 로봇

강화학습에서는 일반 동물 NPC와 별도로 **AI 대응 로봇** Asset을 제작한다.

## 16.1 디자인 방향
- 작고 둥글고 친근한 형태
- 초등학생이 보기에도 무섭지 않음
- 구조 / 대응용 로봇 느낌
- 전투 로봇 같은 과도한 무장 표현은 피함
- 청백색 / Cyan 계열 발광 포인트
- 귀엽지만 믿음직한 인상

## 16.2 Robot Animation

```text
Idle
Move
Turn
Interact
Crash
Disabled
Success
```

### Idle
대기.

### Move
일반 이동.

### Turn
방향 전환.

### Interact
문, 콘솔, 장비, 시스템과 상호작용.

### Crash
벽/시설물 충돌.

### Disabled
충돌 누적으로 작동 불능.

### Success
목표 도달 / 시스템 복구 성공.

## 16.3 별도 Animation이 필요하지 않은 행동

```text
시민 우회
→ Move + Path 변경

기다리기
→ Idle

엘리베이터 탑승
→ Move + Elevator Object Animation

장애물 회피
→ Move + Path 변경
```

---

# 17. Outfit / Equipment Module

일반 NPC의 외형 다양성을 위해 다음 모듈을 Species별 Frame에 맞게 제작할 수 있다.

### Outfit 예
- 일반 상의
- 후드
- 재킷
- 작업복
- 상점 직원 의상
- 배달/운반 계열 의상
- 캐주얼 의상

### Accessory 예
- 모자
- 안경
- 목도리
- 가방
- 헤드셋

### Equipment 예
- 작은 도구
- 금속 장비
- 작업 장비
- 상자
- 큰 가방

주의:
- 특정 의상이나 장비가 악당 여부를 결정하지 않는다.
- 지도학습과 비지도학습의 Feature로 일부 활용할 수 있지만, 단일 외형 요소가 정답 Label이 되지 않게 한다.

---

# 18. Hologram 재사용 원칙

홀로그램은 별도 Character Sprite Sheet를 만들지 않는다.

가능한 경우 Runtime Effect로 기존 Sprite를 변환한다.

```text
Base Sprite
→ Tint
→ Alpha
→ Glow
→ Scan Effect
```

필요한 경우 홀로그램 전용 Shader / Filter / Overlay를 사용할 수 있으나 실제 구현 방식은 기술 구현 단계에서 확정한다.

---

# 19. Asset 파일 관리 원칙

현재 Character Asset 구조:

```text
assets/
└─ characters/
   ├─ rabbit/
   │  ├─ reference/
   │  ├─ base/
   │  │  ├─ male/
   │  │  └─ female/
   │  └─ animations/
   ├─ fox/
   ├─ tiger/
   ├─ cat/
   └─ dog/
```

Base Character는 Species별:

```text
Male 1
Female 1
```

을 사용한다.

방향 파일명 기본 규칙:

```text
<species>_<sex>_down.png
<species>_<sex>_left.png
<species>_<sex>_right.png
<species>_<sex>_up.png
```

예:

```text
cat_female_down.png
cat_male_right.png
```

임시 보정 과정에서 붙은 `_fixed` 같은 suffix는
최종 Asset 정리 시 기본 파일명 규칙으로 통일한다.

Reference Sheet:

```text
game_ready_sheet_male.png
game_ready_sheet_female.png
```

Animation Asset은 아직 전 Species Scale / Base가 안정화되기 전에는
대량 제작하지 않는다.

Character 생성 / 정리 Workflow 문서:

```text
ai/skills/character_asset/
├─ 01_species_master_reference_prompt.md
├─ 02_master_reference_refinement_prompt.md
├─ 03_game_ready_sheet_prompt.md
├─ 04_directional_crop_prompt.md
└─ 05_character_asset_validation_and_file_management.md
```

기타 향후 Asset 영역:

```text
assets/
├─ characters_core/
├─ robots/
├─ outfits/
├─ accessories/
├─ equipment/
├─ effects/
└─ ui/
```

Sprite Sheet Packing 방식은 Animation 제작 단계에서 별도로 확정한다.

---

# 20. 아직 고정하지 않는 항목

다음은 현재 단계에서 의도적으로 고정하지 않는다.

- Rabbit / Fox / Cat / Dog의 최종 Visual Height
- Rabbit / Fox / Cat / Dog의 최종 Physical Footprint
- Species별 최종 Source Frame Width / Height
- 각 Animation의 정확한 Frame 수
- Animation FPS
- Sprite Sheet Packing 방식
- Outfit / Equipment 개수
- Base Character 이후 추가 외형 Variation 개수
- 핵심 캐릭터 정확한 명단
- 각 캐릭터의 최종 색상 팔레트
- Robot 정확한 외형
- 맵 지역별 캐릭터 배치 수
- TileSet 상세 규격

이 항목들은 Map Scale 테스트 및 실제 Asset 제작 단계에서 확정한다.

---

# 21. 확정된 규칙 요약

- Top-down 2.5D
- Pixel Art
- 밝고 친근한 의인화 동물 도시
- 따뜻한 마을 색감 + 차가운 AI Neon 색감
- 핵심 캐릭터 개별 제작
- 일반 NPC 모듈 조합형
- 기본 Species 5종: 토끼 / 여우 / 호랑이 / 고양이 / 강아지
- 코끼리는 향후 확장
- Species별 Base Character는 Male 1 + Female 1 = 총 2마리
- Base 이후 필요에 따라 Fur / Pattern / Outfit / Accessory Variation 확장
- Species와 비지도학습 Feature 분리
- 수상한 외형/행동 ≠ 악당
- Tile 32×32
- Tiger Large 기준 Visual Height 80px
- 일반 NPC Visual Height 최대 96px
- Tiger Collision Footprint 26×16px
- Sprite Frame은 Species별 차등 허용
- Species 내부 Frame 규격은 통일
- Bottom-center Anchor
- 발 위치 Y 기준 Depth
- Sprite와 Collision Footprint 분리
- 4방향 이동
- General NPC Animation 6개: Idle / Walk / Run / Talk / Interact / Reaction
- Idle은 Species별 Micro Animation 적용
- Idle Timing Randomization 적용
- Optional Special Action 6개: Manhole Enter / Exit / Peek From Behind / Whisper / Sneak Take Object / Look Around → Run / Carry Box / Bag
- 비지도학습은 기존 Character Sprite + Hologram Effect 재사용
- 강화학습 AI 대응 로봇은 별도 Asset
- Robot Animation: Idle / Move / Turn / Interact / Crash / Disabled / Success

---

# 22. 다음 단계

Character Base 방향 Asset은 현재 5 Species 모두 완료되었다.

```text
5 Species
× Male/Female 2
× Down/Left/Right/Up 4
= 40 Direction Sprites
```

old CCTV1/CCTV2 `MANUAL_LABELING` technical baseline은 완료됐다.
현재 `PLAZA_CAM_A~E` Round 1 Scenario runtime과 persistent lifecycle은 구현·검증 완료됐다. 다음 Critical Path는
`FIRST_TRAINING` verification interaction 설계다. Character asset은 visual identity이고 Citizen/Villain 역할은 Round별 assignment가 결정한다.

Character Asset 측면에서 당장 새 Animation을 대량 제작하지 않는다.

향후 Character Scale/Collision 단계에서:

1. Rabbit / Fox / Cat / Dog의 실제 화면상 Visual Height 비교 검증
2. Rabbit / Fox / Cat / Dog의 Species별 Physical Footprint 별도 확정
3. Base 파일명 / Alpha / Padding / Bottom-center Anchor 최종 검증
4. 그 다음 Idle / Walk 등 Animation 제작

을 진행한다.

완료된 movement/navigation validation의 Collision Proxy는 다음과 같다.

```text
Rabbit → Small 18×12
Cat    → Medium 22×14
Fox    → Medium 22×14
Dog    → Medium 22×14
Tiger  → Large 26×16
```

Cat은 현재 `Small ~ Medium 후보` 중 Full Flow 검증에서
collision을 과소평가하지 않기 위해 Medium proxy를 사용한다.

`Max96`은 이번 Species 구성에 사용하지 않는다.

> Rabbit / Cat / Fox / Dog의 Full Flow용 Proxy Size는
> 실제 Species Physical Footprint 확정값이 아니다.
> Tiger 26×16만 실제 확정값이다.
