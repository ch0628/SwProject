import * as Phaser from 'phaser';
import { axisAlignedBounds, contains, decompressTileLayers, properties, TILE_LAYERS, type TiledMapJson, type TiledObject } from './floor1Tiled';
import { floor4RoutePoints, floor4TileDepth, missingFloor4PngMessage, missingFloor4TextureMessage, spawnSideFromSearch, validateFloor4Map, type Floor4RouteId, type Floor4SpawnSide } from './floor4Tiled';

const MAP_JSON = 'reinforcement-floor4-json';
const BLOCKOUT_TILESET_JSON = 'reinforcement-floor4-blockout-tileset-json';
const FLOOR4_TILESET_JSON = 'reinforcement-floor4-manual-tileset-json';
const MAP_URL = '/maps/reinforcement/floor_4_blockout.tmj';
const BLOCKOUT_TILESET_URL = '/assets/environment/reinforcement/floor1_room_shell_manual/floor1_room_shell_manual.tsj';
const FLOOR4_TILESET_URL = '/assets/environment/reinforcement/floor4_room_shell_manual/floor4_room_shell_manual.tsj';
const BLOCKOUT_TILESET_SOURCE = '../../assets/environment/reinforcement/floor1_room_shell_manual/floor1_room_shell_manual.tsj';
const FLOOR4_TILESET_SOURCE = '../../assets/environment/reinforcement/floor4_room_shell_manual/floor4_room_shell_manual.tsj';
const BLOCKOUT_ASSET_ROOT = '/assets/environment/reinforcement/floor1_room_shell_manual';
const ASSET_ROOT = '/assets/environment/reinforcement/floor4_room_shell_manual';
const BLOCKOUT_ASSET_IDS = ['F1_FLOOR_PUBLIC', 'F1_FLOOR_SERVICE', 'F1_BACKGROUND', 'F1_STAIR_LEFT', 'F1_STAIR_CENTER', 'F1_STAIR_RIGHT'] as const;
const ASSET_IDS = [
  'F4_CABINET', 'F4_DOOR1', 'F4_FLOOR', 'F4_PANEL_WALL', 'F4_PIPE_WALL',
  'F4_SERVER', 'F4_STAIR_CENTER', 'F4_STAIR_LEFT', 'F4_STAIR_RIGHT', 'F4_TOP_WALL_1',
  'F4_TOP_WALL_2', 'F4_WAL_HALF', 'F4_WAL_HALFL', 'F4_WALL', 'F4_TOP_WALL_3', 'F4_ACC',
] as const;
const SPEED = 180;
const PROBE_SPEED = 1800;

type ManualTile = { id: number; class?: string; type?: string; image: string; imagewidth: number; imageheight: number };
type ManualTileset = { tiles?: ManualTile[] };

export class ReinforcementFloor4DebugScene extends Phaser.Scene {
  private robot!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<'C' | 'N' | 'E' | 'L' | 'R' | 'X' | 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'G', Phaser.Input.Keyboard.Key>;
  private collisionOverlay!: Phaser.GameObjects.Container;
  private navigationOverlay!: Phaser.GameObjects.Container;
  private encounterOverlay!: Phaser.GameObjects.Container;
  private transitionOverlay!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Text;
  private spawns!: Record<Floor4SpawnSide, TiledObject>;
  private spawnSide: Floor4SpawnSide = 'LEFT';
  private encounters: TiledObject[] = [];
  private transitions: TiledObject[] = [];
  private navigationEdges: TiledObject[] = [];
  private currentEncounter: TiledObject | null = null;
  private currentTransition: TiledObject | null = null;
  private probePoints: Phaser.Math.Vector2[] = [];
  private probeIndex = 0;
  private probeName = 'NONE';
  private probeTarget = 'F4_CENTER_GUARD';

  constructor() { super('ReinforcementFloor4DebugScene'); }

  preload() {
    this.load.json(MAP_JSON, MAP_URL);
    this.load.json(BLOCKOUT_TILESET_JSON, BLOCKOUT_TILESET_URL);
    this.load.json(FLOOR4_TILESET_JSON, FLOOR4_TILESET_URL);
    for (const assetId of BLOCKOUT_ASSET_IDS) this.load.image(assetId, `${BLOCKOUT_ASSET_ROOT}/${assetId}.png`);
    for (const assetId of ASSET_IDS) this.load.image(assetId, `${ASSET_ROOT}/${assetId}.png`);
  }

  create() {
    void this.initialize().catch(error => {
      console.error(error);
      this.game.events.emit('reinforcement-floor4-debug-error', error instanceof Error ? error.message : String(error));
    });
  }

  private async initialize() {
    const source = this.cache.json.get(MAP_JSON) as TiledMapJson | undefined;
    const blockoutTileset = this.cache.json.get(BLOCKOUT_TILESET_JSON) as ManualTileset | undefined;
    const floor4Tileset = this.cache.json.get(FLOOR4_TILESET_JSON) as ManualTileset | undefined;
    if (!source || !blockoutTileset || !floor4Tileset) throw new Error('Floor 4 debug: tilemap or tileset JSON failed to load');
    const data = validateFloor4Map(source);
    const map = await decompressTileLayers(source);
    const worldWidth = map.width * map.tilewidth;
    const worldHeight = map.height * map.tileheight;
    this.add.rectangle(worldWidth / 2, worldHeight / 2, worldWidth, worldHeight, 0x171c21).setDepth(-3);
    this.createTileLayers(map, new Map([[BLOCKOUT_TILESET_SOURCE, blockoutTileset], [FLOOR4_TILESET_SOURCE, floor4Tileset]]));

    this.spawns = data.spawns;
    this.spawnSide = spawnSideFromSearch(window.location.search);
    this.encounters = data.encounters;
    this.transitions = data.transitions;
    this.navigationEdges = data.edges;
    this.createRobot();
    this.createCollision(data.collision);
    this.navigationOverlay = this.createNavigationOverlay(data.nodes, data.edges).setVisible(false);
    this.encounterOverlay = this.createRectangleOverlay(data.encounters, 0xffa726, object => {
      const values = properties(object);
      return `${object.name}\n${values.encounterType}${values.villainCount ? ` · villains=${values.villainCount}` : ''}`;
    }).setVisible(false);
    this.transitionOverlay = this.createRectangleOverlay(data.transitions, 0xab47bc, object => object.name).setVisible(false);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('C,N,E,L,R,X,ONE,TWO,THREE,FOUR,G') as typeof this.keys;
    this.input.keyboard!.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'C', 'N', 'E', 'L', 'R', 'X', 'ONE', 'TWO', 'THREE', 'FOUR', 'G']);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setZoom(1.3).startFollow(this.robot, true, 1, 1);

    const background = this.add.rectangle(8, 8, 560, 294, 0x071018, 0.9).setOrigin(0).setScrollFactor(0).setDepth(20);
    background.setStrokeStyle(1, 0x7dd3fc, 0.7);
    this.hud = this.add.text(20, 18, '', { fontFamily: 'monospace', fontSize: '14px', color: '#e5f6ff', lineSpacing: 3 }).setScrollFactor(0).setDepth(21);
    this.refreshHud();
    this.game.events.on('reinforcement-floor4-run-route', this.handleRouteRequest, this);
    this.game.events.on('reinforcement-floor4-toggle-overlay', this.handleOverlayRequest, this);
    this.game.events.on('reinforcement-floor4-run-stair', this.startStairProbe, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('reinforcement-floor4-run-route', this.handleRouteRequest, this);
      this.game.events.off('reinforcement-floor4-toggle-overlay', this.handleOverlayRequest, this);
      this.game.events.off('reinforcement-floor4-run-stair', this.startStairProbe, this);
    });
    this.game.events.emit('reinforcement-floor4-debug-ready', this.spawnSide);
  }

  update(_time: number, delta: number) {
    if (!this.robot || !this.cursors) return;
    if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)) this.startRouteProbe('F4_SECURITY_HALL_ROUTE', 'LEFT');
    if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)) this.startRouteProbe('F4_PERIMETER_DETOUR_ROUTE', 'LEFT');
    if (Phaser.Input.Keyboard.JustDown(this.keys.THREE)) this.startRouteProbe('F4_INNER_SECURITY_ROUTE', 'RIGHT');
    if (Phaser.Input.Keyboard.JustDown(this.keys.FOUR)) this.startRouteProbe('F4_SERVICE_ROUTE', 'RIGHT');
    const direction = new Phaser.Math.Vector2(Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown), Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown));
    if (direction.lengthSq()) {
      this.probePoints = [];
      this.probeName = 'NONE';
      direction.normalize().scale(SPEED);
      this.robot.setVelocity(direction.x, direction.y);
    } else if (this.probePoints.length) this.followRouteProbe(delta);
    else this.robot.setVelocity(0, 0);

    if (Phaser.Input.Keyboard.JustDown(this.keys.C)) this.handleOverlayRequest('Collision');
    if (Phaser.Input.Keyboard.JustDown(this.keys.N)) this.handleOverlayRequest('Navigation');
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.handleOverlayRequest('Encounters');
    if (Phaser.Input.Keyboard.JustDown(this.keys.L)) this.moveToSpawn('LEFT');
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.moveToSpawn('RIGHT');
    if (Phaser.Input.Keyboard.JustDown(this.keys.X)) this.moveToSpawn(this.spawnSide);
    if (Phaser.Input.Keyboard.JustDown(this.keys.G)) this.startStairProbe();

    this.currentEncounter = this.encounters.find(zone => contains(zone, this.robot.x, this.robot.y)) ?? null;
    this.currentTransition = this.transitions.find(zone => contains(zone, this.robot.x, this.robot.y)) ?? null;
    this.refreshHud();
  }

  private createTileLayers(map: TiledMapJson, tilesetsBySource: Map<string, ManualTileset>) {
    const tilesets = map.tilesets.map(reference => {
      const tileset = reference.source ? tilesetsBySource.get(reference.source) : undefined;
      if (!tileset) throw new Error(`Floor 4 debug: unsupported tileset ${reference.source ?? '(embedded)'}`);
      return { firstgid: reference.firstgid, source: reference.source, tileById: new Map((tileset.tiles ?? []).map(tile => [tile.id, tile])) };
    }).sort((left, right) => left.firstgid - right.firstgid);
    for (const name of TILE_LAYERS) {
      const layer = map.layers.find(candidate => candidate.name === name && candidate.type === 'tilelayer');
      if (!layer || !Array.isArray(layer.data)) throw new Error(`Floor 4 debug: tile layer "${name}" is unavailable`);
      layer.data.forEach((rawGid, cell) => {
        if (!rawGid) return;
        const gid = Phaser.Tilemaps.Parsers.Tiled.ParseGID(rawGid);
        let tileset = tilesets[0];
        for (const candidate of tilesets) if (candidate.firstgid <= gid.gid) tileset = candidate;
        const tile = tileset?.tileById.get(gid.gid - tileset.firstgid);
        if (!tile) throw new Error(`Floor 4 debug: tileset has no tile entry for gid ${gid.gid}`);
        const assetId = tile.class ?? tile.type;
        if (!assetId) throw new Error(`Floor 4 debug: tile gid ${gid.gid} has no Class`);
        if (!this.textures.exists(assetId)) {
          if (tileset.source === FLOOR4_TILESET_SOURCE) {
            throw new Error((ASSET_IDS as readonly string[]).includes(assetId) ? missingFloor4PngMessage(assetId) : missingFloor4TextureMessage(assetId));
          }
          throw new Error(`Floor 4 debug: blockout texture "${assetId}" is not loaded`);
        }
        const cellX = (cell % map.width) * map.tilewidth;
        const cellY = Math.floor(cell / map.width) * map.tileheight;
        this.add.image(cellX + tile.imagewidth / 2, cellY + map.tileheight - tile.imageheight / 2, assetId)
          .setRotation(gid.rotation).setFlipX(gid.flipped).setDepth(floor4TileDepth(name, tileset.source === FLOOR4_TILESET_SOURCE));
      });
    }
  }

  private createRobot() {
    const graphic = this.make.graphics({ x: 0, y: 0 }, false).fillStyle(0x29b6f6).fillCircle(12, 12, 12);
    graphic.generateTexture('reinforcement-floor4-debug-robot', 24, 24).destroy();
    const spawn = this.spawns[this.spawnSide];
    this.robot = this.physics.add.sprite(spawn.x, spawn.y, 'reinforcement-floor4-debug-robot').setDepth(8).setCollideWorldBounds(true);
    this.robot.body!.setSize(24, 24);
  }

  private createCollision(objects: TiledObject[]) {
    const texture = this.make.graphics({ x: 0, y: 0 }, false);
    texture.fillStyle(0xffffff).fillRect(0, 0, 1, 1).generateTexture('reinforcement-floor4-debug-collider', 1, 1).destroy();
    const group = this.physics.add.staticGroup();
    const graphics = this.add.graphics().setDepth(10).lineStyle(1, 0xff5252, 0.85).fillStyle(0xff1744, 0.08);
    for (const object of objects) {
      const bounds = axisAlignedBounds(object);
      const collider = group.create(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, 'reinforcement-floor4-debug-collider') as Phaser.Physics.Arcade.Image;
      collider.setDisplaySize(bounds.width, bounds.height).refreshBody().setVisible(false);
      graphics.fillRect(bounds.x, bounds.y, bounds.width, bounds.height).strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    this.physics.add.collider(this.robot, group);
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

  private moveToSpawn(side: Floor4SpawnSide) {
    this.spawnSide = side;
    this.robot.setPosition(this.spawns[side].x, this.spawns[side].y).setVelocity(0, 0);
    this.currentEncounter = null;
    this.currentTransition = null;
    this.probePoints = [];
    this.probeName = 'NONE';
  }

  private handleRouteRequest(route: Floor4RouteId) {
    this.startRouteProbe(route, route.startsWith('F4_LEFT') || route === 'F4_SECURITY_HALL_ROUTE' || route === 'F4_PERIMETER_DETOUR_ROUTE' ? 'LEFT' : 'RIGHT');
  }

  private startRouteProbe(route: Floor4RouteId, side: Floor4SpawnSide) {
    this.spawnSide = side;
    this.probePoints = floor4RoutePoints(this.navigationEdges, route).map(point => new Phaser.Math.Vector2(point.x, point.y));
    this.probeIndex = 1;
    this.probeName = route;
    this.probeTarget = 'F4_CENTER_GUARD';
    this.robot.setPosition(this.probePoints[0].x, this.probePoints[0].y).setVelocity(0, 0);
    this.game.events.emit('reinforcement-floor4-route-probe-start', route);
  }

  private startStairProbe() {
    const edge = this.navigationEdges.find(item => properties(item).edgeId === 'E_F4_GUARD_STAIR')!;
    this.probePoints = (edge.polyline ?? []).map(point => new Phaser.Math.Vector2(edge.x + point.x, edge.y + point.y));
    this.probeIndex = 1;
    this.probeName = 'F4_GUARD_STAIR_PASS';
    this.probeTarget = 'F4_CENTER_STAIR';
    this.robot.setPosition(this.probePoints[0].x, this.probePoints[0].y).setVelocity(0, 0);
    this.game.events.emit('reinforcement-floor4-route-probe-start', this.probeName);
  }

  private handleOverlayRequest(overlay: 'Collision' | 'Navigation' | 'Encounters') {
    const target = overlay === 'Collision' ? this.collisionOverlay : overlay === 'Navigation' ? this.navigationOverlay : this.encounterOverlay;
    target.setVisible(!target.visible);
    if (overlay === 'Encounters') this.transitionOverlay.setVisible(target.visible);
    this.game.events.emit('reinforcement-floor4-overlay-changed', overlay, target.visible);
  }

  private followRouteProbe(delta: number) {
    const target = this.probePoints[this.probeIndex];
    if (!target) {
      const route = this.probeName;
      this.probePoints = [];
      this.probeName = `${route}:PASS`;
      this.robot.setVelocity(0, 0);
      this.game.events.emit('reinforcement-floor4-route-probe-complete', route, this.probeTarget);
      return;
    }
    const direction = target.clone().subtract(this.robot);
    if (direction.length() <= PROBE_SPEED * delta / 1000 + 2) {
      this.robot.setPosition(target.x, target.y);
      this.probeIndex += 1;
      return;
    }
    direction.normalize().scale(PROBE_SPEED);
    this.robot.setVelocity(direction.x, direction.y);
  }

  private refreshHud() {
    if (!this.hud) return;
    const encounterValues = this.currentEncounter ? properties(this.currentEncounter) : {};
    const transitionValues = this.currentTransition ? properties(this.currentTransition) : {};
    this.hud.setText([
      `Floor: 4 · SECURITY / CONVERGENCE · ${this.spawnSide}`,
      `Position: ${this.robot.x.toFixed(1)}, ${this.robot.y.toFixed(1)} · Tile: ${Math.floor(this.robot.x / 32)}, ${Math.floor(this.robot.y / 32)}`,
      `Encounter: ${this.currentEncounter?.name ?? 'NONE'}`,
      this.currentEncounter ? `  type=${encounterValues.encounterType} bypass=${encounterValues.bypassAvailable ?? 'n/a'}` : '',
      `Transition: ${this.currentTransition?.name ?? 'NONE'}`,
      this.currentTransition ? `  targetFloor=${transitionValues.targetFloor} targetSpawn=${transitionValues.targetSpawn}` : '',
      `Collision [C]: ${this.collisionOverlay.visible ? 'ON' : 'OFF'} · Navigation [N]: ${this.navigationOverlay.visible ? 'ON' : 'OFF'}`,
      `Encounters [E]: ${this.encounterOverlay.visible ? 'ON' : 'OFF'} · Probe: ${this.probeName}`,
      'Routes: [1] L short · [2] L long · [3] R short · [4] R long',
      'Spawn: [L] LEFT · [R] RIGHT · Guard→Stair: [G] · Reset: [X]',
      'Move: Arrow Keys',
    ].filter(Boolean));
  }
}
