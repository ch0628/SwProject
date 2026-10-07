import * as Phaser from 'phaser';
import {
  cornerJoin, FLOOR1_VISUAL_ASSETS, horizontalJoins, ROOM_SHELL, ROOM_SHELL_COLLIDERS,
  ROOM_SHELL_DOOR_OPENING, TILE_SIZE, verticalJoins, visualDepth, type WallPoint,
} from './floor1VisualPrototype';

const ASSET_ROOT = '/assets/environment/reinforcement/floor1_topdown_prototype';
const SPEED = 170;
const WORLD = { width: 512, height: 416 };
const CHARACTER_ROOT = '/assets/characters/fox/base/female';
const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
const WALL_DEBUG = new URLSearchParams(globalThis.location?.search ?? '').get('wallDebug');
type Direction = (typeof DIRECTIONS)[number];
type Keys = Record<'W' | 'A' | 'S' | 'D' | 'F' | 'G' | 'J' | 'R', Phaser.Input.Keyboard.Key>;
type Architecture = { x: number; baseline: number; width: number; height: number };

export class ReinforcementFloor1VisualPrototypeScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Keys;
  private footprintDebug!: Phaser.GameObjects.Graphics;
  private geometryDebug!: Phaser.GameObjects.Graphics;
  private joinDebug!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Text;
  private architecture: Architecture[] = [];
  private direction: Direction = 'down';

  constructor() { super('ReinforcementFloor1VisualPrototypeScene'); }

  preload() {
    for (const id of FLOOR1_VISUAL_ASSETS) this.load.image(id, `${ASSET_ROOT}/${id}.png`);
    for (const direction of DIRECTIONS) this.load.image(`floor1-visual-fox-${direction}`, `${CHARACTER_ROOT}/fox_female_${direction}.png`);
  }

  create() {
    this.cameras.main.setBackgroundColor('#151a1e').setZoom(1.8).centerOn(WORLD.width / 2, WORLD.height / 2);
    this.physics.world.setBounds(32, 24, WORLD.width - 64, WORLD.height - 48);
    this.createFloor();
    this.createArchitecture();
    this.createPlayer();
    this.createCollision();
    this.createDebugUi();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.removeAllKeys(true));
    this.game.events.emit('reinforcement-floor1-visual-prototype-ready');
  }

  update() {
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown) - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown) - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const velocity = new Phaser.Math.Vector2(dx, dy);
    if (velocity.lengthSq()) {
      velocity.normalize().scale(SPEED);
      this.direction = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      this.player.setTexture(`floor1-visual-fox-${this.direction}`);
    }
    this.player.setVelocity(velocity.x, velocity.y).setDepth(visualDepth(this.player.y));
    this.shadow.setPosition(this.player.x, this.player.y - 2).setDepth(visualDepth(this.player.y) - 0.1);
    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) this.footprintDebug.setVisible(!this.footprintDebug.visible);
    if (Phaser.Input.Keyboard.JustDown(this.keys.G)) this.geometryDebug.setVisible(!this.geometryDebug.visible);
    if (Phaser.Input.Keyboard.JustDown(this.keys.J)) this.joinDebug.setVisible(!this.joinDebug.visible);
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.player.setPosition(256, 240).setVelocity(0, 0);
    this.hud.setText([
      'FLOOR 1 · ORTHOGRAPHIC 3/4 VISUAL PROTOTYPE',
      `feetY/depth: ${this.player.y.toFixed(0)} · facing: ${this.direction.toUpperCase()}`,
      'Move: WASD / Arrows · Footprints: F · Geometry: G · Joins: J · Reset: R',
      'Door opening: north wall center · closed shell collision active',
      'Character depth = feet Y · Architecture depth = south baseline Y',
    ]);
  }

  private createFloor() {
    for (let y = 48; y < 368; y += 64) for (let x = 64; x < 448; x += 64) {
      const key = x >= 352 && y >= 240 ? 'F1_FLOOR_SERVICE' : 'F1_FLOOR_PUBLIC';
      this.add.image(x, y, key).setOrigin(0).setDepth(-1000);
    }
    this.add.text(368, 330, 'SERVICE', { fontFamily: 'monospace', fontSize: '9px', color: '#5f6a70' }).setDepth(-900);
  }

  private createArchitecture() {
    const rightWallX = ROOM_SHELL.right - TILE_SIZE;
    this.addArchitecture('F1_CORNER_INNER', ROOM_SHELL.left, ROOM_SHELL.northBaseline, TILE_SIZE, TILE_SIZE);
    for (let x = ROOM_SHELL.left + TILE_SIZE; x < ROOM_SHELL.doorX; x += TILE_SIZE) {
      this.addArchitecture('F1_WALL_H_BODY', x, ROOM_SHELL.northBaseline, TILE_SIZE, TILE_SIZE);
    }
    this.addArchitecture('F1_DOOR_H', ROOM_SHELL.doorX, ROOM_SHELL.northBaseline, ROOM_SHELL.doorWidth, TILE_SIZE);
    for (let x = ROOM_SHELL.doorX + ROOM_SHELL.doorWidth; x < rightWallX; x += TILE_SIZE) {
      this.addArchitecture('F1_WALL_H_BODY', x, ROOM_SHELL.northBaseline, TILE_SIZE, TILE_SIZE);
    }
    this.addArchitecture('F1_CORNER_OUTER', rightWallX, ROOM_SHELL.northBaseline, TILE_SIZE, TILE_SIZE);

    for (let baseline = ROOM_SHELL.northBaseline + TILE_SIZE; baseline < ROOM_SHELL.southBaseline; baseline += TILE_SIZE) {
      this.addArchitecture('F1_WALL_V_BODY', ROOM_SHELL.left, baseline, TILE_SIZE, TILE_SIZE);
      this.addArchitecture('F1_WALL_V_BODY', rightWallX, baseline, TILE_SIZE, TILE_SIZE);
    }
    this.addArchitecture('F1_WALL_V_BOTTOM', ROOM_SHELL.left, ROOM_SHELL.southBaseline, TILE_SIZE, TILE_SIZE);
    this.addArchitecture('F1_CORNER_OUTER', rightWallX, ROOM_SHELL.southBaseline, TILE_SIZE, TILE_SIZE);
    for (let x = ROOM_SHELL.left + TILE_SIZE; x < rightWallX; x += TILE_SIZE) {
      this.addArchitecture('F1_WALL_H_BODY', x, ROOM_SHELL.southBaseline, TILE_SIZE, TILE_SIZE);
    }
  }

  private addArchitecture(key: string, x: number, baseline: number, width: number, height: number) {
    this.add.image(x, baseline, key).setOrigin(0, 1).setDepth(visualDepth(baseline));
    this.architecture.push({ x, baseline, width, height });
  }

  private createPlayer() {
    this.shadow = this.add.ellipse(256, 238, 28, 10, 0x263238, 0.28);
    this.player = this.physics.add.sprite(256, 240, 'floor1-visual-fox-down')
      .setOrigin(0.5, 1)
      .setDisplaySize(48, 64)
      .setCollideWorldBounds(true)
      .setDepth(visualDepth(240));
    this.player.body!.setSize(180, 100).setOffset(166, 572);
  }

  private createCollision() {
    const texture = this.make.graphics({ x: 0, y: 0 }, false);
    texture.fillStyle(0xffffff).fillRect(0, 0, 1, 1).generateTexture('floor1-visual-collider', 1, 1).destroy();
    const group = this.physics.add.staticGroup();
    for (const rectangle of ROOM_SHELL_COLLIDERS) {
      const collider = group.create(rectangle.x + rectangle.width / 2, rectangle.y + rectangle.height / 2, 'floor1-visual-collider') as Phaser.Physics.Arcade.Image;
      collider.setDisplaySize(rectangle.width, rectangle.height).setVisible(false).refreshBody();
    }
    this.physics.add.collider(this.player, group);
  }

  private createDebugUi() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,F,G,J,R') as Keys;
    this.input.keyboard!.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'W', 'A', 'S', 'D', 'F', 'G', 'J', 'R']);
    this.footprintDebug = this.add.graphics().setDepth(10000).setVisible(WALL_DEBUG === 'footprints' || WALL_DEBUG === 'all');
    this.footprintDebug.lineStyle(1, 0x67e8f9, 0.75);
    for (const object of this.architecture) {
      this.footprintDebug.strokeRect(object.x, object.baseline - object.height, object.width, object.height);
      this.footprintDebug.lineBetween(object.x, object.baseline, object.x + object.width, object.baseline);
    }
    this.footprintDebug.lineStyle(2, 0xffb74d, 0.95);
    for (const rectangle of ROOM_SHELL_COLLIDERS) this.footprintDebug.strokeRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
    this.geometryDebug = this.add.graphics().setDepth(10001).setVisible(WALL_DEBUG === 'geometry' || WALL_DEBUG === 'all');
    this.geometryDebug.fillStyle(0xd8cec1, 0.92).lineStyle(2, 0x7c2d12, 1);
    for (const rectangle of ROOM_SHELL_COLLIDERS) {
      this.geometryDebug.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height)
        .strokeRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
    }
    this.geometryDebug.fillStyle(0x2563eb, 0.95).fillRect(
      ROOM_SHELL_DOOR_OPENING.x, ROOM_SHELL_DOOR_OPENING.y,
      ROOM_SHELL_DOOR_OPENING.width, ROOM_SHELL_DOOR_OPENING.height,
    );
    this.geometryDebug.fillStyle(0xef4444, 0.95)
      .fillRect(ROOM_SHELL.left, ROOM_SHELL.northBaseline - TILE_SIZE, TILE_SIZE, TILE_SIZE)
      .fillRect(ROOM_SHELL.right - TILE_SIZE, ROOM_SHELL.northBaseline - TILE_SIZE, TILE_SIZE, TILE_SIZE);
    this.joinDebug = this.createJoinDebug().setVisible(WALL_DEBUG === 'joins' || WALL_DEBUG === 'all');
    this.hud = this.add.text(12, 10, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#f7f3eb', backgroundColor: '#151a1ed9',
      padding: { x: 7, y: 6 }, lineSpacing: 3,
    }).setScrollFactor(0).setDepth(11000);
  }

  private createJoinDebug() {
    const graphics = this.add.graphics().setDepth(10002).lineStyle(2, 0xfacc15, 1);
    const points: { name: string; point: WallPoint }[] = [
      { name: 'C=H_L=V_T', point: cornerJoin(ROOM_SHELL.left, ROOM_SHELL.northBaseline) },
      { name: 'H_R=DOOR_L', point: horizontalJoins(ROOM_SHELL.doorX, ROOM_SHELL.northBaseline, ROOM_SHELL.doorWidth).left },
      { name: 'DOOR_R=H_L', point: horizontalJoins(ROOM_SHELL.doorX, ROOM_SHELL.northBaseline, ROOM_SHELL.doorWidth).right },
      { name: 'V_BODY_JOIN', point: verticalJoins(ROOM_SHELL.left, ROOM_SHELL.northBaseline + TILE_SIZE).bottom },
    ];
    const labels = points.map(({ name, point }, index) => {
      graphics.lineBetween(point.x - 4, point.y, point.x + 4, point.y).lineBetween(point.x, point.y - 4, point.x, point.y + 4);
      return this.add.text(point.x + 5, point.y + 4 + index * 9, `${name} (${point.x},${point.y})`, {
        fontFamily: 'monospace', fontSize: '8px', color: '#facc15', backgroundColor: '#151a1ecc',
      }).setDepth(10002);
    });
    return this.add.container(0, 0, [graphics, ...labels]).setDepth(10002);
  }
}
