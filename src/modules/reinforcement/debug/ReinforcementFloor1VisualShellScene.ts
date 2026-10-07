import * as Phaser from 'phaser';
import { embedTileset, objectLayer, properties, TILE_LAYERS, type TiledMapJson, type TiledObject } from './floor1Tiled';

const MAP_JSON = 'reinforcement-floor1-shell-json';
const TILESET_JSON = 'reinforcement-floor1-shell-tileset-json';
const MAP = 'reinforcement-floor1-shell';
const TILES = 'reinforcement-floor1-shell-tiles';
const MAP_URL = '/maps/reinforcement/floor_1_visual_shell_v1.tmj';
const TILESET_URL = '/maps/reinforcement/floor1_visual_shell_v1.tsj';
const TILES_URL = '/assets/environment/reinforcement/floor1_visual_shell_v1/floor1_visual_shell_v1.png';
const CHARACTER_ROOT = '/assets/characters/fox/base/female';
const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
const SPEED = 170;
type Direction = (typeof DIRECTIONS)[number];
type Keys = Record<'W' | 'A' | 'S' | 'D' | 'C' | 'R', Phaser.Input.Keyboard.Key>;

export class ReinforcementFloor1VisualShellScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Keys;
  private collisionOverlay!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private spawn!: TiledObject;
  private direction: Direction = 'down';

  constructor() { super('ReinforcementFloor1VisualShellScene'); }

  preload() {
    this.load.json(MAP_JSON, MAP_URL);
    this.load.json(TILESET_JSON, TILESET_URL);
    this.load.image(TILES, TILES_URL);
    for (const direction of DIRECTIONS) this.load.image(`floor1-shell-fox-${direction}`, `${CHARACTER_ROOT}/fox_female_${direction}.png`);
  }

  create() {
    void this.initialize().catch(error => {
      console.error(error);
      this.game.events.emit('reinforcement-floor1-visual-shell-error', error instanceof Error ? error.message : String(error));
    });
  }

  private async initialize() {
    const source = this.cache.json.get(MAP_JSON) as TiledMapJson | undefined;
    const tilesetJson = this.cache.json.get(TILESET_JSON) as Record<string, unknown> | undefined;
    if (!source || !tilesetJson) throw new Error('Floor 1 visual shell: map or tileset failed to load');
    const collision = objectLayer(source, 'Collision');
    const spawns = objectLayer(source, 'SpawnPoints');
    if (source.width !== 16 || source.height !== 12 || source.tilewidth !== 32 || source.tileheight !== 32) throw new Error('Floor 1 visual shell: expected 16x12 @ 32px');
    if (spawns.length !== 1) throw new Error(`Floor 1 visual shell: expected one spawn, found ${spawns.length}`);
    this.spawn = spawns[0];

    this.cache.tilemap.add(MAP, { format: Phaser.Tilemaps.Formats.TILED_JSON, data: embedTileset(source, tilesetJson) });
    const map = this.make.tilemap({ key: MAP });
    const tileset = map.addTilesetImage('floor1_visual_shell_v1', TILES);
    if (!tileset) throw new Error('Floor 1 visual shell: Phaser could not bind tileset');
    const depths: Record<(typeof TILE_LAYERS)[number], number> = { Ground: -1000, FloorDetail: -900, Walls: 352, WallTop: 160, StaticProps: 400 };
    for (const name of TILE_LAYERS) {
      const layer = map.createLayer(name, tileset);
      if (!layer) throw new Error(`Floor 1 visual shell: missing tile layer ${name}`);
      layer.setDepth(depths[name]);
    }

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBackgroundColor('#151a1e').setBounds(0, 0, map.widthInPixels, map.heightInPixels).setZoom(1.65).centerOn(256, 192);
    this.createPlayer();
    this.createCollision(collision);
    this.createUi();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.removeAllKeys(true));
    this.game.events.emit('reinforcement-floor1-visual-shell-ready');
  }

  update() {
    if (!this.player) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown) - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown) - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const velocity = new Phaser.Math.Vector2(dx, dy);
    if (velocity.lengthSq()) {
      velocity.normalize().scale(SPEED);
      this.direction = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      this.player.setTexture(`floor1-shell-fox-${this.direction}`);
    }
    this.player.setVelocity(velocity.x, velocity.y).setDepth(this.player.y);
    this.shadow.setPosition(this.player.x, this.player.y - 2).setDepth(this.player.y - 0.1);
    if (Phaser.Input.Keyboard.JustDown(this.keys.C)) this.collisionOverlay.setVisible(!this.collisionOverlay.visible);
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.player.setPosition(this.spawn.x, this.spawn.y).setVelocity(0, 0);
    this.hud.setText([
      'FLOOR 1 · TILED ROOM-SHELL V1',
      `position ${this.player.x.toFixed(0)}, ${this.player.y.toFixed(0)} · facing ${this.direction.toUpperCase()}`,
      'Move WASD / Arrows · Collision C · Reset R',
      '64px back face · 10px side shell · 10px south trim · 52px door opening',
      'Gameplay grid remains orthogonal 32px; depth = character feet Y',
    ]);
  }

  private createPlayer() {
    this.shadow = this.add.ellipse(this.spawn.x, this.spawn.y - 2, 28, 10, 0x263238, 0.28);
    this.player = this.physics.add.sprite(this.spawn.x, this.spawn.y, 'floor1-shell-fox-down')
      .setOrigin(0.5, 1).setDisplaySize(48, 64).setCollideWorldBounds(true).setDepth(this.spawn.y);
    this.player.body!.setSize(180, 100).setOffset(166, 572);
  }

  private createCollision(objects: TiledObject[]) {
    const texture = this.make.graphics({ x: 0, y: 0 }, false);
    texture.fillStyle(0xffffff).fillRect(0, 0, 1, 1).generateTexture('floor1-shell-collider', 1, 1).destroy();
    const group = this.physics.add.staticGroup();
    for (const object of objects) {
      if (object.width <= 0 || object.height <= 0 || properties(object).blocksRobot === false) continue;
      const collider = group.create(object.x + object.width / 2, object.y + object.height / 2, 'floor1-shell-collider') as Phaser.Physics.Arcade.Image;
      collider.setDisplaySize(object.width, object.height).setVisible(false).refreshBody();
    }
    this.physics.add.collider(this.player, group);
    this.collisionOverlay = this.add.graphics().setDepth(10000).setVisible(false).lineStyle(1, 0xff5252, 1).fillStyle(0xff5252, 0.14);
    for (const object of objects) this.collisionOverlay.fillRect(object.x, object.y, object.width, object.height).strokeRect(object.x, object.y, object.width, object.height);
  }

  private createUi() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,C,R') as Keys;
    this.input.keyboard!.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'W', 'A', 'S', 'D', 'C', 'R']);
    this.hud = this.add.text(10, 9, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#f7f3eb', backgroundColor: '#151a1ed9',
      padding: { x: 7, y: 6 }, lineSpacing: 3,
    }).setScrollFactor(0).setDepth(11000);
  }
}
