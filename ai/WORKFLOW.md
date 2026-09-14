# SWfestival AI Workflow

모든 주요 작업은 아래 순서로 진행한다.

## 1. Load Resources
현재 작업에 필요한 문서만 읽는다.

반드시:
- `ai/RULES.md`

필요 시:
- `ai/CONTEXT_MAP.md`
- 관련 spec / rules 문서
- 관련 code

전체 docs를 무조건 읽지 않는다.

## 2. Analysis
- 현재 구현 상태 확인
- 관련 코드/문서 충돌 여부 확인
- 요청 범위 확인
- 아직 결정되지 않은 사항 확인

## 3. Design Decision Check
아래에 해당하면 구현 전에 사용자에게 보고한다.
- 새 구조가 필요한 경우
- Source of Truth와 충돌하는 경우
- 두 가지 이상 의미 있는 선택지가 있는 경우
- 성능/UX에 큰 영향을 주는 경우

사소한 구현 디테일은 기존 규칙과 코드 관례에 맞춰 처리할 수 있다.

## 4. Human Review Gate
중요 설계 변경이 필요하면:
- 문제
- 선택지
- 추천안
- 영향
을 짧게 정리하고 사용자의 승인을 기다린다.

## 5. Implementation
승인된 범위만 구현한다.

## 6. Validation
작업 성격에 맞게 다음을 수행한다.
- typecheck
- lint
- build
- unit / integration test
- browser verification
- FPS / console / asset loading check

## 7. Report
완료 시 반드시 보고한다.
- 변경된 파일
- 구현한 기능
- 테스트/검증 결과
- placeholder 또는 미완성 항목
- 새롭게 발견된 위험요소
- 다음 작업 제안

## 원칙
"코드를 많이 쓰는 것"보다 "올바른 범위를 정확히 구현하는 것"을 우선한다.
