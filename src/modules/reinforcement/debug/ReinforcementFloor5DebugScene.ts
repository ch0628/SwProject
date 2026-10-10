import * as Phaser from 'phaser';
import { resolveBuildingSpawn, type BuildingSceneData } from './buildingTransitions';
import { axisAlignedBounds, contains, decompressTileLayers, properties, TILE_LAYERS, type TiledMapJson, type TiledObject } from './floor1Tiled';
import { floor5ProbePoints, floor5TileDepth, missingFloor5PngMessage, missingFloor5TextureMessage, validateFloor5Map, type Floor5ProbeKind, type Floor5RoomId } from './floor5Tiled';

const MAP_JSON = 'reinforcement-floor5-json';
const BLOCKOUT_TILESET_JSON = 'reinforcement-floor5-blockout-tileset-json';
const FLOOR5_TILESET_JSON = 'reinforcement-floor5-manual-tileset-json';
const MAP_URL = '/maps/reinforcement/floor_5_blockout.tmj';
const BLOCKOUT_TILESET_URL = '/assets/environment/reinforcement/floor1_room_shell_manual/floor1_room_shell_manual.tsj';
const FLOOR5_TILESET_URL = '/assets/environment/reinforcement/floor5_room_shell_manual/floor5_room_shell_manual.tsj';
const BLOCKOUT_TILESET_SOURCE = '../../assets/environment/reinforcement/floor1_room_shell_manual/floor1_room_shell_manual.tsj';
const FLOOR5_TILESET_SOURCE = '../../assets/environment/reinforcement/floor5_room_shell_manual/floor5_room_shell_manual.tsj';
const BLOCKOUT_ASSET_ROOT = '/assets/environment/reinforcement/floor1_room_shell_manual';
const ASSET_ROOT = '/assets/environment/reinforcement/floor5_room_shell_manual';
const BLOCKOUT_ASSET_IDS = ['F1_FLOOR_PUBLIC', 'F1_BACKGROUND', 'F1_STAIR_CENTER'] as const;
const ASSET_IDS = [
  'F5_HALL_FLOOR', 'F5_ROOM_FLOOR', 'F5_CONTROL', 'F5_CHAIR_2',
  'F5_CORE', 'F5_CORE_2', 'F5_WALL_BASE', 'F5_WALL_BASE_2', 'F5_WALL_BASE_3',
  'F5_WALL_BASE_HALF', 'F5_WALL_TOP', 'F5_WALL_CORNER', 'F5_STAIR_CENTER',
  'F5_STAIR_LEFT', 'F5_STAIR_RIGHT','F5_WALL_TOP_2','F5_WALL_TOP_3',
  'F5_WALL_BASE_4', 'F5_WALL_BASE_5','F5_WALL_BASE_6',
  'F5_DOOR_CLOSE', 'F5_DOOR_OPEN',
] as const;
const SPEED = 180;
const PROBE_SPEED = 1800;

type ManualTile = { id: number; class?: string; type?: string; image: string; imagewidth: number; imageheight: number };
type ManualTileset = { tiles?: ManualTile[] };
type ProbeRequest = { room: Floor5RoomId; kind: Floor5ProbeKind };

export class ReinforcementFloor5DebugScene extends Phaser.Scene {
  private robot!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<'C' | 'N' | 'E' | 'R' | 'X' | 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'B' | 'P', Phaser.Input.Keyboard.Key>;
  private collisionOverlay!: Phaser.GameObjects.Container;
  private navigationOverlay!: Phaser.GameObjects.Container;
  private encounterOverlay!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Text;
  private spawn!: TiledObject;
  private encounters: TiledObject[] = [];
  private navigationEdges: TiledObject[] = [];
  private currentEncounter: TiledObject | null = null;
  private securityLockCollider!: Phaser.Physics.Arcade.Image;
  private doorColliders = {} as Record<Floor5RoomId, Phaser.Physics.Arcade.Image>;
  private doorVisuals = {} as Record<Floor5RoomId, Phaser.GameObjects.Rectangle>;
  private guardNodes = {} as Record<Floor5RoomId, TiledObject>;
  private bossNeutralized = false;
  private systemRestored = false;
  private lastRoom: Floor5RoomId = 'L1';
  private probePoints: Phaser.Math.Vector2[] = [];
  private probeIndex = 0;
  private probeName = 'NONE';
  private probeTarget = 'F5_SEARCH_HUB';
  private buildingData: BuildingSceneData = {};

  constructor() { super('ReinforcementFloor5DebugScene'); }

  init(data: BuildingSceneData = {}) { this.buildingData = data; }

  preload() {
    this.load.json(MAP_JSON, MAP_URL);
    this.load.json(BLOCKOUT_TILESET_JSON, BLOCKOUT_TILESET_URL);
    this.load.json(FLOOR5_TILESET_JSON, FLOOR5_TILESET_URL);
    for (const assetId of BLOCKOUT_ASSET_IDS) this.load.image(assetId, `${BLOCKOUT_ASSET_ROOT}/${assetId}.png`);
    for (const assetId of ASSET_IDS) this.load.image(assetId, `${ASSET_ROOT}/${assetId}.png`);
  }

  create() {
    void this.initialize().catch(error => {
      console.error(error);
      this.game.events.emit('reinforcement-floor5-debug-error', error instanceof Error ? error.message : String(error));
    });
  }

  private async initialize() {
    const source = this.cache.json.get(MAP_JSON) as TiledMapJson | undefined;
    const blockoutTileset = this.cache.json.get(BLOCKOUT_TILESET_JSON) as ManualTileset | undefined;
    const floor5Tileset = this.cache.json.get(FLOOR5_TILESET_JSON) as ManualTileset | undefined;
    if (!source || !blockoutTileset || !floor5Tileset) throw new Error('Floor 5 debug: tilemap or tileset JSON failed to load');
    const data = validateFloor5Map(source);
    const map = await decompressTileLayers(source);
    const worldWidth = map.width * map.tilewidth;
    const worldHeight = map.height * map.tileheight;
    this.add.rectangle(worldWidth / 2, worldHeight / 2, worldWidth, worldHeight, 0x171c21).setDepth(-3);
    this.createTileLayers(map, new Map([[BLOCKOUT_TILESET_SOURCE, blockoutTileset], [FLOOR5_TILESET_SOURCE, floor5Tileset]]));

    this.spawn = resolveBuildingSpawn([data.spawn], this.buildingData, 5, data.spawn);
    this.encounters = data.encounters;
    this.navigationEdges = data.edges;
    this.guardNodes = Object.fromEntries((['L1', 'L2', 'R1', 'R2'] as const).map(room => [room, data.nodes.find(node => properties(node).nodeId === `F5_${room}_GUARD`)!])) as Record<Floor5RoomId, TiledObject>;
    this.createRobot();
    this.createCollision(data.collision, data.securityLock, data.doors);
    this.navigationOverlay = this.createNavigationOverlay(data.nodes, data.edges).setVisible(false);
    this.encounterOverlay = this.createRectangleOverlay(data.encounters, 0xffa726, object => `${object.name}\nVILLAIN ×${properties(object).villainCount}`).setVisible(false);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('C,N,E,R,X,ONE,TWO,THREE,FOUR,B,P') as typeof this.keys;
    this.input.keyboard!.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'C', 'N', 'E', 'R', 'X', 'ONE', 'TWO', 'THREE', 'FOUR', 'B', 'P']);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setZoom(1.3).startFollow(this.robot, true, 1, 1);

    const background = this.add.rectangle(8, 8, 610, 318, 0x071018, 0.9).setOrigin(0).setScrollFactor(0).setDepth(20);
    background.setStrokeStyle(1, 0x7dd3fc, 0.7);
    this.hud = this.add.text(20, 18, '', { fontFamily: 'monospace', fontSize: '14px', color: '#e5f6ff', lineSpacing: 3 }).setScrollFactor(0).setDepth(21);
    this.refreshHud();
    this.game.events.on('reinforcement-floor5-run-probe', this.handleProbeRequest, this);
    this.game.events.on('reinforcement-floor5-toggle-overlay', this.handleOverlayRequest, this);
    this.game.events.on('reinforcement-floor5-reset', this.resetToHub, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('reinforcement-floor5-run-probe', this.handleProbeRequest, this);
      this.game.events.off('reinforcement-floor5-toggle-overlay', this.handleOverlayRequest, this);
      this.game.events.off('reinforcement-floor5-reset', this.resetToHub, this);
    });
    this.game.events.emit('reinforcement-floor5-debug-ready');
    if (this.buildingData.buildingMode) this.game.events.emit('reinforcement-building-floor-ready', 5, properties(this.spawn).spawnId, this.buildingData.lastTransition);
  }

  update(_time: number, delta: number) {
    if (!this.robot || !this.cursors) return;
    if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)) this.startProbe('L1', 'SEARCH');
    if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)) this.startProbe('L2', 'SEARCH');
    if (Phaser.Input.Keyboard.JustDown(this.keys.THREE)) this.startProbe('R1', 'SEARCH');
    if (Phaser.Input.Keyboard.JustDown(this.keys.FOUR)) this.startProbe('R2', 'SEARCH');
    if (Phaser.Input.Keyboard.JustDown(this.keys.B)) this.startProbe(this.lastRoom, 'NO_BOSS');
    if (Phaser.Input.Keyboard.JustDown(this.keys.P)) this.startProbe(this.lastRoom, 'POST_BOSS');
    if (Phaser.Input.Keyboard.JustDown(this.keys.R) || Phaser.Input.Keyboard.JustDown(this.keys.X)) this.resetToHub();

    const direction = new Phaser.Math.Vector2(Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown), Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown));
    if (direction.lengthSq()) {
      this.probePoints = [];
      this.probeName = 'NONE';
      direction.normalize().scale(SPEED);
      this.robot.setVelocity(direction.x, direction.y);
    } else if (this.probePoints.length) this.followProbe(delta);
    else this.robot.setVelocity(0, 0);

    if (Phaser.Input.Keyboard.JustDown(this.keys.C)) this.handleOverlayRequest('Collision');
    if (Phaser.Input.Keyboard.JustDown(this.keys.N)) this.handleOverlayRequest('Navigation');
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.handleOverlayRequest('Encounters');
    this.currentEncounter = this.encounters.find(zone => contains(zone, this.robot.x, this.robot.y)) ?? null;
    this.refreshHud();
  }

  private createTileLayers(map: TiledMapJson, tilesetsBySource: Map<string, ManualTileset>) {
    const tilesets = map.tilesets.map(reference => {
      const tileset = reference.source ? tilesetsBySource.get(reference.source) : undefined;
      if (!tileset) throw new Error(`Floor 5 debug: unsupported tileset ${reference.source ?? '(embedded)'}`);
      return { firstgid: reference.firstgid, source: reference.source, tileById: new Map((tileset.tiles ?? []).map(tile => [tile.id, tile])) };
    }).sort((left, right) => left.firstgid - right.firstgid);
    for (const name of TILE_LAYERS) {
      const layer = map.layers.find(candidate => candidate.name === name && candidate.type === 'tilelayer');
      if (!layer || !Array.isArray(layer.data)) throw new Error(`Floor 5 debug: tile layer "${name}" is unavailable`);
      layer.data.forEach((rawGid, cell) => {
        if (!rawGid) return;
        const gid = Phaser.Tilemaps.Parsers.Tiled.ParseGID(rawGid);
        let tileset = tilesets[0];
        for (const candidate of tilesets) if (candidate.firstgid <= gid.gid) tileset = candidate;
        const tile = tileset?.tileById.get(gid.gid - tileset.firstgid);
        if (!tile) throw new Error(`Floor 5 debug: tileset has no tile entry for gid ${gid.gid}`);
        const assetId = tile.class ?? tile.type;
        if (!assetId) throw new Error(`Floor 5 debug: tile gid ${gid.gid} has no Class`);
        if (!this.textures.exists(assetId)) {
          if (tileset.source === FLOOR5_TILESET_SOURCE) throw new Error((ASSET_IDS as readonly string[]).includes(assetId) ? missingFloor5PngMessage(assetId) : missingFloor5TextureMessage(assetId));
          throw new Error(`Floor 5 debug: blockout texture "${assetId}" is not loaded`);
        }
        const cellX = (cell % map.width) * map.tilewidth;
        const cellY = Math.floor(cell / map.width) * map.tileheight;
        this.add.image(cellX + tile.imagewidth / 2, cellY + map.tileheight - tile.imageheight / 2, assetId)
          .setRotation(gid.rotation).setFlipX(gid.flipped).setDepth(floor5TileDepth(name, tileset.source === FLOOR5_TILESET_SOURCE));
      });
    }
  }

  private createRobot() {
    const graphic = this.make.graphics({ x: 0, y: 0 }, false).fillStyle(0x29b6f6).fillCircle(12, 12, 12);
    graphic.generateTexture('reinforcement-floor5-debug-robot', 24, 24).destroy();
    this.robot = this.physics.add.sprite(this.spawn.x, this.spawn.y, 'reinforcement-floor5-debug-robot').setDepth(8).setCollideWorldBounds(true);
    this.robot.body!.setSize(24, 24);
  }

  private createCollision(objects: TiledObject[], securityLock: TiledObject, doors: Record<Floor5RoomId, TiledObject>) {
    const texture = this.make.graphics({ x: 0, y: 0 }, false);
    texture.fillStyle(0xffffff).fillRect(0, 0, 1, 1).generateTexture('reinforcement-floor5-debug-collider', 1, 1).destroy();
    const permanent = this.physics.add.staticGroup();
    const dynamic = this.physics.add.staticGroup();
    const graphics = this.add.graphics().setDepth(10).lineStyle(1, 0xff5252, 0.85).fillStyle(0xff1744, 0.08);
    for (const object of objects) {
      const bounds = axisAlignedBounds(object);
      const room = (['L1', 'L2', 'R1', 'R2'] as const).find(candidate => doors[candidate] === object);
      const group = object === securityLock || room ? dynamic : permanent;
      const collider = group.create(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, 'reinforcement-floor5-debug-collider') as Phaser.Physics.Arcade.Image;
      collider.setDisplaySize(bounds.width, bounds.height).refreshBody().setVisible(false);
      if (object === securityLock) this.securityLockCollider = collider;
      if (room) {
        this.doorColliders[room] = collider;
        this.doorVisuals[room] = this.add.rectangle(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, bounds.width, bounds.height, 0x263640)
          .setStrokeStyle(2, 0x59d7ff).setDepth(7);
      }
      graphics.fillRect(bounds.x, bounds.y, bounds.width, bounds.height).strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    this.physics.add.collider(this.robot, permanent);
    this.physics.add.collider(this.robot, dynamic);
    this.collisionOverlay = this.add.container(0, 0, [graphics]).setDepth(10).setVisible(false);
  }

  private createNavigationOverlay(nodes: TiledObject[], edges: TiledObject[]) {
    const graphics = this.add.graphics().setDepth(11).lineStyle(3, 0x42a5f5, 0.85);
    for (const edge of edges) {
      const points = edge.polyline ?? [];
      for (let index = 1; index < points.length; index += 1) graphics.lineBetween(edge.x + points[index - 1].x, edge.y + points[index - 1].y, edge.x + points[index].x, edge.y + points[index].y);
    }
    graphics.fillStyle(0x80d8ff, 1);
    for (const node of nodes) graphics.fillCircle(node.x, node.y, 6);
    return this.add.container(0, 0, [graphics, ...nodes.map(node => this.debugLabel(node.x + 8, node.y - 8, String(properties(node).nodeId ?? node.name), '#b3e5fc'))]).setDepth(11);
  }

  private createRectangleOverlay(objects: TiledObject[], color: number, label: (object: TiledObject) => string) {
    const graphics = this.add.graphics().lineStyle(2, color, 0.95).fillStyle(color, 0.14);
    for (const object of objects) graphics.fillRect(object.x, object.y, object.width, object.height).strokeRect(object.x, object.y, object.width, object.height);
    return this.add.container(0, 0, [graphics, ...objects.map(object => this.debugLabel(object.x + 4, object.y + 4, label(object), '#fff3e0'))]).setDepth(12);
  }

  private debugLabel(x: number, y: number, text: string, color: string) {
    return this.add.text(x, y, text, { fontFamily: 'monospace', fontSize: '11px', color, backgroundColor: '#071018aa', padding: { x: 2, y: 1 } });
  }

  private handleProbeRequest(request: ProbeRequest) { this.startProbe(request.room, request.kind); }

  private startProbe(room: Floor5RoomId, kind: Floor5ProbeKind) {
    this.lastRoom = room;
    this.closeAllDoors();
    if (kind === 'POST_BOSS') this.setBossNeutralized(true);
    else this.setBossNeutralized(false);
    if (kind !== 'SEARCH') this.setDoorOpen(room, true);
    const points = floor5ProbePoints(this.navigationEdges, room, kind);
    this.probePoints = points.map(point => new Phaser.Math.Vector2(point.x, point.y));
    this.probeIndex = 1;
    this.probeName = `${kind}:${room}`;
    this.probeTarget = kind === 'SEARCH' ? `F5_ROOM_${room}` : kind === 'NO_BOSS' ? 'F5_SEARCH_HUB' : 'F5_GOAL';
    this.robot.setPosition(this.probePoints[0].x, this.probePoints[0].y).setVelocity(0, 0);
    this.game.events.emit('reinforcement-floor5-probe-start', this.probeName);
  }

  private setBossNeutralized(value: boolean) {
    this.bossNeutralized = value;
    this.systemRestored = value;
    this.securityLockCollider.body!.enable = !value;
  }

  private setDoorOpen(room: Floor5RoomId, open: boolean) {
    this.doorColliders[room].body!.enable = !open;
    this.doorVisuals[room].setVisible(!open);
  }

  private closeAllDoors() {
    for (const room of ['L1', 'L2', 'R1', 'R2'] as const) this.setDoorOpen(room, false);
  }

  private resetToHub() {
    this.setBossNeutralized(false);
    this.closeAllDoors();
    this.robot.setPosition(this.spawn.x, this.spawn.y).setVelocity(0, 0);
    this.currentEncounter = null;
    this.probePoints = [];
    this.probeName = 'NONE';
    this.probeTarget = 'F5_SEARCH_HUB';
  }

  private handleOverlayRequest(overlay: 'Collision' | 'Navigation' | 'Encounters') {
    const target = overlay === 'Collision' ? this.collisionOverlay : overlay === 'Navigation' ? this.navigationOverlay : this.encounterOverlay;
    target.setVisible(!target.visible);
    this.game.events.emit('reinforcement-floor5-overlay-changed', overlay, target.visible);
  }

  private followProbe(delta: number) {
    const target = this.probePoints[this.probeIndex];
    if (!target) {
      const route = this.probeName;
      this.probePoints = [];
      this.probeName = `${route}:PASS`;
      this.robot.setVelocity(0, 0);
      this.game.events.emit('reinforcement-floor5-probe-complete', route, this.probeTarget);
      return;
    }
    const direction = target.clone().subtract(this.robot);
    if (direction.length() <= PROBE_SPEED * delta / 1000 + 2) {
      this.robot.setPosition(target.x, target.y);
      const guard = this.guardNodes[this.lastRoom];
      if (this.probeName === `SEARCH:${this.lastRoom}` && target.x === guard.x && target.y === guard.y) this.setDoorOpen(this.lastRoom, true);
      this.probeIndex += 1;
      return;
    }
    direction.normalize().scale(PROBE_SPEED);
    this.robot.setVelocity(direction.x, direction.y);
  }

  private refreshHud() {
    if (!this.hud) return;
    this.hud.setText([
      'Floor: 5 · BOSS SEARCH / FINAL CONTROL',
      `Position: ${this.robot.x.toFixed(1)}, ${this.robot.y.toFixed(1)} · Tile: ${Math.floor(this.robot.x / 32)}, ${Math.floor(this.robot.y / 32)}`,
      `Encounter: ${this.currentEncounter?.name ?? 'NONE'}`,
      `State: ${this.bossNeutralized ? 'BOSS_NEUTRALIZED' : 'SEARCHING'} · Lock: ${this.bossNeutralized ? 'OPEN' : 'BLOCKED'}`,
      `System: ${this.systemRestored ? 'SYSTEM_RESTORED' : 'PENDING'} · Boss location: HIDDEN`,
      `Collision [C]: ${this.collisionOverlay.visible ? 'ON' : 'OFF'} · Navigation [N]: ${this.navigationOverlay.visible ? 'ON' : 'OFF'} · Encounters [E]: ${this.encounterOverlay.visible ? 'ON' : 'OFF'}`,
      `Probe: ${this.probeName}`,
      'Rooms: [1] L1 · [2] L2 · [3] R1 · [4] R2',
      'NO_BOSS return: [B] · POST_BOSS/Control: [P] · Reset: [R]/[X]',
      'Move: Arrow Keys',
    ]);
  }
}
