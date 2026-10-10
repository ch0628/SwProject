import * as Phaser from 'phaser';
import { BuildingTransitionGate, type BuildingSceneData } from './buildingTransitions';
import { axisAlignedBounds, contains, decompressTileLayers, properties, TILE_LAYERS, validateFloor1Map, type TiledMapJson, type TiledObject } from './floor1Tiled';

const MAP_JSON = 'reinforcement-floor1-json';
const TILESET_JSON = 'reinforcement-floor1-tileset-json';
const SPEED = 180;
const MAP_URL = '/maps/reinforcement/floor_1_blockout.tmj';
const TILESET_URL = '/assets/environment/reinforcement/floor1_room_shell_manual/floor1_room_shell_manual.tsj';
const ASSET_ROOT = '/assets/environment/reinforcement/floor1_room_shell_manual';
const ASSET_IDS = [
  'F1_FLOOR_PUBLIC', 'F1_FLOOR_SERVICE',
  'F1_BACK_WALL_PLAIN', 'F1_BACK_WALL_VARIANT_A', 'F1_BACK_WALL_VARIANT_B', 'F1_WALL_CORNER_COR',
  'F1_SIDE_WALL_LEFT', 'F1_SIDE_WALL_RIGHT', 'F1_SIDE_END_TOP', 'F1_SIDE_END_BOTTOM',
  'F1_BACK_CORNER_LEFT', 'F1_BACK_CORNER_RIGHT', 'F1_DOOR_H_CLOSED', 'F1_DOOR_H_OPEN',
  'F1_WALL_CORNER_L', 'F1_STAIR_SEAMLESS', 'F1_BACKGROUND', 'F1_STAIR_LEFT', 'F1_STAIR_CENTER', 'F1_STAIR_RIGHT',
  'F1_COUNTER_CENTER', 'F1_COUNTER_LEFT', 'F1_COUNTER_RIGHT','F1_COUNTER_TOP', 'F1_COUNTER_MID',
  'F1_COUCH_LEFT', 'F1_COUCH_CENTER', 'F1_COUCH_RIGHT', 'F1_COUCH_BACK_RIGHT', 'F1_COUCH_BACK_CENTER','F1_COUCH_BACK_LEFT',
  'F1_TABLE_LEFT', 'F1_TABLE_RIGHT',
] as const;
type ManualTileset = { tiles: { id: number; class?: string; type?: string; image: string; imagewidth: number; imageheight: number }[] };

export class ReinforcementFloor1DebugScene extends Phaser.Scene {
  private robot!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<'C' | 'N' | 'E' | 'R', Phaser.Input.Keyboard.Key>;
  private collisionOverlay!: Phaser.GameObjects.Container;
  private navigationOverlay!: Phaser.GameObjects.Container;
  private encounterOverlay!: Phaser.GameObjects.Container;
  private transitionOverlay!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Text;
  private spawn!: TiledObject;
  private encounters: TiledObject[] = [];
  private transitions: TiledObject[] = [];
  private currentEncounter: TiledObject | null = null;
  private currentTransition: TiledObject | null = null;
  private previousTransitionName: string | null = null;
  private transitionCount = 0;
  private buildingData: BuildingSceneData = {};
  private buildingTransitionGate = new BuildingTransitionGate();

  constructor() { super('ReinforcementFloor1DebugScene'); }

  init(data: BuildingSceneData = {}) {
    this.buildingData = data;
    this.buildingTransitionGate.reset();
  }

  preload() {
    this.load.json(MAP_JSON, MAP_URL);
    this.load.json(TILESET_JSON, TILESET_URL);
    for (const assetId of ASSET_IDS) this.load.image(assetId, `${ASSET_ROOT}/${assetId}.png`);
  }

  create() {
    void this.initialize().catch(error => {
      console.error(error);
      this.game.events.emit('reinforcement-floor1-debug-error', error instanceof Error ? error.message : String(error));
    });
  }

  private async initialize() {
    const source = this.cache.json.get(MAP_JSON) as TiledMapJson | undefined;
    const tilesetJson = this.cache.json.get(TILESET_JSON) as ManualTileset | undefined;
    if (!source || !tilesetJson) throw new Error('Floor 1 debug: tilemap or tileset JSON failed to load');
    const data = validateFloor1Map(source);
    const map = await decompressTileLayers(source);
    const worldWidth = map.width * map.tilewidth;
    const worldHeight = map.height * map.tileheight;
    this.add.rectangle(worldWidth / 2, worldHeight / 2, worldWidth, worldHeight, 0x18252d).setDepth(-3);
    this.createArchitecturalMass(data.architecturalMass);
    this.createTileLayers(map, tilesetJson);

    this.spawn = data.spawn;
    this.encounters = data.encounters;
    this.transitions = data.transitions;
    this.createRobot();
    this.createCollision(data.collision);
    this.navigationOverlay = this.createNavigationOverlay(data.nodes, data.edges).setVisible(false);
    this.encounterOverlay = this.createRectangleOverlay(data.encounters, 0xffa726, object => {
      const values = properties(object);
      return `${object.name}\n${values.encounterType} · ${values.route}`;
    }).setVisible(false);
    this.transitionOverlay = this.createRectangleOverlay(data.transitions, 0xab47bc, object => object.name).setVisible(false);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('C,N,E,R') as typeof this.keys;
    this.input.keyboard!.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'C', 'N', 'E', 'R']);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setZoom(1.3).startFollow(this.robot, true, 1, 1);

    const background = this.add.rectangle(8, 8, 348, 236, 0x071018, 0.88).setOrigin(0).setScrollFactor(0).setDepth(20);
    background.setStrokeStyle(1, 0x7dd3fc, 0.7);
    this.hud = this.add.text(20, 18, '', { fontFamily: 'monospace', fontSize: '14px', color: '#e5f6ff', lineSpacing: 3 }).setScrollFactor(0).setDepth(21);
    this.refreshHud();
    this.game.events.emit('reinforcement-floor1-debug-ready');
    if (this.buildingData.buildingMode) this.game.events.emit('reinforcement-building-floor-ready', 1, 'F1_ROBOT_SPAWN', this.buildingData.lastTransition);
  }

  update() {
    if (!this.robot || !this.cursors) return;
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
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.resetRobot();

    this.currentEncounter = this.encounters.find(zone => contains(zone, this.robot.x, this.robot.y)) ?? null;
    this.currentTransition = this.transitions.find(zone => contains(zone, this.robot.x, this.robot.y)) ?? null;
    if (this.handleBuildingTransition()) return;
    const transitionName = this.currentTransition?.name ?? null;
    if (transitionName && transitionName !== this.previousTransitionName) this.transitionCount += 1;
    this.previousTransitionName = transitionName;
    this.refreshHud();
  }

  private handleBuildingTransition() {
    if (!this.buildingData.buildingMode) return false;
    const destination = this.buildingTransitionGate.consume(this.currentTransition);
    if (!destination) return false;
    this.robot.setVelocity(0, 0);
    this.game.events.emit('reinforcement-building-transition', 1, destination.targetFloor, destination.targetSpawn);
    this.scene.start(destination.sceneKey, destination.sceneData);
    return true;
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

  private createTileLayers(map: TiledMapJson, tileset: ManualTileset) {
    const firstgid = map.tilesets[0]?.firstgid;
    if (map.tilesets.length !== 1 || firstgid !== 1) throw new Error('Floor 1 debug: expected one manual tileset at firstgid 1');
    const tileById = new Map(tileset.tiles.map(tile => [tile.id, tile]));
    const depths: Record<(typeof TILE_LAYERS)[number], number> = { Ground: 0, FloorDetail: 1, Walls: 2, StaticProps: 3, WallTop: 5 };
    for (const name of TILE_LAYERS) {
      const layer = map.layers.find(candidate => candidate.name === name && candidate.type === 'tilelayer');
      if (!layer || !Array.isArray(layer.data)) throw new Error(`Floor 1 debug: tile layer "${name}" is unavailable`);
      for (let cell = 0; cell < layer.data.length; cell += 1) {
        const rawGid = layer.data[cell];
        if (!rawGid) continue;
        const gid = Phaser.Tilemaps.Parsers.Tiled.ParseGID(rawGid);
        const tile = tileById.get(gid.gid - firstgid);
        const assetId = tile?.class ?? tile?.type;
        if (!tile || !assetId || !this.textures.exists(assetId)) throw new Error(`Floor 1 debug: missing manual tile for gid ${gid.gid}`);
        const cellX = (cell % map.width) * map.tilewidth;
        const cellY = Math.floor(cell / map.width) * map.tileheight;
        const image = this.add.image(cellX + tile.imagewidth / 2, cellY + map.tileheight, assetId)
          .setOrigin(0.5, 1).setAlpha(layer.opacity ?? 1).setDepth(depths[name]);
        if (gid.rotation || gid.flipped) image.setPosition(cellX + map.tilewidth / 2, cellY + map.tileheight / 2).setOrigin(0.5).setRotation(gid.rotation).setFlipX(gid.flipped);
      }
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
      const bounds = axisAlignedBounds(object);
      const collider = group.create(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, 'reinforcement-debug-collider') as Phaser.Physics.Arcade.Image;
      collider.setDisplaySize(bounds.width, bounds.height).setVisible(false).refreshBody();
    }
    this.physics.add.collider(this.robot, group);

    const graphics = this.add.graphics().setDepth(10);
    graphics.lineStyle(1, 0xff3b30, 0.9).fillStyle(0xff3b30, 0.16);
    for (const object of objects) {
      const bounds = axisAlignedBounds(object);
      graphics.fillRect(bounds.x, bounds.y, bounds.width, bounds.height).strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    const labels = objects.filter(object => ['CENTRAL_CORE', 'RECEPTION_DESK', 'WALL_45_1', 'WALL_45_2'].includes(object.name))
      .map(object => {
        const bounds = axisAlignedBounds(object);
        return this.debugLabel(bounds.x + 3, bounds.y + 3, object.name, '#ff8a80');
      });
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

  private debugLabel(x: number, y: number, text: string, color: string) {
    return this.add.text(x, y, text, { fontFamily: 'monospace', fontSize: '11px', color, backgroundColor: '#071018aa', padding: { x: 2, y: 1 } });
  }

  private resetRobot() {
    this.robot.setPosition(this.spawn.x, this.spawn.y).setVelocity(0, 0);
    this.currentEncounter = null;
    this.currentTransition = null;
    this.previousTransitionName = null;
  }

  private refreshHud() {
    if (!this.hud) return;
    const encounter = this.currentEncounter;
    const encounterValues = encounter ? properties(encounter) : {};
    const transition = this.currentTransition;
    const transitionValues = transition ? properties(transition) : {};
    this.hud.setText([
      'Floor: 1 · BLOCKOUT · 80x45 @ 32px',
      `Position: ${this.robot.x.toFixed(1)}, ${this.robot.y.toFixed(1)}`,
      `Tile: ${Math.floor(this.robot.x / 32)}, ${Math.floor(this.robot.y / 32)}`,
      `Encounter: ${encounter?.name ?? 'NONE'}`,
      encounter ? `  type=${encounterValues.encounterType} route=${encounterValues.route}` : '',
      `Transition: ${transition?.name ?? 'NONE'} · count=${this.transitionCount}`,
      transition ? `  targetFloor=${transitionValues.targetFloor} targetSpawn=${transitionValues.targetSpawn}` : '',
      `Collision Debug: ${this.collisionOverlay.visible ? 'ON' : 'OFF'} [C]`,
      `Navigation Debug: ${this.navigationOverlay.visible ? 'ON' : 'OFF'} [N]`,
      `Encounter Debug: ${this.encounterOverlay.visible ? 'ON' : 'OFF'} [E]`,
      'Camera: character-centered follow',
      'Move: Arrow Keys · Reset: R',
    ].filter(Boolean));
  }
}
