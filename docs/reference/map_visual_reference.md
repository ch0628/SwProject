# SWfestival Map Visual Reference Board

## 1. 문서 목적

이 문서는 SWfestival의 실제 맵을 제작할 때 사용할 **시각적·공간적 레퍼런스 원칙**을 정리한다.

목적은 특정 게임의 맵이나 그래픽을 그대로 복제하는 것이 아니라,
각 레퍼런스에서 프로젝트에 필요한 장점을 추출하여
SWfestival만의 일관된 맵 디자인 기준을 만드는 것이다.

이 문서는 다음 작업의 공통 시각 기준으로 사용한다.

- 광장·공원 맵
- 상점가 맵
- 주거지역 맵
- Tiled 기반 실제 맵 제작
- 환경 Asset 제작
- CCTV Coverage 설계
- NPC 이동 동선 및 Behavior Point 배치

Map별 실제 크기와 좌표는 각 Map Spec을 Source of Truth로 사용한다.

---

# 2. 프로젝트 고정 방향

## 플랫폼 / 화면

- PC / 노트북 웹
- Landscape
- top-down 2.5D
- pixel-art 기반
- Orthogonal Tilemap
- Tile Size = 32×32
- React + TypeScript + Vite
- Phaser 4 + Tiled

## 캐릭터 / 공간

- 의인화 동물 도시
- Small / Medium / Large / Oversize Species가 동일한 공공 공간을 사용
- Tiger = Large 기준, 80px
- 일반 NPC 최대 Visual Height = 96px
- Character 위치 기준 = Bottom Center
- Depth = feet Y
- Visual Sprite와 Collision Footprint 분리
- 공공 공간은 최대 일반 NPC도 무리 없이 이동할 수 있도록 설계

## 플레이 특성

- 광장·공원 / 상점가는 약 30~35명의 NPC가 실제 이동할 수 있어야 함
- 주거지역은 약 25~30명의 낮은 체감 밀도를 사용
- 사용자는 캐릭터를 직접 조종하는 것이 아니라 CCTV / 관제 시스템을 조작
- 맵은 미관뿐 아니라 NPC 이동, 관찰, 추적, 행동 발생을 지원해야 함
- 장식 요소 때문에 CCTV 시야와 NPC 추적성이 크게 떨어지면 안 됨

---

# 3. Reference A — Stardew Valley

## 가져올 요소

### 3.1 읽기 쉬운 top-down 공간 구획

공간의 역할이 화면만 보고도 구분되어야 한다.

예:
- 공원
- 광장
- 길
- 건물
- 녹지
- 출입구

### 3.2 공간 간 자연스러운 연결

공간을 단절된 방처럼 만들지 않고,
길과 열린 공간을 통해 자연스럽게 연결한다.

예:

```text
산책로
  ↓
공원
  ↓
중앙 광장
  ↓
Main Route
  ↓
다른 구역
```

### 3.3 적당한 빈 공간

모든 Tile을 Object로 채우지 않는다.

NPC 이동과 CCTV 관찰을 위해
의도적으로 열린 공간과 이동 여백을 남긴다.

## 가져오지 않을 요소

- 농촌 중심 세계관
- 지나치게 작은 캐릭터 Scale
- 복잡한 농장 배치
- SWfestival Gameplay와 관계없는 농업 중심 오브젝트

---

# 4. Reference B — Animal Crossing

## 가져올 요소

### 4.1 친근한 공원 / 광장 구성

적은 수의 친근한 Object로 공간의 성격을 만든다.

공원 기본 구성:

```text
Park
├─ Tree
├─ Bench
├─ Streetlamp
├─ Bush
├─ Fence
├─ Flower patches
└─ Walkway
```

### 4.2 Bench

광장·공원 Map의 Park 내부에는 **Bench 2~3개**를 배치한다.

- 기본 Bench = 3×1 tiles
- 일부 Bench는 Behavior Point로 사용
- Sit / Wait / Talk 등과 연결 가능
- 모든 Bench에 반드시 NPC가 몰리도록 만들지는 않음

Central Plaza의 Bench는 공원 Bench와 별도로 가장자리에 3~4개 배치한다.

### 4.3 자연물과 거리 요소의 반복 활용

Asset 종류를 과도하게 늘리기보다
같은 종류의 Object를 위치와 조합을 달리하여 재사용한다.

예:
- Tree 2~3 variants
- Bush 1~2 variants
- Streetlamp 1 base
- Bench 1 base
- Fence modular pieces

## Flower 처리

Flower는 기본적으로 **Decoration**으로 취급한다.

- Gameplay Interaction 없음
- Collision 없음
- Behavior Point 아님
- `Ground_Detail` 또는 Decoration Layer에 배치
- 캐릭터가 통과 가능
- Flower Patch 형태로 반복 배치 가능

## 가져오지 않을 요소

- 지나치게 장식이 많은 공간
- NPC 이동로를 막는 고밀도 Decoration
- CCTV 관찰을 방해하는 과도한 시각 요소
- 3D 시점 자체

---

# 5. Reference C — Zootopia

## 가져올 요소

### 5.1 다양한 체격의 동물이 공유하는 도시

Small부터 Oversize까지 다양한 Species가
같은 공공 공간을 사용할 수 있어야 한다.

공공 공간은 특정 Species 전용 크기로 설계하지 않는다.

### 5.2 공공 공간의 여유

- 공공 출입구는 최소 2 tiles
- 일반적인 공공 보행로는 3 tiles를 기본값으로 사용
- 2 tiles는 Narrow / Special Path
- 4 tiles는 필요할 때 사용하는 High-traffic Walkway
- 5~6 tiles는 Main Route / 넓은 접근로
- Oversize 일반 NPC도 통행 가능한 구조를 우선

### 5.3 밝고 친근한 동물 도시 분위기

전체 분위기:
- 따뜻함
- 활기
- 안전함
- 초등학생 친화적
- 현대적인 동물 도시

## 가져오지 않을 요소

- 현실적인 3D 도시 Scale
- 복잡한 다층 구조
- 영화 수준의 도시 밀도
- Species별로 완전히 별도의 도시 Infrastructure를 만드는 방식

---

# 6. Reference D — Back to the Dawn

## 가져올 요소

### 6.1 의인화 동물과 환경의 시각적 비율

캐릭터가 환경에 비해 너무 작아
얼굴이나 Species가 읽히지 않게 만들지 않는다.

### 6.2 Pixel Character와 도시 환경의 통일감

- 캐릭터와 환경의 디테일 수준이 지나치게 차이나지 않음
- Character silhouette가 배경에 묻히지 않음
- 건물 / Object / NPC 비율이 자연스럽게 유지

### 6.3 도시형 의인화 동물 분위기

동물이 단순한 Mascot이 아니라
도시의 실제 주민처럼 느껴지도록 한다.

## 가져오지 않을 요소

- 어둡고 폐쇄적인 감옥 분위기
- 무거운 색조
- 초등학생 대상 서비스와 맞지 않는 위협적 연출

---

# 7. SWfestival 전용 Map Design 원칙

레퍼런스보다 아래 프로젝트 규칙을 우선한다.

## 7.1 CCTV 가독성 우선

NPC를 관찰하고 클릭해야 하므로:

- 나무가 화면 중앙을 과도하게 가리지 않도록 함
- 큰 Object를 주요 이동로 바로 앞에 반복 배치하지 않음
- Building / Stall / House Foreground가 NPC를 장시간 완전히 가리지 않도록 함
- 열린 공간을 충분히 확보

## 7.2 실제 이동 가능한 공간

맵은 정적인 배경이 아니다.

동시에 다음이 가능해야 한다.

- NPC 이동
- NPC 교행
- 잠시 대기
- 대화
- Bench 사용
- 상점 / 주택 / 구조물 관련 행동
- CCTV Coverage 내부 / 사이 이동

## 7.3 Gameplay Object와 Decoration 분리

### Navigation Object
- Road / Main Route
- Walkway
- Narrow Path
- Entrance
- Exit
- Door / Gate
- Service Alley

### Interactive / Behavior Object
- Bench
- Cafe Door
- Public Facility Door
- Stall Front
- Box / Delivery Zone
- Mailbox
- Manhole
- Waiting Point

### Decoration
- Flower
- Grass Detail
- Planter
- 작은 장식
- 비상호작용 표지
- Habitat Yard Detail

Decoration에 불필요한 Gameplay Logic을 연결하지 않는다.

## 7.4 공간이 역할을 가지되 Role 정답은 제공하지 않음

장소와 외형은 행동 확률이나 분위기에 영향을 줄 수 있지만
Citizen / Villain의 정답을 직접 제공하지 않는다.

예:

```text
Bench
→ Sit / Wait 확률 증가

Shopping Stall
→ Browse / Buy / Carry Bag 가능

Residential Mailbox
→ Mailbox Check 가능
```

하지만:

```text
골목에 들어감 = Villain
맨홀 근처 = Villain
Mailbox 확인 = Villain
선글라스 착용 = Villain
```

처럼 만들지 않는다.

---

# 8. 광장·공원 Map Reference 방향

## 전체 Layout
**Stardew Valley 방향**
- 구역이 한눈에 읽힘
- Park → Central Plaza → Main Route 연결이 명확
- 빈 공간을 충분히 확보

## Park Detail
**Animal Crossing 방향**
- Bench 2~3
- Tree
- Streetlamp
- Bush
- Fence
- Flower Patch
- 산책로

## 도시 / Species Scale
**Zootopia 방향**
- Small~Oversize 일반 NPC가 동일 공간 사용
- 공공 공간은 큰 Species까지 고려
- 밝고 친근한 동물 도시

## Pixel Character / Environment 비율
**Back to the Dawn 방향**
- 동물 Character가 맵에서 충분히 읽힘
- Character와 건물 / Object Scale이 어색하지 않음

## 현재 확정 크기

```text
Plaza & Park
= 96×56 tiles
```

세부 좌표와 Object 배치는:
- `docs/map_plaza_park_spec.md`

를 Source of Truth로 사용한다.

---

# 9. 상점가 Map Reference 방향

상점가는 건물 Interior 중심이 아니라 **오픈형 골목시장 / Stall 중심**으로 설계한다.

핵심:
- Main Street 중심의 높은 보행 밀도
- North / South Stall Row
- Service Alley
- Arch Entrance
- Box / Delivery Zone
- Merchant / Delivery 행동
- Market Center에서 CCTV 3 / 4 Coverage overlap

현재 확정 크기:

```text
Shopping District
= 96×50 tiles
```

세부 좌표는:
- `docs/map_shopping_district_spec.md`

를 Source of Truth로 사용한다.

---

# 10. 주거지역 Map Reference 방향

주거지역은 세 지도 중 가장 낮은 체감 밀도를 가진다.

핵심:
- House 6채
- Yard
- Main Residential Street
- Walkway
- Narrow Alley
- Mailbox
- Lamp / Shadow
- Rest Area
- Trash / Recycling
- CCTV 5 제한적 Pan

Species별 Yard는 실제 동물 우리를 복제하지 않고,
**야생 서식환경 또는 환경풍부화 요소를 도시형 Yard 디자인으로 번역**한다.

현재 확정 기본 Species:
- Rabbit
- Fox
- Tiger
- Cat
- Dog

현재 확정 크기:

```text
Residential Area
= 84×52 tiles
```

세부 좌표와 Species Habitat Theme은:
- `docs/map_residential_spec.md`

를 Source of Truth로 사용한다.

---

# 11. Reference 이미지 보관 원칙

Reference 이미지를 프로젝트의 필수 Source of Truth로 사용하지 않는다.

핵심:

> 이미지 자체가 아니라 이미지에서 추출한 디자인 원칙을 문서로 보존한다.

원한다면 대표 Screenshot을 개인 개발 참고용으로 보관할 수 있다.

예:

```text
references/
└─ map/
   ├─ stardew_layout_reference.jpg
   ├─ animal_crossing_park_reference.jpg
   ├─ zootopia_city_reference.jpg
   └─ back_to_the_dawn_scale_reference.jpg
```

단:
- 최종 배포 Asset으로 사용하지 않음
- 그대로 복제하지 않음
- Git 저장은 선택 사항
- 이미지가 없어도 이 문서와 각 Map Spec만으로 설계 방향을 이해할 수 있어야 함

---

# 12. 현재 확정 요약

```text
Main Layout Reference
= Stardew Valley

Park / Plaza Detail Reference
= Animal Crossing

Multi-Species Public Space Reference
= Zootopia

Pixel Character / Environment Scale Reference
= Back to the Dawn

Tile
= 32×32

Tiger Large
= 80px

General NPC Visual Max
= 96px

Standard Public Walkway
= 3 tiles

Narrow / Special Path
= 2 tiles

High-traffic Walkway
= 4 tiles 선택값

Main Route
= 5~6 tiles

Plaza & Park
= 96×56

Shopping District
= 96×50

Residential Area
= 84×52

Reference Image
= 선택적 보관

Reference Principles + Map Specs
= Source of Truth
```

---

# 13. 현재 단계

3개 지도학습 Map의 상세 설계는 완료되었다.

```text
docs/map_plaza_park_spec.md
docs/map_shopping_district_spec.md
docs/map_residential_spec.md
```

다음 Map 관련 단계는 **광장·공원부터 실제 Tiled / Phaser Map 초안을 구현하고 검증하는 것**이다.

구현 시 이미 확정된 Map Size, Path Width, CCTV 구조, Waypoint 방향을 임의로 변경하지 않는다.
