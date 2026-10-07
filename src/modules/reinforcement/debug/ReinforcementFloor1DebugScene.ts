import * as Phaser from 'phaser';
import { cameraCenterForTarget, contains, decompressTileLayers, embedTileset, properties, resolveCameraZone, TILE_LAYERS, validateFloor1Map, type TiledMapJson, type TiledObject } from './floor1Tiled';

const MAP_JSON = 'reinforcement-floor1-json';
const TILESET_JSON = 'reinforcement-floor1-tileset-json';
const MAP = 'reinforcement-floor1';
const TILES = 'reinforcement-floor1-tiles';
const SPEED = 180;
const USE_BLOCKOUT = new URLSearchParams(globalThis.location?.search ?? '').get('floor1Map') === 'blockout';
const MAP_URL = USE_BLOCKOUT ? '/maps/reinforcement/floor_1_blockout.tmj' : '/maps/reinforcement/floor_1_artpass_v1.tmj';
const TILESET_URL = USE_BLOCKOUT ? '/maps/reinforcement/floor1_visual_tileset.tsj' : '/maps/reinforcement/floor1_art_tileset_v1.tsj';
const TILES_URL = USE_BLOCKOUT ? '/assets/environment/reinforcement/floor1/floor1_tileset.png' : '/assets/environment/reinforcement/floor1/floor1_art_modules_v1.png';
const TILESET_NAME = USE_BLOCKOUT ? 'floor1_visual_tileset' : 'floor1_art_tileset_v1';

export class ReinforcementFloor1DebugScene extends Phaser.Scene {
  private robot!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<'C' | 'N' | 'E' | 'R' | 'V', Phaser.Input.Keyboard.Key>;
  private collisionOverlay!: Phaser.GameObjects.Container;
  private navigationOverlay!: Phaser.GameObjects.Container;
  private encounterOverlay!: Phaser.GameObjects.Container;
  private transitionOverlay!: Phaser.GameObjects.Container;
  private cameraZoneOverlay!: Phaser.GameObjects.Container;
  private cameraDebugGraphics!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private spawn!: TiledObject;
  private encounters: TiledObject[] = [];
  private transitions: TiledObject[] = [];
  private currentEncounter: TiledObject | null = null;
  private currentTransition: TiledObject | null = null;
  private cameraZones: TiledObject[] = [];
  private activeCameraZone: TiledObject | null = null;
  private cameraBlendFrames = 0;
  private previousTransitionName: string | null = null;
  private transitionCount = 0;

  constructor() { super('ReinforcementFloor1DebugScene'); }

  preload() {
    this.load.json(MAP_JSON, MAP_URL);
    this.load.json(TILESET_JSON, TILESET_URL);
    this.load.image(TILES, TILES_URL);
  }

  create() {
    void this.initialize().catch(error => {
      console.error(error);
      this.game.events.emit('reinforcement-floor1-debug-error', error instanceof Error ? error.message : String(error));
    });
  }

  private async initialize() {
    const source = this.cache.json.get(MAP_JSON) as TiledMapJson | undefined;
    const tilesetJson = this.cache.json.get(TILESET_JSON) as Record<string, unknown> | undefined;
    if (!source || !tilesetJson) throw new Error('Floor 1 debug: tilemap or tileset JSON failed to load');
    const data = validateFloor1Map(source);

    this.cache.tilemap.add(MAP, { format: Phaser.Tilemaps.Formats.TILED_JSON, data: embedTileset(await decompressTileLayers(source), tilesetJson) });
    const map = this.make.tilemap({ key: MAP });
    this.add.rectangle(map.widthInPixels / 2, map.heightInPixels / 2, map.widthInPixels, map.heightInPixels, 0x18252d).setDepth(-3);
    this.createArchitecturalMass(data.architecturalMass);
    const tileset = map.addTilesetImage(TILESET_NAME, TILES);
    if (!tileset) throw new Error(`Floor 1 debug: Phaser could not bind ${TILESET_NAME}`);

    const depths: Record<(typeof TILE_LAYERS)[number], number> = { Ground: 0, FloorDetail: 1, Walls: 2, StaticProps: 3, WallTop: 5 };
    for (const name of TILE_LAYERS) {
      const layer = map.createLayer(name, tileset);
      if (!layer) throw new Error(`Floor 1 debug: Phaser could not create tile layer "${name}"`);
      layer.setDepth(depths[name]);
    }

    this.spawn = data.spawn;
    this.encounters = data.encounters;
    this.transitions = data.transitions;
    this.cameraZones = data.cameraZones;
    this.activeCameraZone = resolveCameraZone(this.cameraZones, null, this.spawn.x, this.spawn.y);
    this.createRobot();
    this.createCollision(data.collision);
    this.navigationOverlay = this.createNavigationOverlay(data.nodes, data.edges).setVisible(false);
    this.encounterOverlay = this.createRectangleOverlay(data.encounters, 0xffa726, object => {
      const values = properties(object);
      return `${object.name}\n${values.encounterType} · ${values.route}`;
    }).setVisible(false);
    this.transitionOverlay = this.createRectangleOverlay(data.transitions, 0xab47bc, object => object.name).setVisible(false);
    this.cameraZoneOverlay = this.createCameraZoneOverlay(data.cameraZones).setVisible(false);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('C,N,E,R,V') as typeof this.keys;
    this.input.keyboard!.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'C', 'N', 'E', 'R', 'V']);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setZoom(1.3).setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.updateCameraZone();

    const background = this.add.rectangle(8, 8, 348, 236, 0x071018, 0.88).setOrigin(0).setScrollFactor(0).setDepth(20);
    background.setStrokeStyle(1, 0x7dd3fc, 0.7);
    this.hud = this.add.text(20, 18, '', { fontFamily: 'monospace', fontSize: '14px', color: '#e5f6ff', lineSpacing: 3 }).setScrollFactor(0).setDepth(21);
    this.refreshHud();
    this.game.events.emit('reinforcement-floor1-debug-ready');
  }

  update() {
    const dx = Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
    const dy = Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy);
    if (direction.lengthSq()) direction.normalize().scale(SPEED);
    this.robot.setVelocity(direction.x, direction.y);

    if (Phaser.Input.Keyboard.JustDown(this.keys.C)) this.collisionOverlay.setVisible(!this.collisionOverlay.visible);
    if (Phaser.Input.Keyboard.JustDown(this.keys.N)) this.navigationOverlay.setVisible(!this.navigationOverlay.visible);
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      this.encounterOverlay.setVisible(!this.encounterOverlay.visible);
      this.transitionOverlay.setVisible(this.encounterOverlay.visible);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.V)) this.cameraZoneOverlay.setVisible(!this.cameraZoneOverlay.visible);
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.resetRobot();

    this.currentEncounter = this.encounters.find(zone => contains(zone, this.robot.x, this.robot.y)) ?? null;
    this.currentTransition = this.transitions.find(zone => contains(zone, this.robot.x, this.robot.y)) ?? null;
    const transitionName = this.currentTransition?.name ?? null;
    if (transitionName && transitionName !== this.previousTransitionName) this.transitionCount += 1;
    this.previousTransitionName = transitionName;
    this.updateCameraZone();
    this.refreshHud();
  }

  private updateCameraZone() {
    const camera = this.cameras.main;
    const nextZone = resolveCameraZone(this.cameraZones, this.activeCameraZone, this.robot.x, this.robot.y);
    if (nextZone !== this.activeCameraZone) {
      this.activeCameraZone = nextZone;
      this.cameraBlendFrames = 6;
    }
    if (!this.activeCameraZone) return;
    const desired = cameraCenterForTarget(this.robot.x, this.robot.y, camera.width, camera.height, camera.zoom, this.activeCameraZone);
    const amount = this.cameraBlendFrames > 0 ? 0.4 : 1;
    const blended = cameraCenterForTarget(
      Phaser.Math.Linear(camera.midPoint.x, desired.x, amount),
      Phaser.Math.Linear(camera.midPoint.y, desired.y, amount),
      camera.width,
      camera.height,
      camera.zoom,
      this.activeCameraZone,
    );
    camera.centerOn(blended.x, blended.y);
    this.cameraBlendFrames = Math.max(0, this.cameraBlendFrames - 1);
    this.refreshCameraDebug();
  }

  private createArchitecturalMass(objects: TiledObject[]) {
    const graphics = this.add.graphics().setDepth(-2);
    graphics.fillStyle(0x263640, 1);
    for (const object of objects) graphics.fillRect(object.x, object.y, object.width, object.height);
    graphics.lineStyle(1, 0x40535d, 0.55);
    for (const object of objects) {
      for (let x = object.x; x <= object.x + object.width; x += 64) graphics.lineBetween(x, object.y, x, object.y + object.height);
      for (let y = object.y; y <= object.y + object.height; y += 64) graphics.lineBetween(object.x, y, object.x + object.width, y);
      graphics.strokeRect(object.x, object.y, object.width, object.height);
    }
  }

  private createRobot() {
    const graphic = this.make.graphics({ x: 0, y: 0 }, false);
    graphic.fillStyle(0x22d3ee).fillCircle(12, 12, 11).fillStyle(0x082f49).fillRect(6, 7, 4, 4).fillRect(14, 7, 4, 4);
    graphic.generateTexture('reinforcement-debug-robot', 24, 24).destroy();
    this.robot = this.physics.add.sprite(this.spawn.x, this.spawn.y, 'reinforcement-debug-robot').setDepth(4).setCollideWorldBounds(true);
    this.robot.body!.setSize(24, 24);
  }

  private createCollision(objects: TiledObject[]) {
    const texture = this.make.graphics({ x: 0, y: 0 }, false);
    texture.fillStyle(0xffffff).fillRect(0, 0, 1, 1).generateTexture('reinforcement-debug-collider', 1, 1).destroy();
    const group = this.physics.add.staticGroup();
    for (const object of objects) {
      if (object.width <= 0 || object.height <= 0 || properties(object).blocksRobot === false) continue;
      const collider = group.create(object.x + object.width / 2, object.y + object.height / 2, 'reinforcement-debug-collider') as Phaser.Physics.Arcade.Image;
      collider.setDisplaySize(object.width, object.height).setVisible(false).refreshBody();
    }
    this.physics.add.collider(this.robot, group);

    const graphics = this.add.graphics().setDepth(10);
    graphics.lineStyle(1, 0xff3b30, 0.9).fillStyle(0xff3b30, 0.16);
    for (const object of objects) graphics.fillRect(object.x, object.y, object.width, object.height).strokeRect(object.x, object.y, object.width, object.height);
    const labels = objects.filter(object => ['CENTRAL_CORE', 'RECEPTION_DESK', 'WALL_45_1', 'WALL_45_2'].includes(object.name))
      .map(object => this.debugLabel(object.x + 3, object.y + 3, object.name, '#ff8a80'));
    this.collisionOverlay = this.add.container(0, 0, [graphics, ...labels]).setDepth(10).setVisible(false);
  }

  private createNavigationOverlay(nodes: TiledObject[], edges: TiledObject[]) {
    const graphics = this.add.graphics().setDepth(11);
    graphics.lineStyle(3, 0x42a5f5, 0.85);
    for (const edge of edges) {
      const points = edge.polyline ?? [];
      for (let index = 1; index < points.length; index += 1) {
        graphics.lineBetween(edge.x + points[index - 1].x, edge.y + points[index - 1].y, edge.x + points[index].x, edge.y + points[index].y);
      }
    }
    graphics.fillStyle(0x80d8ff, 1);
    for (const node of nodes) graphics.fillCircle(node.x, node.y, 6);
    const labels = [
      ...nodes.map(node => this.debugLabel(node.x + 8, node.y - 8, String(properties(node).nodeId ?? node.name), '#b3e5fc')),
      ...edges.map(edge => this.debugLabel(edge.x + 6, edge.y + 6, String(properties(edge).edgeId ?? edge.name), '#90caf9')),
    ];
    return this.add.container(0, 0, [graphics, ...labels]).setDepth(11);
  }

  private createRectangleOverlay(objects: TiledObject[], color: number, label: (object: TiledObject) => string) {
    const graphics = this.add.graphics();
    graphics.lineStyle(2, color, 0.95).fillStyle(color, 0.14);
    for (const object of objects) graphics.fillRect(object.x, object.y, object.width, object.height).strokeRect(object.x, object.y, object.width, object.height);
    return this.add.container(0, 0, [graphics, ...objects.map(object => this.debugLabel(object.x + 4, object.y + 4, label(object), '#fff3e0'))]).setDepth(12);
  }

  private createCameraZoneOverlay(zones: TiledObject[]) {
    const graphics = this.add.graphics().lineStyle(2, 0x22d3ee, 0.85);
    for (const zone of zones) graphics.strokeRect(zone.x, zone.y, zone.width, zone.height);
    this.cameraDebugGraphics = this.add.graphics();
    const labels = zones.map(zone => this.debugLabel(zone.x + 5, zone.y + 5, String(properties(zone).cameraZoneId), '#67e8f9'));
    return this.add.container(0, 0, [graphics, this.cameraDebugGraphics, ...labels]).setDepth(13);
  }

  private refreshCameraDebug() {
    if (!this.cameraDebugGraphics || !this.cameraZoneOverlay?.visible || !this.activeCameraZone) return;
    const camera = this.cameras.main;
    const halfVisibleWidth = camera.width / camera.zoom / 2;
    const halfVisibleHeight = camera.height / camera.zoom / 2;
    this.cameraDebugGraphics.clear()
      .fillStyle(0xfacc15, 0.08)
      .lineStyle(3, 0xfacc15, 1)
      .fillRect(this.activeCameraZone.x, this.activeCameraZone.y, this.activeCameraZone.width, this.activeCameraZone.height)
      .strokeRect(this.activeCameraZone.x, this.activeCameraZone.y, this.activeCameraZone.width, this.activeCameraZone.height)
      .lineStyle(3, 0xffffff, 1)
      .strokeRect(camera.midPoint.x - halfVisibleWidth, camera.midPoint.y - halfVisibleHeight, halfVisibleWidth * 2, halfVisibleHeight * 2);
  }

  private debugLabel(x: number, y: number, text: string, color: string) {
    return this.add.text(x, y, text, { fontFamily: 'monospace', fontSize: '11px', color, backgroundColor: '#071018aa', padding: { x: 2, y: 1 } });
  }

  private resetRobot() {
    this.robot.setPosition(this.spawn.x, this.spawn.y).setVelocity(0, 0);
    this.currentEncounter = null;
    this.currentTransition = null;
    this.previousTransitionName = null;
    this.activeCameraZone = resolveCameraZone(this.cameraZones, null, this.spawn.x, this.spawn.y);
    this.cameraBlendFrames = 0;
  }

  private refreshHud() {
    if (!this.hud) return;
    const encounter = this.currentEncounter;
    const encounterValues = encounter ? properties(encounter) : {};
    const transition = this.currentTransition;
    const transitionValues = transition ? properties(transition) : {};
    this.hud.setText([
      `Floor: 1 · ${USE_BLOCKOUT ? 'BLOCKOUT' : 'ART PASS V1'} · 80x45 @ 32px`,
      `Position: ${this.robot.x.toFixed(1)}, ${this.robot.y.toFixed(1)}`,
      `Tile: ${Math.floor(this.robot.x / 32)}, ${Math.floor(this.robot.y / 32)}`,
      `Encounter: ${encounter?.name ?? 'NONE'}`,
      encounter ? `  type=${encounterValues.encounterType} route=${encounterValues.route}` : '',
      `Transition: ${transition?.name ?? 'NONE'} · count=${this.transitionCount}`,
      transition ? `  targetFloor=${transitionValues.targetFloor} targetSpawn=${transitionValues.targetSpawn}` : '',
      `Collision Debug: ${this.collisionOverlay.visible ? 'ON' : 'OFF'} [C]`,
      `Navigation Debug: ${this.navigationOverlay.visible ? 'ON' : 'OFF'} [N]`,
      `Encounter Debug: ${this.encounterOverlay.visible ? 'ON' : 'OFF'} [E]`,
      `Camera Zone: ${this.activeCameraZone?.name ?? 'NONE'} [V]`,
      'Move: Arrow Keys · Reset: R',
    ].filter(Boolean));
  }
}
