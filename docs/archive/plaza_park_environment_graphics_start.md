# Plaza/Park Environment Graphics Integration — Current Start Point

## 1. 현재 상태

Traffic validation은 종료됐다.

```text
10 active movers = PASS with WARN
30 active movers = FAIL
35 active movers = FAIL
```

Prototype Operating Density:

```text
10 active movers
```

현재 단계:

```text
Plaza/Park Environment Graphics Integration
```

---

## 2. Graphics Integration에서 절대 바꾸지 않을 것

```text
Map Geometry
Collision
W01~W22
Door Opening
Path Width
CCTV Coverage Geometry
10 active movers Operating Density
```

Graphics는 시각 표현 통합 작업이다.

Traffic 문제를 Graphics 단계에서 다시 해결하지 않는다.

---

## 3. Integration 목표

기존 완료된 Environment Asset들을
현재 Plaza/Park Graybox 구조 위에 배치한다.

검증 대상:

```text
asset scale
tile / world alignment
layer order
feetY Y-sort
door / walkway readability
collision과 visual의 불일치 여부
NPC clipping
CCTV visibility
```

---

## 4. PASS 원칙

Graphics 적용 후:

```text
기존 geometry 유지
기존 collision 유지
door 진입 가능
10 active movers flow 유지
NPC clipping 없음
주요 walkway 시각적으로 읽힘
CCTV interaction 위치 가려지지 않음
```

이면 Graphics Regression으로 넘어간다.

Prototype을 막지 않는 visual WARN은 기록하고 진행한다.

---

## 5. 현재 다음 작업

```text
Environment Graphics Integration 설계 검토
→ 사용자 승인
→ 구현
```

아직 구현하지 않는다.
