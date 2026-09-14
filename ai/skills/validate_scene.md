# Skill: Validate Phaser Scene

## 목적
Phaser Scene의 기능, 시각적 문제, 성능 문제를 검증한다.

## 필수 검증
- Scene 정상 진입
- console error 없음
- asset load failure 없음
- 1920×1080 화면에서 clipping 없음
- target logical resolution 정상
- FPS 확인
- camera follow / zoom 정상
- depth sorting 정상
- bottom-center anchor 정상
- collision footprint 정상
- object occlusion 정상
- Scene 종료 후 event/listener 정리

## Scale Validation 추가 검증
- character vs door scale
- character vs road width
- character vs bench/tree/lamp scale
- 30~35 NPC 배치 가능성
- 화면 정보 밀도
- zoom 1.75 / 2.0 / 2.25 비교

## 출력
- PASS
- WARN
- FAIL
- screenshot / reproduction step
- 추천 수정안

설계 규격 변경이 필요한 경우 자동 변경하지 않는다.
