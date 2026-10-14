# Production Runtime Phase 1

## Result

- Runtime Adapter: implemented (`MOVE / ENCOUNTER / ACTION / OUTCOME / FLOOR_TRANSITION / STATE_CHANGE / TERMINAL`)
- Single Robot Phaser Runtime: implemented
- Actual TMJ Navigation Edge polyline playback: implemented
- F1→F5 / F5 Search / Boss / Security Lock / Control Room flow: implemented
- 5-Robot Runtime Controller foundation: implemented; temporary Main/Sub shell deferred
- Debug URL: `http://127.0.0.1:5173/?mode=reinforcement-runtime-debug&seed=2`

## Assets connected

- Robot idle/walk UP/DOWN/LEFT/RIGHT; walk uses the existing six processed frames
- Citizen: existing Dog male idle
- Ambiguous Person: existing Tiger male idle
- Villain: Lion v01~v04 idle/neutralized; deterministic variant selection
- Boss: base White Lion idle/neutralized
- Obstacle: cart / box / cart+box
- F5 Search Door: closed/open
- F5 Security Lock: `F5_SECURE_RIGHT` closed/open pair

All gameplay asset paths are centralized in `runtime/runtimeAssets.ts`. No PNG was resized, cropped, renamed, moved, deleted, or regenerated.

## Verification

- Runtime tests: PASS
- Full suite: PASS (`196/196`)
- TypeScript typecheck: PASS
- `git diff --check`: PASS
- Production build: BLOCKED_BY_ENVIRONMENT — Vite stopped on Windows sandbox `realpath` with `EPERM`; typecheck completed before the Vite failure
- Browser direct playtest: `USER_MANUAL_PENDING` — Computer Use approval timed out, and direct localhost access was blocked by the environment

The known Floor 4 stale fixture was updated to expect the existing approved 16 tiles; the TMJ and visual assets were not changed.

## Final Status

`PASS_RUNTIME_IMPLEMENTATION_USER_PLAYTEST_PENDING`

