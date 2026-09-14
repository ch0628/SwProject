import * as Phaser from 'phaser';
import { ARCHITECTURE_CLEARANCE, ASSET_ALPHA_THRESHOLD, BENCH_SIZE, DENSITY_AREA, LOGICAL, PANEL_WIDTH, PUBLIC_ENTRANCE_WIDTH, SPEED, STATIONS, TIGER_FOOTPRINT, TIGER_HEIGHT, TILE_SIZE, WALKWAY_WIDTH, WORLD_SIZE } from './config';
import { canNavigate, footprint, navigationBounds, type Bounds } from './collision';
import { advancePatrol } from './npcMotion';
import down from '../assets/characters/tiger/base/male/tiger_male_down.png';
import left from '../assets/characters/tiger/base/male/tiger_male_left.png';
import right from '../assets/characters/tiger/base/male/tiger_male_right.png';
import up from '../assets/characters/tiger/base/male/tiger_male_up.png';

type Direction = 'down' | 'left' | 'right' | 'up';
export type Controls = { zoom: number; height: number; density: number; gameplay: boolean; debug: boolean; moving: boolean };
export type Stats = { fps: number; x: number; y: number; direction: Direction; selected: number | null; height: number };
type Npc = { sprite: Phaser.GameObjects.Container; baseX: number; baseY: number; height: number; id: number; elapsed: number };

export class ScaleValidationScene extends Phaser.Scene {
  tiger!: Phaser.GameObjects.Image;
  obstacles: (Bounds & { architecture: boolean })[] = [];
  npcs: Npc[] = [];
  direction: Direction = 'down';
  controls: Controls = { zoom: 1, height: TIGER_HEIGHT, density: 12, gameplay: false, debug: true, moving: true };
  selected: number | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private grid!: Phaser.GameObjects.Graphics;
  private debugDraw!: Phaser.GameObjects.Graphics;
  private lastReport = 0;
  onStats: (stats: Stats) => void;

  constructor(onStats: (stats: Stats) => void) {
    super('ScaleValidationScene');
    this.onStats = onStats;
  }

  preload() {
    for (const [direction, url] of Object.entries({ down, left, right, up })) this.load.image(`source-${direction}`, url);
  }

  create() {
    // Trim transparent padding in memory; preserve the original PNG files and uniform scale.
    for (const direction of ['down', 'left', 'right', 'up']) {
      const source = this.textures.get(`source-${direction}`).getSourceImage() as HTMLImageElement;
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(source, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] > ASSET_ALPHA_THRESHOLD) {
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
      }
      if (maxX < minX) throw new Error(`Empty Tiger asset: ${direction}`);
      // Center the frame on the feet, not the side-facing tail or shoulders.
      let footLeft = maxX, footRight = minX;
      for (let y = maxY - Math.floor((maxY - minY) * 0.08); y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) if (pixels[(y * canvas.width + x) * 4 + 3] > ASSET_ALPHA_THRESHOLD) {
          footLeft = Math.min(footLeft, x); footRight = Math.max(footRight, x);
        }
      }
      const footX = (footLeft + footRight) / 2;
      const halfWidth = Math.ceil(Math.max(footX - minX, maxX - footX) + 1);
      const trimmed = document.createElement('canvas');
      trimmed.width = halfWidth * 2;
      trimmed.height = maxY - minY + 1;
      trimmed.getContext('2d')!.drawImage(source, minX, minY, maxX - minX + 1, trimmed.height, halfWidth - (footX - minX), 0, maxX - minX + 1, trimmed.height);
      if (this.textures.exists(`tiger-${direction}`)) this.textures.remove(`tiger-${direction}`);
      this.textures.addCanvas(`tiger-${direction}`, trimmed);
    }
    this.drawMap();
    this.tiger = this.add.image(STATIONS.plaza.x, STATIONS.plaza.y, 'tiger-down').setOrigin(0.5, 1);
    this.setDirection('down');
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as typeof this.keys;
    this.cameras.main.setBounds(0, 0, WORLD_SIZE.width, WORLD_SIZE.height).startFollow(this.tiger, true, 1, 1);
    this.debugDraw = this.add.graphics().setDepth(10000);
    this.spawnNpcs();
    this.applyControls(this.controls);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllKeys(true);
      this.npcs = [];
      this.obstacles = [];
    });
    this.game.events.emit('validation-ready');
  }

  private rect(x: number, y: number, w: number, h: number, color: number, depth = -10) {
    return this.add.rectangle(x, y, w, h, color).setOrigin(0).setDepth(depth);
  }

  private label(x: number, y: number, text: string) {
    this.add.text(x, y, text, { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', backgroundColor: '#263238', padding: { x: 4, y: 3 } }).setDepth(-1);
  }

  private solid(x: number, y: number, width: number, height: number, color = 0x69747b, architecture = true) {
    this.obstacles.push({ x, y, width, height, architecture });
    return this.rect(x, y, width, height, color, y + height / 2);
  }

  private drawMap() {
    const t = TILE_SIZE;
    this.rect(0, 0, WORLD_SIZE.width, WORLD_SIZE.height, 0x526458, -100);
    this.rect(64, 416, 1376, WALKWAY_WIDTH.main * t, 0x737d85, -90);
    this.rect(480, 256, 320, 352, 0x8c9391, -90);
    this.label(512, 280, 'OPEN PLAZA');
    this.label(512, 544, 'MAIN ROAD / 5 tiles');

    // Parallel corridors with actual solid edges and open ends.
    for (const [x, width, name] of [[832, WALKWAY_WIDTH.normal, 'NORMAL / 3 tiles'], [1088, WALKWAY_WIDTH.narrow, 'NARROW / 2 tiles']] as const) {
      this.rect(x, 128, width * t, 288, 0x929188, -90);
      this.solid(x - t, 128, t, 288);
      this.solid(x + width * t, 128, t, 288);
      this.label(x - t, 96, name);
    }

    // 12 x 8 tile building. Public 64px opening and a separate small test opening.
    const bx = 96, by = 128, bw = 12 * t, bh = 8 * t, front = by + bh - t;
    this.rect(bx, by, bw, bh, 0x9b9081, -80);
    this.solid(bx, by, bw, t);
    this.solid(bx, by, t, bh);
    this.solid(bx + bw - t, by, t, bh);
    this.solid(bx, front, 5 * t, t);
    this.solid(256 + PUBLIC_ENTRANCE_WIDTH * t, front, 64, t);
    this.solid(416, front, 64, t);
    this.rect(256, front, PUBLIC_ENTRANCE_WIDTH * t, t, 0x68b3ad, -70);
    this.rect(384, front, t, t, 0xc4ae6d, -70);
    // Header is foreground only. Door access can later be checked separately from geometry.
    this.rect(248, front - 80, 80, 24, 0x464d55, front + 16);
    this.rect(376, front - 80, 48, 24, 0x464d55, front + 16);
    this.label(144, 184, 'BUILDING / 12 x 8 tiles');
    this.label(232, 392, '64px entry');
    this.label(374, 416, '32px door');

    // Tree canopy and trunk share a foot-Y depth, with a much smaller collision base.
    this.solid(624, 688, t, t, 0x6b5547, false);
    this.rect(632, 624, 16, 80, 0x75624e, 704);
    this.add.ellipse(640, 626, 96, 100, 0x3b765f).setDepth(704);
    this.label(568, 756, 'TREE 96x128 / base 32x32');
    this.solid(352, 704, BENCH_SIZE.width, BENCH_SIZE.height, 0x92714e, false);
    this.rect(352, 680, BENCH_SIZE.width, 24, 0xb28e61, 720);
    this.label(328, 756, 'BENCH 96x32 / 3x1');
    this.solid(192, 688, t, t, 0x555f6a, false);
    this.rect(204, 592, 8, 112, 0xb4bbc1, 704);
    this.rect(184, 584, 48, 16, 0xd1c586, 704);
    this.label(152, 756, 'LAMP base 32x32');
    this.solid(128, 864, 544, 16);
    this.label(272, 888, 'FENCE / WALL');

    this.rect(DENSITY_AREA.x, DENSITY_AREA.y, DENSITY_AREA.width, DENSITY_AREA.height, 0x627985, -85);
    this.label(944, 578, 'NPC DENSITY / click to select');
    this.grid = this.add.graphics().setDepth(-50).lineStyle(1, 0xffffff, 0.12);
    for (let x = 0; x <= WORLD_SIZE.width; x += t) this.grid.lineBetween(x, 0, x, WORLD_SIZE.height);
    for (let y = 0; y <= WORLD_SIZE.height; y += t) this.grid.lineBetween(0, y, WORLD_SIZE.width, y);
  }

  applyControls(controls: Controls) {
    const densityChanged = this.controls.density !== controls.density;
    this.controls = { ...controls };
    if (!this.tiger) return;
    this.setDirection(this.direction);
    this.cameras.main.setViewport(0, 0, LOGICAL.width - (controls.gameplay ? PANEL_WIDTH : 0), LOGICAL.height).setZoom(controls.zoom);
    this.grid.setVisible(controls.debug);
    if (densityChanged) this.spawnNpcs();
  }

  goTo(station: keyof typeof STATIONS) {
    const point = STATIONS[station];
    this.tiger.setPosition(point.x, point.y);
  }

  private setDirection(direction: Direction) {
    this.direction = direction;
    this.tiger.setTexture(`tiger-${direction}`);
    this.tiger.setScale(this.controls.height / this.tiger.height);
  }

  private spawnNpcs() {
    for (const npc of this.npcs) npc.sprite.destroy();
    this.npcs = [];
    this.selected = null;
    for (let i = 0; i < this.controls.density; i++) {
      const x = DENSITY_AREA.x + 60 + (i % 7) * 84;
      const y = DENSITY_AREA.y + 108 + Math.floor(i / 7) * 60;
      const height = [56, 64, 72, 80, 96][i % 5];
      const color = [0xd5b788, 0x95c5be, 0xc9a6b6][i % 3];
      const body = this.add.rectangle(0, 0, 30, height - 14, color).setOrigin(0.5, 1);
      const head = this.add.circle(0, -height + 14, 14, color);
      const number = this.add.text(0, -height / 2, String(i + 1), { fontSize: '11px', color: '#172129' }).setOrigin(0.5);
      const sprite = this.add.container(x, y, [body, head, number]).setSize(32, height);
      // Container hit testing adds displayOrigin (half its size) to local coordinates.
      sprite.setInteractive(new Phaser.Geom.Rectangle(0, -height / 2, 32, height), Phaser.Geom.Rectangle.Contains);
      sprite.on('pointerdown', () => { this.selected = i + 1; });
      this.npcs.push({ sprite, baseX: x, baseY: y, height, id: i + 1, elapsed: 0 });
    }
  }

  update(time: number, delta: number) {
    if (!this.tiger) return;
    const k = this.keys;
    const dx = Number(k.D.isDown || k.RIGHT.isDown) - Number(k.A.isDown || k.LEFT.isDown);
    const dy = Number(k.S.isDown || k.DOWN.isDown) - Number(k.W.isDown || k.UP.isDown);
    if (dx || dy) {
      this.setDirection(dx ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      const distance = SPEED * Math.min(delta, 50) / 1000 / Math.hypot(dx, dy);
      // Small substeps prevent tunnelling through the 16px fence during frame drops.
      const steps = Math.ceil(distance / 4);
      const blockers = [...this.obstacles, ...this.npcs.map((n) => footprint(n.sprite.x, n.sprite.y, TIGER_FOOTPRINT))];
      const architecture = this.obstacles.filter((o) => o.architecture);
      const canMove = (x: number, y: number) => canNavigate(x,y,TIGER_FOOTPRINT,blockers,WORLD_SIZE,architecture,ARCHITECTURE_CLEARANCE.large);
      for (let i = 0; i < steps; i++) {
        const x = this.tiger.x + dx * distance / steps;
        if (canMove(x, this.tiger.y)) this.tiger.x = x;
        const y = this.tiger.y + dy * distance / steps;
        if (canMove(this.tiger.x, y)) this.tiger.y = y;
      }
    }
    this.tiger.setDepth(this.tiger.y);
    for (const npc of this.npcs) {
      if (this.controls.moving) {
        // ponytail: at most 35 placeholders; a simple pairwise check needs no spatial index.
        const blockers = [...this.obstacles, footprint(this.tiger.x, this.tiger.y, TIGER_FOOTPRINT),
          ...this.npcs.filter((other) => other !== npc).map((other) => footprint(other.sprite.x, other.sprite.y, TIGER_FOOTPRINT))];
        const next = advancePatrol({ ...npc, x: npc.sprite.x, y: npc.sprite.y }, delta, TIGER_FOOTPRINT, blockers, WORLD_SIZE);
        npc.sprite.setPosition(next.x, next.y);
        npc.elapsed = next.elapsed;
      }
      npc.sprite.setDepth(npc.sprite.y);
    }
    this.drawDebug();
    if (time - this.lastReport > 200) {
      this.lastReport = time;
      this.onStats({ fps: this.game.loop.actualFps, x: this.tiger.x, y: this.tiger.y, direction: this.direction, selected: this.selected, height: this.tiger.displayHeight });
    }
  }

  private drawDebug() {
    const g = this.debugDraw.clear();
    if (this.controls.debug) {
      g.lineStyle(1, 0xff8c82, 1);
      for (const o of this.obstacles) g.strokeRect(o.x, o.y, o.width, o.height);
      g.lineStyle(1, 0x8bd4f4, 1);
      for (const n of this.npcs) {
        g.strokeRect(n.sprite.x - 16, n.sprite.y - n.height, 32, n.height);
        const f = footprint(n.sprite.x, n.sprite.y, TIGER_FOOTPRINT);
        g.strokeRect(f.x, f.y, f.width, f.height);
      }
      const f = footprint(this.tiger.x, this.tiger.y, TIGER_FOOTPRINT);
      g.lineStyle(1, 0xffff00, 1).strokeRect(f.x, f.y, f.width, f.height);
      const clearance = navigationBounds(this.tiger.x, this.tiger.y, ARCHITECTURE_CLEARANCE.large);
      g.lineStyle(1, 0xd69bff, 1).strokeRect(clearance.x, clearance.y, clearance.width, clearance.height);
      g.lineStyle(1, 0xffffff, 1).lineBetween(this.tiger.x - 5, this.tiger.y, this.tiger.x + 5, this.tiger.y);
      g.lineBetween(this.tiger.x, this.tiger.y - 5, this.tiger.x, this.tiger.y + 5);
    }
    const selected = this.npcs.find((n) => n.id === this.selected);
    if (selected) g.lineStyle(2, 0xffff00, 1).strokeRect(selected.sprite.x - 18, selected.sprite.y - selected.height - 2, 36, selected.height + 4);
  }
}
