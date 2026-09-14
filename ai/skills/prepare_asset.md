# Skill: Prepare Character Asset

## 목적
AI 생성 Character Reference를 게임 테스트용 Asset으로 정리한다.

## 입력
- 4-direction master reference
- 순서: Down / Left / Right / Up

## 기본 작업
- 방향별 이미지 분리
- background 제거 또는 투명화
- 각 방향 캐릭터 bounding box 확인
- 불필요한 텍스트/격자 제거
- bottom-center 기준 정렬
- 원본 비율 유지
- 임의 확대/축소 금지

## 출력 파일명
- `<species>_down.png`
- `<species>_left.png`
- `<species>_right.png`
- `<species>_up.png`

## 중요
Scale Validation 전에는 각 방향의 체감 크기를 강제로 같게 만들지 않는다.
실제 게임 화면에서 확인한 뒤 규격을 확정한다.
