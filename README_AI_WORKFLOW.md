# SWfestival AI Workflow Setup

## 목적
Codex/AI 도구가 프로젝트 전체를 매번 읽지 않고,
작업별 최소 Context로 안전하게 작업하도록 한다.

## 설치
이 폴더의 `ai/`를 프로젝트 루트에 복사한다.

추천 프로젝트 구조:

```text
swfestival/
├─ ai/
│  ├─ RULES.md
│  ├─ WORKFLOW.md
│  ├─ CONTEXT_MAP.md
│  └─ skills/
├─ docs/
├─ assets/
├─ src/
└─ tests/
```

## AI에게 작업을 줄 때 기본 프롬프트

```text
먼저 ai/RULES.md와 ai/WORKFLOW.md를 읽어라.
그 다음 ai/CONTEXT_MAP.md를 보고 이번 작업에 필요한 문서만 읽어라.
관련 없는 문서는 읽지 마라.

이번 작업:
<작업 내용>

적용 Skill:
<ai/skills/...>

중요한 미확정 설계가 발견되면 구현 전에 보고하고 승인을 기다려라.
완료 후 변경 파일, 검증 결과, 미완성 항목을 보고하라.
```

## 토큰 절감 원칙
- 항상 전체 docs를 넣지 않는다.
- 작업마다 CONTEXT_MAP을 통해 필요한 문서만 선택한다.
- 반복 절차는 skills 문서로 재사용한다.
- 이미 확정된 규칙은 프롬프트 본문에서 반복하지 않는다.
