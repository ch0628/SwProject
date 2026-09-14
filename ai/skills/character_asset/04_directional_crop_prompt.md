# STEP 4 — 4방향 Deterministic Crop 프롬프트

## 목적

STEP 3에서 생성한 4방향 Sheet를 **이미지 재생성 없이 정확히 4개 PNG로 분리**한다.

이 단계에서는 생성형 이미지 모델을 사용하지 않는다.

추천:
- Python Pillow
- ImageMagick
- 기타 deterministic crop 방식

---

## 프롬프트

```text
첨부한 [캐릭터 별 내용 수정: 동물 종 이름] 4방향 PNG Sheet를
실제 게임 Scale Validation용 4개의 개별 PNG로 분리해줘.

중요:
이 작업은 이미지 생성, 재디자인, 보정 작업이 아니다.
원본 Pixel과 Alpha Channel을 그대로 유지하면서 deterministic crop만 수행해야 한다.

먼저 원본 이미지의 실제 Width / Height / Color Mode를 확인해줘.

조건:
- 가로로 동일한 4개 셀
- 순서:
  1. Down
  2. Left
  3. Right
  4. Up

원본 Width가 정확히 4로 나누어진다면:

cell_width = image_width / 4

Crop:
- Down:
  x = 0 ~ cell_width-1

- Left:
  x = cell_width ~ (cell_width*2)-1

- Right:
  x = cell_width*2 ~ (cell_width*3)-1

- Up:
  x = cell_width*3 ~ image_width-1

- y는 네 이미지 모두 전체 Height 사용

출력:
- [캐릭터 별 내용 수정: species]_down.png
- [캐릭터 별 내용 수정: species]_left.png
- [캐릭터 별 내용 수정: species]_right.png
- [캐릭터 별 내용 수정: species]_up.png

반드시 유지:
- 원본 RGBA / Alpha
- 원본 Pixel
- 원본 셀 크기
- 원본 캐릭터 상대 Scale

절대 하지 말 것:
- 이미지 재생성
- 리사이즈
- 방향별 확대/축소
- bounding box trim
- 위치 재조정
- padding 변경
- 색상 변경
- sharpening
- smoothing
- resampling
- 투명 여백 제거

가능하면 Python Pillow 등의 deterministic image crop을 사용한다.

완료 후 보고:
1. 원본 크기
2. 각 출력 이미지 크기
3. Color Mode
4. Alpha Channel 유지 여부
5. 생성된 4개 파일명
```

---

## 결과 예시

```text
rabbit_down.png
rabbit_left.png
rabbit_right.png
rabbit_up.png
```

네 방향의 Canvas Size는 반드시 동일해야 한다.
