# Skill: Review Code

## 목적
기능 구현 후 구조/버그/성능 위험을 검토한다.

## 검토 항목
- Source of Truth 위반
- React / Phaser 책임 혼합
- state duplication
- unnecessary rerender
- per-frame allocation
- 불필요한 DOM 사용
- asset lifecycle 문제
- Scene cleanup 누락
- event listener cleanup
- type safety
- hard-coded magic values
- 향후 확장 시 구조적 병목

## 출력
각 항목을:
- PASS
- WARN
- FAIL
로 분류한다.

FAIL만 즉시 수정 후보로 본다.
WARN은 사용자에게 영향과 우선순위를 설명한다.
