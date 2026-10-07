# Floor 1 Visual Shell V1 contract

This is a small Tiled/Phaser authoring test, not a replacement for `floor_1_blockout.tmj`.

## Coordinate contract

- Gameplay stays orthogonal at 32 px per tile. Collision, navigation, encounters, transitions, and spawn points use ordinary world coordinates.
- Visual tiles use a 32×64 atlas cell and are bottom-aligned by Tiled. The extra height is presentation only.
- North/back walls use a 64 px face. Their occlusion baseline is the wall's south edge; characters inside the room render in front, while corridor characters render behind it.
- Left/right shells are 10 px painted bands inside the visual cell. They do not become 32 px-wide decorative wall slabs.
- The south boundary is a 10 px low cutaway trim. It keeps the room readable without hiding its interior.
- Corners are simply the overlap/bend of the back face and thin side shell. There is no large corner connector asset.
- The north doorway is a real 52 px collision gap, framed by two jamb/header tiles. It is not a wall texture painted over a collider.
- Floor tiles have no 32 px seam. The service-area overlay supplies the only large color grouping in this debug pass.

## Prototype scope

`floor_1_visual_shell_v1.tmj` contains one rectangular room, an L corridor, inner/outer shell turns, one door, and minimal object layers matching the Floor 1 gameplay layer names. The flat-color atlas is intentionally disposable. Apply this authoring model to the full Floor 1 only after visual approval.
