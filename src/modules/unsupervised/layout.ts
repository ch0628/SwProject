// 좌표평면 표시용 배치 (렌더링 의존 없는 순수 함수)
// 실제 특징값과 군집 결과는 바꾸지 않는다. 화면에서 가까운 주민끼리 스프라이트가 겹치지 않도록 표시 위치만 조금 밀어낸다.

export type PlanePoint = Readonly<{ id: string; x: number; y: number }>;

export type SpreadOptions = Readonly<{
  /** 평면의 가로/세로 비율. 거리는 세로 길이를 1로 본 단위로 계산한다. */
  aspect: number;
  /** 주민 사이 최소 표시 거리 (세로 길이 단위) */
  minDistance: number;
  /** 원래 좌표에서 벗어날 수 있는 최대 거리 (세로 길이 단위) */
  maxShift: number;
  /** 평면 안쪽 여백까지 밀어낼 수 있는 범위 (0~1 밖으로 이만큼 허용) */
  margin?: number;
  iterations?: number;
}>;

/** 좌표평면(62cqw × 36.5cqw) 기준 값. 스프라이트 폭(약 2~3cqw)이 겹치지 않을 정도의 최소 거리. */
export const PLANE_SPREAD_OPTIONS: SpreadOptions = Object.freeze({ aspect: 62 / 36.5, minDistance: 0.13, maxShift: 0.16, margin: 0.06 });

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 결정적 배치: 같은 입력이면 같은 결과. 입력 배열은 수정하지 않는다. */
export function spreadPoints(points: readonly PlanePoint[], options: SpreadOptions): Map<string, { x: number; y: number }> {
  const { aspect, minDistance, maxShift, margin = 0, iterations = 40 } = options;
  const origin = [...points].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((p) => ({ id: p.id, x: p.x * aspect, y: p.y }));
  const pos = origin.map((p) => ({ ...p }));

  for (let iteration = 0; iteration < iterations; iteration++) {
    let moved = false;
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        let dx = pos[j].x - pos[i].x;
        let dy = pos[j].y - pos[i].y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;
        if (distance < 1e-9) {
          // 완전히 겹친 경우에도 결정적인 방향으로 벌린다.
          const angle = ((i * 7 + j * 13) % 360) * (Math.PI / 180);
          dx = Math.cos(angle); dy = Math.sin(angle); distance = 1;
        }
        const push = (minDistance - Math.hypot(pos[j].x - pos[i].x, pos[j].y - pos[i].y)) / 2;
        pos[i].x -= (dx / distance) * push; pos[i].y -= (dy / distance) * push;
        pos[j].x += (dx / distance) * push; pos[j].y += (dy / distance) * push;
        moved = true;
      }
    }
    for (let k = 0; k < pos.length; k++) {
      const shiftX = pos[k].x - origin[k].x;
      const shiftY = pos[k].y - origin[k].y;
      const shift = Math.hypot(shiftX, shiftY);
      if (shift > maxShift) {
        pos[k].x = origin[k].x + (shiftX / shift) * maxShift;
        pos[k].y = origin[k].y + (shiftY / shift) * maxShift;
      }
      pos[k].x = clamp(pos[k].x, -margin * aspect, (1 + margin) * aspect);
      pos[k].y = clamp(pos[k].y, -margin, 1 + margin);
    }
    if (!moved) break;
  }
  return new Map(pos.map((p) => [p.id, { x: p.x / aspect, y: p.y }]));
}

/** [패턴 찾기] 전 대기 위치: 평면 가운데 6명씩 두 줄 */
export function startPosition(index: number): { x: number; y: number } {
  return { x: 0.22 + (index % 6) * 0.11, y: index < 6 ? 0.62 : 0.4 };
}
