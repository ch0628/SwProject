# STEP 3 — Game-ready 4방향 Sheet 생성 프롬프트

## 목적

확정된 Master Reference를 바탕으로 **Phaser Scale Validation에 넣기 좋은 4방향 Sheet**를 만든다.

이 단계는 새 디자인 작업이 아니다.

목표:
- Down / Left / Right / Up을 동일한 Sheet 규격으로 출력
- 배경/라벨/격자 제거
- 자동 분리가 쉬운 구조 확보
- 방향별 상대 Scale 유지
- Animation 제작 전 Base Asset 확보

---

## 사용 전 조건

STEP 2에서 확정된 Master Reference 이미지를 첨부한다.

---

## 프롬프트

```text
첨부한 [캐릭터 별 내용 수정: 동물 종 이름] Master Reference를 기준으로,
실제 top-down 2.5D pixel-art 웹 게임의 Scale Validation에 사용할
game-ready 4방향 기준 sheet를 만들어줘.

이 작업은 캐릭터를 새로 디자인하는 작업이 아니다.
첨부된 Master Reference의 identity와 비율을 최대한 그대로 유지해야 한다.

[반드시 유지]
- 현재 캐릭터 identity
- 현재 체형
- 현재 Species 고유 특징
- 현재 얼굴
- 현재 색상/무늬
- 현재 기본 의상
- 현재 친근한 분위기

[프로젝트 고정 조건]
- PC / 노트북 웹
- Landscape
- top-down 2.5D
- pixel-art 기반
- Tile Size = 32×32
- Phaser Scale Validation용

[출력]
동일한 한 캐릭터를 가로로 나란히 배치:

1. Down
2. Left
3. Right
4. Up

[셀 구성]
- 네 방향을 정확히 동일한 크기의 4개 셀에 배치
- 가능하면 전체 결과의 가로 길이가 4로 정확히 나누어지도록 구성
- 각 셀 내부에 충분한 투명 여백을 확보
- 머리, 귀, 꼬리, 발 등이 셀 경계에 닿지 않게 할 것
- 향후 animation에서 움직임이 추가될 것을 고려하여 상/하/좌/우 여백을 남길 것
- 각 셀에서 bottom-center 기준이 일관되게 느껴지도록 배치

[배경]
- 투명 배경을 우선
- 격자 금지
- 장면 배경 금지
- 그림자 배경 금지
- 설명용 텍스트 금지
- 방향명 라벨 금지
- 캐릭터 외 오브젝트 금지

[시점]
- 완전한 정면/측면/후면 일러스트가 아니라 실제 top-down 2.5D 게임 시점
- 방향에 따른 자연스러운 실루엣 차이는 허용
- 하지만 Scale과 전체 체형은 일관되어야 함

[픽셀아트]
- 작은 게임 화면에서도 Species가 즉시 읽혀야 함
- 과도한 세부 음영/텍스처 금지
- 명확한 실루엣 우선
- 4방향의 픽셀 밀도와 외곽선 표현을 일관되게 유지

[절대 하지 말 것]
- 캐릭터 재디자인
- 새로운 의상
- 액세서리 추가
- Idle / Walk / Run frame 추가
- 서로 다른 4명의 캐릭터 생성
- 방향별 임의 확대/축소
- 격자 또는 방향명 출력

이 결과물은 이후 deterministic crop으로
4개의 개별 PNG로 분리될 예정이다.
```

---

## 이 단계의 핵심

- 반드시 4개 셀이 동일 폭이어야 한다.
- 가능하면 투명 배경 PNG를 사용한다.
- 각 셀의 캐릭터가 경계에 붙지 않게 여백을 둔다.
- 이 Sheet 자체는 최종 애니메이션 Sheet가 아니다.
