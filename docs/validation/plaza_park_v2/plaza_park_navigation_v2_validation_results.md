# Plaza/Park Navigation v2 Edge Validation Results

Updated: 2026-09-14

## 대상

```text
Map: public/maps/plaza-park-v2.tmj
Node Layer: Navigation_v2
Edge Layer: Navigation_Edges_v2
Specification: docs/plaza_park_navigation_v2_spec.md
Validator: scripts/validate-plaza-park-navigation-v2.mjs
```

35 NPC itinerary, movement, local avoidance, Traffic v1은 이번 검증 범위에 포함하지 않았다.

## 구현 결과

```text
Navigation_v2 Point Objects = 28
Unique Node Names = 28
N01~N28 = 모두 존재
Navigation_Edges_v2 Polyline Objects = 33
E01~E33 = 33/33 반영
bidirectional = true (33/33)
```

E01~E33은 모두 두 endpoint를 잇는 직선 Polyline이다.
육안 검수 결과를 반영해 E17은 `N11 ↔ N14`로 교체했고 기존 `(2015, 930)` 제어점은 제거했다.

E25 `N08 ↔ N28`의 GID 2 구간은 `Facility Opening` 내부에 한정된 Door branch다.

## 검증 방법

- Edge 이름, endpoint property, 양방향 property, Polyline 시작·끝을 승인 E01~E33과 대조
- Undirected endpoint 중복, 고립 Node, connected component 검사
- 각 Polyline을 최대 1px 간격으로 표본화
- 모든 표본에서 Ground GID와 Door opening semantics 검사
- 모든 표본에서 Collision 130개에 대해 AABB footprint 충돌 검사
- Small 18×12, Medium 22×14, Large 26×16 각각 독립 검사
- N17과 N28의 branch degree, main-graph 연결, Door Opening 정렬 검사

## 결과

| Gate | 결과 | 근거 |
|---|---|---|
| Node identity / precheck | PASS | 28 objects, 28 unique names, N01~N28 |
| Edge implementation | PASS | E01~E33, 33/33 |
| Structural Graph | PASS | 28 nodes connected, 0 isolated, 0 duplicate edges |
| Geometry / walkable ground | PASS | 33/33, grass shortcut 0 |
| Collision | PASS | Collision/Fence/Building intersection 0 |
| Small 18×12 | PASS | 33/33 traversable |
| Medium 22×14 | PASS | 33/33 traversable |
| Large 26×16 | PASS | 33/33 traversable |
| Cafe branch | PASS | N18 ↔ N17, Cafe Opening aligned |
| Facility branch | PASS | N08 ↔ N28, Facility Opening aligned |

WARN과 FAIL은 없다.

## 보호 대상 확인

Edge Layer 추가 전후 다음 Layer의 canonical JSON SHA-256이 동일하다.

```text
Ground         b36e53ffff1fa09dcb34fa80ce44a0b00362af7ac41bf517678f1b6b0148f31d
Object_Base    1b0de2c5354ac440d1027d4b965cf3be68c7b5bd719601c7cf894935dd0e4ee7
Collision      9ff9ceec8d892bb11244b62d05e85fb53fac1f69296bfdd1af8b1540dec95b84
Navigation     816e5fe46c91d3b8c4a7240b5f28321a52c0f6cf11b84435dc7411f7dca6cbe3
Navigation_v2  69a1c41a5f205d530e3197056065dd1d64a6e7cebecf83e4b205853d84c2d0d3
Node positions c7dcad1c56b556a0ddd143cfe17bc0f96b27b4f2a79d5ab40156f9f41a36075a
```

Ground / Object / Collision / 기존 Navigation / Node 위치는 변경하지 않았다.
