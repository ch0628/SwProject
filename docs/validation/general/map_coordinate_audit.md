# SWfestival Map Coordinate Audit — 2026-09-13

## 목적

Plaza & Park Graybox preflight에서 발견된 좌표 충돌 / 미정의 문제를
3개 지도학습 Map 전체에 확대 점검하고 Source of Truth를 정리했다.

이 문서는 변경 요약이며, 실제 좌표 Source of Truth는 각 Map Spec이다.

## Plaza & Park

수정:
- Building / Zone / Collision / Door Opening / Door Trigger 의미 분리
- Cafe Building을 X7~19, Y37~44로 보정
- Cafe 동쪽 문을 실제 2-tile 개구부(Y40~41)로 명시
- Public Facility Building을 X79~91, Y8~16으로 보정
- Facility 남쪽 문을 X84~85의 2-tile 개구부로 명시
- Facility와 충돌하던 Bench / Tree / Lamp / Fence 좌표 이동
- North Entry Connector X46~49, Y0~10 추가
- Park South Connector X46~49, Y17~24 추가
- Connector와 겹치던 Lamp / Bench 이동
- CCTV2를 X18~95, Y16~55로 보정하여 Cafe 일부 / 접근부를 실제 포함
- CCTV overlap을 X18~52, Y16~30으로 갱신
- W01~W22 exact tile anchor 확정

## Shopping District

구조적 좌표 충돌은 발견되지 않았다.

보완:
- Stall 10×6을 전체 Solid Block으로 오해하지 않도록 Visual / Functional Footprint로 정의
- Counter / Merchant Zone / Customer Front 의미 분리
- North Customer Front Y17, South Customer Front Y32 확정
- Box Zone은 전체 Solid가 아니라 Prop / Interaction 영역으로 명시
- Market Center와 Main Street / Walkway / Arch B overlap은 의도적인 논리 Zone overlap으로 명시
- W01~W26 exact tile anchor 확정

## Residential Area

발견된 구조 문제:
- Alley 1이 Rest Area와 겹침
- Alley 2가 Trash Zone과 겹침
- 기존 South Entry가 House E 방향으로 막힘
- House Enter / Exit용 실제 Door Opening 미정의
- W01~W22 exact 좌표 미정의

수정:
- Alley 1 → X29~30, Y12~38
- Rest Area → X22~27, Y34~39
- Trash Zone → X55~58, Y35~38
- South Entry → X28~30, Y50~51
- South Entry Connector → X28~30, Y39~49
- House A~F 2-tile Door Opening / Approach 좌표 추가
- P4 West Alley anchor → (29,25)
- W01~W22 exact tile anchor 확정
- Mailbox 접근 Anchor 별도 정의

## 공통 결론

Map 구현에서 다음을 구분한다.

- Zone: 논리 영역, 자동 Collision 아님
- Visual Footprint: 화면상 외형 범위
- Collision / Structure: 실제 통과 불가 영역
- Door Opening: 실제 벽 개구부
- Trigger / Approach: Interaction / Navigation Anchor
- Waypoint: Object 중심이 아니라 도달 가능한 Tile

다음 단계:
Plaza & Park Graybox를 수정된 `map_plaza_park_spec.md` 기준으로 구현하고
browser / collision / waypoint / CCTV coverage 검증을 수행한다.
