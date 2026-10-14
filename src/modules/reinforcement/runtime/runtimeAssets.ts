import type { RuntimeDirection } from './runtimeCommands.ts';

const characterUrls = import.meta.glob('../../../../assets/characters/{robot,lion,dog,tiger}/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const asset = (suffix: string) => {
  const match = Object.entries(characterUrls).find(([path]) => path.replaceAll('\\', '/').endsWith(suffix));
  if (!match) throw new Error(`Runtime asset is missing: ${suffix}`);
  return match[1];
};

const frames = (directory: string) => Object.entries(characterUrls)
  .filter(([path]) => path.replaceAll('\\', '/').includes(directory) && /_[1-6]\.png$/.test(path))
  .sort(([left], [right]) => Number(left.match(/_(\d)\.png$/)?.[1]) - Number(right.match(/_(\d)\.png$/)?.[1]))
  .map(([, url]) => url);

const directions = <T>(up: T, down: T, left: T, right: T): Record<RuntimeDirection, T> => ({ UP: up, DOWN: down, LEFT: left, RIGHT: right });

const robot = {
  idle: directions(
    asset('/robot/base/robot_up.png'), asset('/robot/base/robot_down.png'),
    asset('/robot/base/robot_left.png'), asset('/robot/base/robot_right.png'),
  ),
  walk: directions(
    frames('/robot/animations/processed/walk_up/'), frames('/robot/animations/processed/walk_down/'),
    frames('/robot/animations/processed/walk_left/'), frames('/robot/animations/processed/walk_right/'),
  ),
};

const villain = (variant: 1 | 2 | 3 | 4, upFile: string) => {
  const version = `v0${variant}`;
  const base = `/lion/variants/${version}`;
  return {
    idle: directions(
      asset(`${base}/base/${upFile}`), asset(`${base}/base/lion_${version}_down.png`),
      asset(`${base}/base/lion_${version}_left.png`), asset(`${base}/base/lion_${version}_right.png`),
    ),
    walk: directions(
      frames(`${base}/animations/walk/processed/up/`), frames(`${base}/animations/walk/processed/down/`),
      frames(`${base}/animations/walk/processed/left/`), frames(`${base}/animations/walk/processed/right/`),
    ),
    neutralized: asset(`${base}/base/lion_${version}_neutralized.png`),
  };
};

export const RUNTIME_ASSETS = {
  ROBOT: robot,
  CITIZEN: directions(
    asset('/dog/base/male/idle/dog_male_up.png'), asset('/dog/base/male/idle/dog_male_down.png'),
    asset('/dog/base/male/idle/dog_male_left.png'), asset('/dog/base/male/idle/dog_male_right.png'),
  ),
  AMBIGUOUS_PERSON: directions(
    asset('/tiger/base/male/tiger_male_up.png'), asset('/tiger/base/male/tiger_male_down.png'),
    asset('/tiger/base/male/tiger_male_left.png'), asset('/tiger/base/male/tiger_male_right.png'),
  ),
  VILLAIN: [
    villain(1, 'lion_v01_top.png'),
    villain(2, 'lion_v2_top.png'),
    villain(3, 'lion_v3_up.png'),
    villain(4, 'lion_v04_top.png'),
  ],
  BOSS: {
    idle: directions(
      asset('/lion/base/lion_up.png'), asset('/lion/base/lion_down.png'),
      asset('/lion/base/lion_left.png'), asset('/lion/base/lion_right.png'),
    ),
    walk: directions(
      frames('/lion/animations/processed/walk_up/'), frames('/lion/animations/processed/walk_down/'),
      frames('/lion/animations/processed/walk_left/'), frames('/lion/animations/processed/walk_right/'),
    ),
    neutralized: asset('/lion/base/lion_neutralized.png'),
  },
  OBSTACLE: {
    CART: '/assets/environment/reinforcement/obstacle/cart.png',
    BOX: '/assets/environment/reinforcement/obstacle/box2.png',
    CART_BOX: '/assets/environment/reinforcement/obstacle/cart_box.png',
  },
  F5_SEARCH_DOOR: {
    CLOSED: '/assets/environment/reinforcement/floor5_room_shell_manual/F5_DOOR_CLOSE.png',
    OPEN: '/assets/environment/reinforcement/floor5_room_shell_manual/F5_DOOR_OPEN.png',
  },
  F5_SECURITY_LOCK: {
    CLOSED: '/assets/environment/reinforcement/floor5_room_shell_manual/F5_SECURE_RIGHT.png',
    OPEN: '/assets/environment/reinforcement/floor5_room_shell_manual/F5_SECURE_RIGHT_2.png',
  },
} as const;

export const RUNTIME_VISUAL_CONFIG = {
  animationFps: 9,
  movementPixelsPerSecond: 420,
  pushDurationMs: 380,
  clearDurationMs: 320,
  forcePassDurationMs: 280,
  robotDisplayHeight: 72,
  robotFootprint: { width: 20, height: 12 },
  citizenDisplayHeight: 74,
  ambiguousDisplayHeight: 80,
  villainDisplayHeight: 82,
  bossDisplayHeight: 96,
} as const;

for (const direction of Object.keys(robot.walk) as RuntimeDirection[]) {
  if (robot.walk[direction].length !== 6) throw new Error(`Robot ${direction} walk must contain 6 frames`);
}
for (const [index, entry] of RUNTIME_ASSETS.VILLAIN.entries()) {
  for (const direction of Object.keys(entry.walk) as RuntimeDirection[]) {
    if (entry.walk[direction].length !== 6) throw new Error(`Villain v0${index + 1} ${direction} walk must contain 6 frames`);
  }
}

