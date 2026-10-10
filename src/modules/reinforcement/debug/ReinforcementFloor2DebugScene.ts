import * as Phaser from 'phaser';
import { axisAlignedBounds, contains, decompressTileLayers, properties, TILE_LAYERS, type TiledMapJson, type TiledObject } from './floor1Tiled';
import { floor2RoutePoints, spawnSideFromSearch, validateFloor2Map, type Floor2RouteId, type Floor2SpawnSide } from './floor2Tiled';

const MAP_JSON = 'reinforcement-floor2-json';
const FLOOR1_TILESET_JSON = 'reinforcement-floor2-floor1-tileset-json';
const FLOOR2_TILESET_JSON = 'reinforcement-floor2-floor2-tileset-json';
const SPEED = 180;
const PROBE_SPEED = 1800;
const MAP_URL = '/maps/reinforcement/floor_2_blockout.tmj';
const FLOOR1_TILESET_URL = '/assets/environment/reinforcement/floor1_room_shell_manual/floor1_room_shell_manual.tsj';
const FLOOR2_TILESET_URL = '/assets/environment/reinforcement/floor2_room_shell_manual/floor2_room_shell_manual.tsj';
const FLOOR1_TILESET_SOURCE = '../../assets/environment/reinforcement/floor1_room_shell_manual/floor1_room_shell_manual.tsj';
const FLOOR2_TILESET_SOURCE = '../../assets/environment/reinforcement/floor2_room_shell_manual/floor2_room_shell_manual.tsj';
const FLOOR1_ASSET_ROOT = '/assets/environment/reinforcement/floor1_room_shell_manual';
const FLOOR2_ASSET_ROOT = '/assets/environment/reinforcement/floor2_room_shell_manual';
const FLOOR1_ASSET_IDS = ['F1_FLOOR_PUBLIC', 'F1_FLOOR_SERVICE', 'F1_BACKGROUND'] as const;
const ASSET_IDS = ['F2_FLOOR_GREY', 'F2_FLOOR_PART_A', 'F2_FLOOR_PART_B', 'F2_FLOOR_PART_CORNER','F2_FLOOR_PART_D',
  'F2_OFFICE','F2_WALL_WITH_B_RIGHT', 'F2_WALL_WITH_B_LEFT', 'F2_DOOR', 'F2_PRINTER','F2_WALL', 'F2_WALL_SIDE', 'F2_FLOWER',
  'F2_WALL_SIDE_2','F2_BOARD', 'F2_FLOWER_WALL',
] as const;
const FLOOR2_ASSET_ALIASES = {
  F2_BACKGROUND: 'F1_BACKGROUND',
  F2_FLOOR_PUBLIC: 'F1_FLOOR_PUBLIC',
  F2_STAIR_LEFT: 'F1_STAIR_LEFT',
  F2_STAIR_CENTER: 'F1_STAIR_CENTER',
  F2_STAIR_RIGHT: 'F1_STAIR_RIGHT'
} as const;
type ManualTileset = { tiles: { id: number; class?: string; type?: string; image: string; imagewidth: number; imageheight: number }[] };

export class ReinforcementFloor2DebugScene extends Phaser.Scene {
  private robot!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<'C' | 'N' | 'E' | 'G' | 'L' | 'R' | 'T' | 'X' | 'ONE' | 'TWO' | 'THREE' | 'FOUR', Phaser.Input.Keyboard.Key>;
  private collisionOverlay!: Phaser.GameObjects.Container;
  private navigationOverlay!: Phaser.GameObjects.Container;
  private encounterOverlay!: Phaser.GameObjects.Container;
  private transitionOverlay!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Text;
  private spawns!: Record<Floor2SpawnSide, TiledObject>;
  private spawnSide: Floor2SpawnSide = 'LEFT';
  private encounters: TiledObject[] = [];
  private transitions: TiledObject[] = [];
  private currentEncounter: TiledObject | null = null;
  private currentTransition: TiledObject | null = null;
  private navigationEdges: TiledObject[] = [];
  private probePoints: Phaser.Math.Vector2[] = [];
  private probeIndex = 0;
  private probeName = 'NONE';
  private probeTarget = 'F2_CENTER_GUARD';
  private probeSpeed = PROBE_SPEED;
  private lastProbeReport = 0;

  constructor() { super('ReinforcementFloor2DebugScene'); }

  preload() {
    this.load.json(MAP_JSON, MAP_URL);
    this.load.json(FLOOR1_TILESET_JSON, FLOOR1_TILESET_URL);
    this.load.json(FLOOR2_TILESET_JSON, FLOOR2_TILESET_URL);
    for (const assetId of FLOOR1_ASSET_IDS) this.load.image(assetId, `${FLOOR1_ASSET_ROOT}/${assetId}.png`);
    for (const assetId of ASSET_IDS) this.load.image(assetId, `${FLOOR2_ASSET_ROOT}/${assetId}.png`);
    for (const [assetId, sourceId] of Object.entries(FLOOR2_ASSET_ALIASES)) this.load.image(assetId, `${FLOOR1_ASSET_ROOT}/${sourceId}.png`);
  }

  create() {
    void this.initialize().catch(error => {
      console.error(error);
      this.game.events.emit('reinforcement-floor2-debug-error', error instanceof Error ? error.message : String(error));
    });
  }

  private async initialize() {
    const source = this.cache.json.get(MAP_JSON) as TiledMapJson | undefined;
    const floor1Tileset = this.cache.json.get(FLOOR1_TILESET_JSON) as ManualTileset | undefined;
    const floor2Tileset = this.cache.json.get(FLOOR2_TILESET_JSON) as ManualTileset | undefined;
    if (!source || !floor1Tileset || !floor2Tileset) throw new Error('Floor 2 debug: tilemap or tileset JSON failed to load');
    const data = validateFloor2Map(source);
    const map = await decompressTileLayers(source);
    const worldWidth = map.width * map.tilewidth;
    const worldHeight = map.height * map.tileheight;
    this.add.rectangle(worldWidth / 2, worldHeight / 2, worldWidth, worldHeight, 0x171c21).setDepth(-3);
    this.createTileLayers(map, new Map([[FLOOR1_TILESET_SOURCE, floor1Tileset], [FLOOR2_TILESET_SOURCE, floor2Tileset]]));

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
    this.keys = this.input.keyboard!.addKeys('C,N,E,G,L,R,T,X,ONE,TWO,THREE,FOUR') as typeof this.keys;
    this.input.keyboard!.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'C', 'N', 'E', 'G', 'L', 'R', 'T', 'X', 'ONE', 'TWO', 'THREE', 'FOUR']);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setZoom(1.3).startFollow(this.robot, true, 1, 1);

    const background = this.add.rectangle(8, 8, 520, 302, 0x071018, 0.9).setOrigin(0).setScrollFactor(0).setDepth(20);
    background.setStrokeStyle(1, 0x7dd3fc, 0.7);
    this.hud = this.add.text(20, 18, '', { fontFamily: 'monospace', fontSize: '14px', color: '#e5f6ff', lineSpacing: 3 }).setScrollFactor(0).setDepth(21);
    this.refreshHud();
    this.game.events.on('reinforcement-floor2-run-route', this.handleRouteRequest, this);
    this.game.events.on('reinforcement-floor2-toggle-overlay', this.handleOverlayRequest, this);
    this.game.events.on('reinforcement-floor2-run-stair', this.startStairProbe, this);
    this.game.events.on('reinforcement-floor2-run-door', this.startDoorProbe, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('reinforcement-floor2-run-route', this.handleRouteRequest, this));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('reinforcement-floor2-toggle-overlay', this.handleOverlayRequest, this));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('reinforcement-floor2-run-stair', this.startStairProbe, this));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('reinforcement-floor2-run-door', this.startDoorProbe, this));
    this.game.events.emit('reinforcement-floor2-debug-ready', this.spawnSide);
  }

  update(_time: number, delta: number) {
    if (!this.robot || !this.cursors) return;
    if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)) this.startRouteProbe('F2_DIRECT_OFFICE_ROUTE', 'LEFT');
    if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)) this.startRouteProbe('F2_OUTER_CORRIDOR_ROUTE', 'LEFT');
    if (Phaser.Input.Keyboard.JustDown(this.keys.THREE)) this.startRouteProbe('F2_INNER_HALL_ROUTE', 'RIGHT');
    if (Phaser.Input.Keyboard.JustDown(this.keys.FOUR)) this.startRouteProbe('F2_SERVICE_DETOUR_ROUTE', 'RIGHT');
    const dx = Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
    const dy = Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy);
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
    if (Phaser.Input.Keyboard.JustDown(this.keys.G)) { this.probePoints = []; this.probeName = 'NONE'; this.robot.setPosition(1280, 560).setVelocity(0, 0); }
    if (Phaser.Input.Keyboard.JustDown(this.keys.T)) { this.probePoints = []; this.probeName = 'NONE'; this.robot.setPosition(1280, 304).setVelocity(0, 0); }
    if (Phaser.Input.Keyboard.JustDown(this.keys.X)) this.moveToSpawn(this.spawnSide);

    this.currentEncounter = this.encounters.find(zone => contains(zone, this.robot.x, this.robot.y)) ?? null;
    this.currentTransition = this.transitions.find(zone => contains(zone, this.robot.x, this.robot.y)) ?? null;
    this.refreshHud();
  }

  private createTileLayers(map: TiledMapJson, tilesetsBySource: Map<string, ManualTileset>) {
    const tilesets = map.tilesets.map(reference => {
      const tileset = reference.source ? tilesetsBySource.get(reference.source) : undefined;
      if (!tileset) throw new Error(`Floor 2 debug: unsupported tileset ${reference.source ?? '(embedded)'}`);
      return { firstgid: reference.firstgid, tileById: new Map(tileset.tiles.map(tile => [tile.id, tile])) };
    }).sort((left, right) => left.firstgid - right.firstgid);
    const depths: Record<(typeof TILE_LAYERS)[number], number> = { Ground: 0, FloorDetail: 1, Walls: 2, StaticProps: 3, WallTop: 5 };
    for (const name of TILE_LAYERS) {
      const layer = map.layers.find(candidate => candidate.name === name && candidate.type === 'tilelayer');
      if (!layer || !Array.isArray(layer.data)) throw new Error(`Floor 2 debug: tile layer "${name}" is unavailable`);
      for (let cell = 0; cell < layer.data.length; cell += 1) {
        const rawGid = layer.data[cell];
        if (!rawGid) continue;
        const gid = Phaser.Tilemaps.Parsers.Tiled.ParseGID(rawGid);
        let tileset = tilesets[0];
        for (const candidate of tilesets) if (candidate.firstgid <= gid.gid) tileset = candidate;
        const tile = tileset?.tileById.get(gid.gid - tileset.firstgid);
        const assetId = tile?.class ?? tile?.type;
        if (!tile || !assetId || !this.textures.exists(assetId)) throw new Error(`Floor 2 debug: missing manual tile for gid ${gid.gid}`);
        const cellX = (cell % map.width) * map.tilewidth;
        const cellY = Math.floor(cell / map.width) * map.tileheight;
        this.add.image(cellX + tile.imagewidth / 2, cellY + map.tileheight - tile.imageheight / 2, assetId)
          .setRotation(gid.rotation).setFlipX(gid.flipped).setDepth(depths[name]);
      }
    }
  }

  private createRobot() {
    const graphic = this.make.graphics({ x: 0, y: 0 }, false);
    graphic.fillStyle(0x22d3ee).fillCircle(12, 12, 11).fillStyle(0x082f49).fillRect(6, 7, 4, 4).fillRect(14, 7, 4, 4);
    graphic.generateTexture('reinforcement-floor2-debug-robot', 24, 24).destroy();
    const spawn = this.spawns[this.spawnSide];
    this.robot = this.physics.add.sprite(spawn.x, spawn.y, 'reinforcement-floor2-debug-robot').setDepth(4).setCollideWorldBounds(true);
    this.robot.body!.setSize(24, 24);
  }

  private createCollision(objects: TiledObject[]) {
    const texture = this.make.graphics({ x: 0, y: 0 }, false);
    texture.fillStyle(0xffffff).fillRect(0, 0, 1, 1).generateTexture('reinforcement-floor2-debug-collider', 1, 1).destroy();
    const group = this.physics.add.staticGroup();
    for (const object of objects) {
      if (object.width <= 0 || object.height <= 0 || properties(object).blocksRobot === false) continue;
      const bounds = axisAlignedBounds(object);
      const collider = group.create(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, 'reinforcement-floor2-debug-collider') as Phaser.Physics.Arcade.Image;
      collider.setDisplaySize(bounds.width, bounds.height).setVisible(false).refreshBody();
    }
    this.physics.add.collider(this.robot, group);
    const graphics = this.add.graphics().setDepth(10).lineStyle(1, 0xff3b30, 0.9).fillStyle(0xff3b30, 0.16);
    for (const object of objects) {
      const bounds = axisAlignedBounds(object);
      graphics.fillRect(bounds.x, bounds.y, bounds.width, bounds.height).strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    const central = objects.find(object => object.name === 'F2_CENTRAL_BLOCKED_MASS')!;
    this.collisionOverlay = this.add.container(0, 0, [graphics, this.debugLabel(central.x + 4, central.y + 4, central.name, '#ff8a80')]).setDepth(10).setVisible(false);
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

  private moveToSpawn(side: Floor2SpawnSide) {
    this.spawnSide = side;
    const spawn = this.spawns[side];
    this.robot.setPosition(spawn.x, spawn.y).setVelocity(0, 0);
    this.currentEncounter = null;
    this.currentTransition = null;
    this.probePoints = [];
    this.probeName = 'NONE';
  }

  private startRouteProbe(route: Floor2RouteId, side: Floor2SpawnSide) {
    this.spawnSide = side;
    this.probePoints = floor2RoutePoints(this.navigationEdges, route).map(point => new Phaser.Math.Vector2(point.x, point.y));
    this.probeIndex = 1;
    this.probeName = route;
    this.probeTarget = 'F2_CENTER_GUARD';
    this.probeSpeed = PROBE_SPEED;
    this.robot.setPosition(this.probePoints[0].x, this.probePoints[0].y).setVelocity(0, 0);
    this.game.events.emit('reinforcement-floor2-route-probe-start', route);
  }

  private handleRouteRequest(route: Floor2RouteId) {
    this.startRouteProbe(route, route === 'F2_DIRECT_OFFICE_ROUTE' || route === 'F2_OUTER_CORRIDOR_ROUTE' ? 'LEFT' : 'RIGHT');
  }

  private handleOverlayRequest(overlay: 'Collision' | 'Navigation' | 'Encounters') {
    const target = overlay === 'Collision' ? this.collisionOverlay : overlay === 'Navigation' ? this.navigationOverlay : this.encounterOverlay;
    target.setVisible(!target.visible);
    if (overlay === 'Encounters') this.transitionOverlay.setVisible(target.visible);
    this.game.events.emit('reinforcement-floor2-overlay-changed', overlay, target.visible);
  }

  private startStairProbe() {
    const edge = this.navigationEdges.find(item => properties(item).edgeId === 'E_F2_GUARD_STAIR')!;
    this.probePoints = (edge.polyline ?? []).map(point => new Phaser.Math.Vector2(edge.x + point.x, edge.y + point.y));
    this.probeIndex = 1;
    this.probeName = 'F2_CENTER_STAIR_PASS';
    this.probeTarget = 'F2_CENTER_STAIR';
    this.probeSpeed = PROBE_SPEED;
    this.robot.setPosition(this.probePoints[0].x, this.probePoints[0].y).setVelocity(0, 0);
    this.game.events.emit('reinforcement-floor2-route-probe-start', this.probeName);
  }

  private startDoorProbe(side: Floor2SpawnSide) {
    const x = side === 'LEFT' ? 640 : 1920;
    this.probePoints = [new Phaser.Math.Vector2(x, 1040), new Phaser.Math.Vector2(x, 944)];
    this.probeIndex = 1;
    this.probeName = `F2_${side}_ROOM_BLOCK_PROBE`;
    this.probeTarget = `${side} ROOM`;
    this.probeSpeed = SPEED;
    this.robot.setPosition(x, 1040).setVelocity(0, 0);
    this.game.events.emit('reinforcement-floor2-route-probe-start', this.probeName);
  }

  private followRouteProbe(delta: number) {
    if (this.time.now - this.lastProbeReport >= 500) {
      this.lastProbeReport = this.time.now;
      const body = this.robot.body as Phaser.Physics.Arcade.Body;
      this.game.events.emit('reinforcement-floor2-route-probe-progress', this.probeName, this.probeIndex, this.probePoints.length, Math.round(this.robot.x), Math.round(this.robot.y), `v=${Math.round(body.velocity.x)},${Math.round(body.velocity.y)} enabled=${body.enable} moves=${body.moves} blocked=${body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down}`);
    }
    const target = this.probePoints[this.probeIndex];
    if (!target) {
      const route = this.probeName;
      const targetName = this.probeTarget;
      this.probePoints = [];
      this.probeName = `${route}:PASS`;
      this.robot.setVelocity(0, 0);
      this.game.events.emit('reinforcement-floor2-route-probe-complete', route, targetName);
      return;
    }
    const body = this.robot.body as Phaser.Physics.Arcade.Body;
    if (this.probeName.includes('ROOM_BLOCK_PROBE') && body.blocked.up) {
      const probe = this.probeName;
      this.probePoints = [];
      this.probeName = `${probe}:PASS`;
      this.robot.setVelocity(0, 0);
      this.game.events.emit('reinforcement-floor2-route-probe-blocked', probe);
      return;
    }
    const direction = target.clone().subtract(this.robot);
    if (direction.length() <= this.probeSpeed * delta / 1000 + 2) {
      this.robot.setPosition(target.x, target.y);
      this.probeIndex += 1;
      this.game.events.emit('reinforcement-floor2-route-probe-progress', this.probeName, this.probeIndex, this.probePoints.length, target.x, target.y);
      return;
    }
    direction.normalize().scale(this.probeSpeed);
    this.robot.setVelocity(direction.x, direction.y);
  }

  private refreshHud() {
    if (!this.hud) return;
    const encounterValues = this.currentEncounter ? properties(this.currentEncounter) : {};
    const transitionValues = this.currentTransition ? properties(this.currentTransition) : {};
    this.hud.setText([
      `Floor: 2 · BLOCKOUT · spawn=${this.spawnSide}`,
      `Position: ${this.robot.x.toFixed(1)}, ${this.robot.y.toFixed(1)}`,
      `Tile: ${Math.floor(this.robot.x / 32)}, ${Math.floor(this.robot.y / 32)}`,
      `Encounter: ${this.currentEncounter?.name ?? 'NONE'}`,
      this.currentEncounter ? `  type=${encounterValues.encounterType} bypass=${encounterValues.bypassAvailable ?? 'n/a'}` : '',
      `Transition: ${this.currentTransition?.name ?? 'NONE'}`,
      this.currentTransition ? `  targetFloor=${transitionValues.targetFloor} targetSpawn=${transitionValues.targetSpawn}` : '',
      `Collision Debug: ${this.collisionOverlay.visible ? 'ON' : 'OFF'} [C]`,
      `Navigation Debug: ${this.navigationOverlay.visible ? 'ON' : 'OFF'} [N]`,
      `Encounter Debug: ${this.encounterOverlay.visible ? 'ON' : 'OFF'} [E]`,
      `Route Probe: ${this.probeName}`,
      'Auto: [1] L-short · [2] L-long · [3] R-short · [4] R-long',
      'Spawn: [L] LEFT · [R] RIGHT · Reset: [X]',
      'Probe: [G] CENTER GUARD · [T] CENTER STAIR',
      'Move: Arrow Keys',
    ].filter(Boolean));
  }
}
