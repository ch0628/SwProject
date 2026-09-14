import * as Phaser from 'phaser';
import { CORRIDOR, CORRIDOR_CASES, CORRIDOR_SIZES, corridorMetrics, createCorridorRun, stepCorridor, type CorridorCase } from './corridorCapacity';
import { footprint, navigationBounds } from './collision';
import { TILE_SIZE } from './config';

export class CorridorCapacityScene extends Phaser.Scene {
  private run = createCorridorRun('A');
  private graphics!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private reportAt = 0;
  private paused = false;
  constructor(private report: (text: string) => void) { super('CorridorCapacityScene'); }
  create() { this.graphics = this.add.graphics(); this.select('A'); }
  select(test: CorridorCase) {
    this.run = createCorridorRun(test); this.paused = false;
    this.labels.forEach((label) => label.destroy());
    this.labels = this.run.npcs.map((npc) => this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '11px', color: '#172129' }).setOrigin(0.5));
    this.publish();
  }
  togglePause() { this.paused = !this.paused; this.publish(); }
  private publish() {
    const m = corridorMetrics(this.run), c = CORRIDOR_CASES[this.run.test];
    if (this.paused) { m.moving = 0; m.waiting = this.run.npcs.length; }
    this.report(`TEST ${this.run.test} · ${c.label} · ${c.tiles * TILE_SIZE}px / ${c.tiles} tiles · NPC ${this.run.npcs.length}\nMoving ${m.moving} · Waiting ${m.waiting} (turnaround ${m.turning}) · Trips ${m.trips}\nLongest wait ${this.run.longestWait.toFixed(1)}s · Blocked events ${this.run.blockedEvents}\nElapsed ${this.run.elapsed.toFixed(1)}s · No forward progress ${this.run.noProgress.toFixed(1)}s · ${this.paused ? 'PAUSED' : 'RUNNING'} · FPS ${this.game.loop.actualFps.toFixed(0)}`);
  }
  update(time: number, delta: number) {
    if (!this.graphics) return;
    if (!this.paused) stepCorridor(this.run, delta / 1000);
    const g = this.graphics.clear(), width = CORRIDOR_CASES[this.run.test].tiles * TILE_SIZE;
    const left = CORRIDOR.centerX - width / 2;
    g.fillStyle(0x263238).fillRect(0, 0, 960, 540);
    g.fillStyle(0x59646b).fillRect(left - 16, 64, width + 32, 456);
    g.fillStyle(0x91988e).fillRect(left, 64, width, 456);
    g.lineStyle(1, 0xffffff, 0.2);
    for (let x = left; x <= left + width; x += TILE_SIZE) g.lineBetween(x, 64, x, 520);
    for (let y = 64; y <= 520; y += TILE_SIZE) g.lineBetween(left, y, left + width, y);
    g.lineStyle(2, 0x8ce6d5).lineBetween(left, CORRIDOR.top, left + width, CORRIDOR.top).lineBetween(left, CORRIDOR.bottom, left + width, CORRIDOR.bottom);
    for (const npc of [...this.run.npcs].sort((a, b) => a.y - b.y)) {
      const size = CORRIDOR_SIZES[npc.size];
      const color = npc.size === 'Large' ? 0xdbb180 : npc.size === 'Medium' ? 0x91c8bf : 0xbfa5d8;
      g.fillStyle(color).fillRect(npc.x - size.visualWidth / 2, npc.y - size.visual + 12, size.visualWidth, size.visual - 12).fillCircle(npc.x, npc.y - size.visual + 12, 12);
      const f = footprint(npc.x, npc.y, size), nav = navigationBounds(npc.x, npc.y, size.clearance);
      g.lineStyle(1, npc.blocked ? 0xff6b6b : 0xffff75).strokeRect(f.x, f.y, f.width, f.height);
      g.lineStyle(1, 0xd69bff, 0.7).strokeRect(nav.x, nav.y, nav.width, nav.height);
      this.labels[npc.id - 1].setPosition(npc.x, npc.y - size.visual / 2).setText(`${npc.id}${npc.direction === 1 ? 'v' : '^'}`).setDepth(npc.y);
    }
    if (time - this.reportAt > 200) { this.reportAt = time; this.publish(); }
  }
}
