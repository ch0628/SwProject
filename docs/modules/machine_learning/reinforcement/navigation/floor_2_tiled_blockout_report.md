# Floor 2 Colored Geometry Review

## 1. 작업 범위

기존 `floor_2_blockout.tmj`의 Node/Edge ID와 route topology를 유지하고 geometry만 수정했다. 기준은 `navigation_v2/floor_2_structure_clean_v2.png`이며 Floor 1, Floor 3, Learning Engine은 편집하지 않았다.

## 2. Map 규격

- Orthogonal 80×45, tile 32×32px, world 2560×1440px
- 기존 5개 tile layer와 7개 object layer 유지
- Floor 1 manual room-shell tileset 재사용

## 3. 색상 해석 반영

- RED: 내부 짧은 경로
- ORANGE: 외곽 긴 경로
- GREEN: 남향 잠금문 앞 2×2 이하 recess
- PINK/GRAY: 비보행 collision mass
- BLUE: 세 stair landing
- WHITE: guard/convergence 구역

각 tile center를 원본 색 영역과 대조해 `Ground`와 `Walls`를 생성했고 validator가 전 셀을 재검사한다.

## 4. 좌우 대칭

Arrival, short-zone, long-zone Node 좌표는 `x_left + x_right = 2560`, `y_left = y_right`다. 네 route polyline과 길이도 좌우 대칭이다.

## 5. Navigation Node 좌표

| Node | 좌표 |
|---|---:|
| `F2_LEFT_ARRIVAL` | `(304,1120)` |
| `F2_LEFT_DIRECT_ZONE` | `(1040,848)` |
| `F2_LEFT_OUTER_ZONE` | `(640,400)` |
| `F2_RIGHT_ARRIVAL` | `(2256,1120)` |
| `F2_RIGHT_INNER_ZONE` | `(1520,848)` |
| `F2_RIGHT_SERVICE_ZONE` | `(1920,400)` |
| `F2_CENTER_GUARD` | `(1280,560)` |
| `F2_CENTER_STAIR` | `(1280,304)` |

## 6. Edge topology

기존 9개 Edge ID와 연결 관계를 유지했다. LEFT/RIGHT 및 short/long polyline은 guard 전에는 교차하지 않으며 네 route는 `F2_CENTER_GUARD`에서만 수렴한다. Stair의 유일한 연결은 `E_F2_GUARD_STAIR`다.

## 7. 실제 경로 길이

| Side | Short | Long | Long/Short |
|---|---:|---:|---:|
| LEFT | 45.831 tiles | 59.071 tiles | **1.289** |
| RIGHT | 45.831 tiles | 59.071 tiles | **1.289** |

양쪽 모두 필수 1.20 이상이며 권장 25~30% 범위인 약 28.9% 증가다.

## 8. Room/door/recess

두 PINK room은 정확한 source bounds를 가진 `ROOM_MASS` collision이다. 문은 남쪽 면의 `LOCKED_SOUTH_DOOR` 두 개뿐이며 `locked=true`, `enterable=false`, `doorFacing=SOUTH`다. GREEN recess에는 Node가 없고 모든 Edge와 Encounter는 room 내부에 들어가지 않는다.

## 9. Collision

22개 collision object가 PINK/GRAY 영역과 중앙 blocked mass를 차단한다. North-Center stair의 `(1088,64)–(1440,256)` footprint는 collision에서 완전히 제외했다. 모든 Navigation polyline은 24px debug robot clearance를 통과하며 중앙 mass는 pre-guard 좌우 shortcut도 차단한다.

## 10. Encounter/guard

기존 4개 Encounter 의미를 유지하고 corridor에 재배치했다. `F2_CENTER_GUARD_ZONE`은 `villainCount=2`, `bypassAvailable=false`, actions=`SUBDUE,DISTRACT,RETREAT`다. Guard를 제거한 graph에서는 어느 Arrival도 stair에 도달하지 못한다.

## 11. Stair/transition

South-West, South-East, North-Center의 정확히 3개 stair footprint다. Blue landing은 walkable이며 `F2_CENTER_STAIR_TRANSITION`은 `targetFloor=3`, `targetSpawn=F3_CENTER_ARRIVAL`을 유지한다.

## 12. Validator 결과

```text
PASS floor_2_blockout
map=80x45 tile=32x32 objects=50
nodes=8 edges=9 collision=22 stairs=3
direct=45.831 outer=59.071 tiles
inner=45.831 service=59.071 tiles
ratios=LEFT:1.289 RIGHT:1.289 source=floor_2_structure_clean_v2.png
reachability=PASS convergence=F2_CENTER_GUARD transition=F3_CENTER_ARRIVAL
```

중복 Tiled object/node/edge ID, source color mask, room collision, locked south doors, pre-guard crossover, guard bypass, stair reachability, 경로 비율을 자동 검사한다.

## 13. Phaser playtest

- LEFT short/long → center guard: PASS
- RIGHT short/long → center guard: PASS
- Guard → center stair: PASS
- LEFT/RIGHT green approach → locked room collision: PASS
- Collision, Navigation, Encounter/Transition overlay ON: PASS
- Browser console warning/error: 없음

Debug 화면은 route/room/stair probe 버튼과 기존 keyboard controls를 함께 제공한다.

## 14. 보호 범위와 판단

작업 전후 Floor 1 map 및 관련 세 PNG SHA-256이 동일하다. 별도 사용자 변경으로 이미 dirty였던 Floor 1/3 문서·asset은 되돌리거나 편집하지 않았다.

**PASS_FOR_FLOOR2_GEOMETRY_REVIEW**

Floor 2 visual polish, Floor 3 구현, Learning Engine/reward tuning은 수행하지 않았다.
