# SWfestival — Project State Current

## 1. 프로젝트 목표

초등학생이 여러 AI 개념을 **설명만 읽는 것이 아니라 직접 조작하고 결과를 경험하면서 이해하는 웹 게임**을 만든다.

상위 UX는 Blockly Games처럼 여러 학습 모듈이 하나의 허브 화면에 연결되는 구조를 목표로 한다.

예정 학습 모듈:

1. **인공지능(AI)** — AI가 무엇인지 이해하기
2. **머신러닝** — AI가 학습하는 방법
   - 지도학습
   - 비지도학습
   - 강화학습
3. **딥러닝** — 여러 층의 신경망으로 데이터의 특징을 학습하는 방법
4. **자연어 처리** — AI가 글과 말을 이해하는 방법
   - Attention
   - Transformer
5. **컴퓨터 비전** — AI가 이미지와 영상을 이해하는 방법

## 2. 현재 완료 상태

### 지도학습 모듈
상태: **Prototype Complete / Deployed**

현재 흐름:

```text
Ari Start
→ Round 1: 사용자가 직접 시민/악당 분류
→ 정답 데이터 생성
→ 중앙 AI 첫 학습
→ Round 2: 사용자 판단 vs AI 판단
→ AI 오류 확인 및 수정
→ 중앙 AI 재학습
→ AI Assisted Monitoring
→ Final Scan
→ City-Wide Result
→ Ari 최종 설명
→ Complete
```

핵심 교육 메시지:

> 정답이 있는 예시를 알려주며 AI를 가르치는 방법을 지도학습이라고 한다.

현재 배포 주소:

`https://sw-project-sooty.vercel.app/`

### 구현된 주요 UX
- Ari 안내
- CCTV 1~5 전환
- 시민/악당 one-click 분류
- 추적 기록 확인
- Round 2 사용자 판단 vs AI 판단
- 재학습
- AI Assisted Monitoring
- Final Scan
- City-Wide Result
- 지도학습 개념 연결
- Player / Developer mode 분리
- Vercel 배포

### 현재 미구현 / 후순위
- 캐릭터 행동 animation
- 실제 행동 sprite 연출
- Round observation timer
- 행동별 richer visual feedback

현재 프로토타입 진행을 막지 않으므로 후순위로 둔다.

## 3. 다음 작업

다음 모듈:

# 인공지능(AI) — AI가 무엇인지 이해하기

다음 세션의 첫 입력 자료:

- 팀원들과 협의한 **AI가 무엇인지 이해하기 파트 문서**
- 이 문서에서 확정된 학습 내용 / 스토리 / 상호작용 아이디어

다음 세션 목표:

1. 협의 문서를 읽고 확정 사항 / 미확정 사항 분리
2. 초등학생용 게임 interaction으로 구체화
3. AI Basics 모듈의 완료 조건 설계
4. 기존 지도학습 모듈과 연결 방식 설계
5. 전체 Hub에서 AI Basics → Machine Learning → Supervised Learning으로 이동 가능한 구조 설계
6. 사용자 승인 후 구현

## 4. 전체 허브 목표

예상 흐름:

```text
AI Learning Hub

[AI란?]
   ↓
[머신러닝]
   ├─ 지도학습
   ├─ 비지도학습
   └─ 강화학습

[딥러닝]

[자연어 처리]

[컴퓨터 비전]
```

각 원형 노드는 클릭 가능한 학습 모듈이어야 한다.

허브에서 사용자는:
- 학습 모듈 선택
- 완료 여부 확인
- 이전 모듈로 돌아가기
- 다음 관련 모듈로 이동

할 수 있어야 한다.

## 5. 핵심 원칙

### 교육
- 설명 → 시험 구조보다 **문제 발생 → 조작 → 결과 → 설명** 구조를 우선한다.
- 초등학생이 먼저 경험한 뒤 개념 이름을 알려준다.
- 개발자/전문 용어를 Player UI에 그대로 노출하지 않는다.

### 개발
- 이미 검증된 지도학습 gameplay는 이유 없이 다시 수정하지 않는다.
- 새로운 모듈은 가능한 한 독립적인 module 단위로 만든다.
- 공통 Hub / Navigation / Completion state만 공유한다.
- 구현 전 `검토 → 사용자 승인 → 구현` 순서를 지킨다.

### 프로토타입 기준
> 프로토타입을 막는 FAIL만 즉시 수정한다. WARN은 기록하고 다음으로 넘어간다.
