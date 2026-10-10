import * as Phaser from 'phaser';
import { axisAlignedBounds, contains, decompressTileLayers, properties, TILE_LAYERS, type TiledMapJson, type TiledObject } from './floor1Tiled';
import { floor3RoutePoints, floor3TileDepth, missingFloor3TextureMessage, validateFloor3Map, type Floor3RouteId, type Floor3StairSide } from './floor3Tiled';

const MAP_JSON = 'reinforcement-floor3-json';
const BLOCKOUT_TILESET_JSON = 'reinforcement-floor3-blockout-tileset-json';
const FLOOR3_TILESET_JSON = 'reinforcement-floor3-manual-tileset-json';
const SPEED = 180;
const PROBE_SPEED = 1800;
const MAP_URL = '/maps/reinforcement/floor_3_blockout.tmj';
const BLOCKOUT_TILESET_URL = '/assets/environment/reinforcement/floor1_room_shell_manual/floor1_room_shell_manual.tsj';
const FLOOR3_TILESET_URL = '/assets/environment/reinforcement/floor3_room_shell_manual/floor3_room_shell_manual.tsj';
const BLOCKOUT_TILESET_SOURCE = '../../assets/environment/reinforcement/floor1_room_shell_manual/floor1_room_shell_manual.tsj';
const FLOOR3_TILESET_SOURCE = '../../assets/environment/reinforcement/floor3_room_shell_manual/floor3_room_shell_manual.tsj';
const BLOCKOUT_ASSET_ROOT = '/assets/environment/reinforcement/floor1_room_shell_manual';
const ASSET_ROOT = '/assets/environment/reinforcement/floor3_room_shell_manual';
const BLOCKOUT_ASSET_IDS = ['F1_FLOOR_PUBLIC', 'F1_FLOOR_SERVICE', 'F1_BACKGROUND', 'F1_STAIR_LEFT', 'F1_STAIR_CENTER', 'F1_STAIR_RIGHT'] as const;
const ASSET_IDS = [
  'FLOOR3_DOOR1', 'FLOOR3_WALL', 'F3_STAIR_CENTER', 'F3_STAIR_LEFT', 'F3_STAIR_RIGHT','F3_PANEL_WALL',
  'F3_CABINET', 'F3_MIRROR', 'F3_PIPE_WALL', 'F3_SERVER','F3_TOP_WALL_1', 'F3_TOP_WALL_2', 'F3_WAL_HALF',
  'F3_FLOOR',

] as const;

type ManualTile = { id: number; class?: string; type?: string; image: string; imagewidth: number; imageheight: number };
type ManualTileset = { tiles?: ManualTile[] };

export class ReinforcementFloor3DebugScene extends Phaser.Scene {
  private robot!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<'C' | 'N' | 'E' | 'G' | 'L' | 'R' | 'X' | 'ONE' | 'TWO', Phaser.Input.Keyboard.Key>;
  private collisionOverlay!: Phaser.GameObjects.Container;
  private navigationOverlay!: Phaser.GameObjects.Container;
  private encounterOverlay!: Phaser.GameObjects.Container;
  private transitionOverlay!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Text;
  private spawn!: TiledObject;
  private encounters: TiledObject[] = [];
  private transitions: TiledObject[] = [];
  private navigationEdges: TiledObject[] = [];
  private currentEncounter: TiledObject | null = null;
  private currentTransition: TiledObject | null = null;
  private probePoints: Phaser.Math.Vector2[] = [];
  private probeIndex = 0;
  private probeName = 'NONE';
  private probeTarget = 'NONE';
  private probeSpeed = PROBE_SPEED;

  constructor() { super('ReinforcementFloor3DebugScene'); }

  preload() {
    this.load.json(MAP_JSON, MAP_URL);
    this.load.json(BLOCKOUT_TILESET_JSON, BLOCKOUT_TILESET_URL);
    this.load.json(FLOOR3_TILESET_JSON, FLOOR3_TILESET_URL);
    for (const assetId of BLOCKOUT_ASSET_IDS) this.load.image(assetId, `${BLOCKOUT_ASSET_ROOT}/${assetId}.png`);
    for (const assetId of ASSET_IDS) this.load.image(assetId, `${ASSET_ROOT}/${assetId}.png`);
  }

  create() {
    void this.initialize().catch(error => {
      console.error(error);
      this.game.events.emit('reinforcement-floor3-debug-error', error instanceof Error ? error.message : String(error));
    });
  }

  private async initialize() {
    const source = this.cache.json.get(MAP_JSON) as TiledMapJson | undefined;
    const blockoutTileset = this.cache.json.get(BLOCKOUT_TILESET_JSON) as ManualTileset | undefined;
    const floor3Tileset = this.cache.json.get(FLOOR3_TILESET_JSON) as ManualTileset | undefined;
    if (!source || !blockoutTileset || !floor3Tileset) throw new Error('Floor 3 debug: tilemap or tileset JSON failed to load');
    const data = validateFloor3Map(source);
    const map = await decompressTileLayers(source);
    const worldWidth = map.width * map.tilewidth;
    const worldHeight = map.height * map.tileheight;
    this.add.rectangle(worldWidth / 2, worldHeight / 2, worldWidth, worldHeight, 0x171c21).setDepth(-3);
    this.createTileLayers(map, new Map([[BLOCKOUT_TILESET_SOURCE, blockoutTileset], [FLOOR3_TILESET_SOURCE, floor3Tileset]]));
    this.createSourceColorOverlay();

    this.spawn = data.spawn;
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
    this.keys = this.input.keyboard!.addKeys('C,N,E,G,L,R,X,ONE,TWO') as typeof this.keys;
    this.input.keyboard!.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'C', 'N', 'E', 'G', 'L', 'R', 'X', 'ONE', 'TWO']);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setZoom(1.3).startFollow(this.robot, true, 1, 1);

    const background = this.add.rectangle(8, 8, 540, 280, 0x071018, 0.9).setOrigin(0).setScrollFactor(0).setDepth(20);
    background.setStrokeStyle(1, 0x7dd3fc, 0.7);
    this.hud = this.add.text(20, 18, '', { fontFamily: 'monospace', fontSize: '14px', color: '#e5f6ff', lineSpacing: 3 }).setScrollFactor(0).setDepth(21);
    this.refreshHud();
    this.game.events.on('reinforcement-floor3-run-route', this.startRouteProbe, this);
    this.game.events.on('reinforcement-floor3-toggle-overlay', this.handleOverlayRequest, this);
    this.game.events.on('reinforcement-floor3-run-stair', this.startStairProbe, this);
    this.game.events.on('reinforcement-floor3-run-room', this.startRoomProbe, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('reinforcement-floor3-run-route', this.startRouteProbe, this);
      this.game.events.off('reinforcement-floor3-toggle-overlay', this.handleOverlayRequest, this);
      this.game.events.off('reinforcement-floor3-run-stair', this.startStairProbe, this);
      this.game.events.off('reinforcement-floor3-run-room', this.startRoomProbe, this);
    });
    this.game.events.emit('reinforcement-floor3-debug-ready');
  }

  update(_time: number, delta: number) {
    if (!this.robot || !this.cursors) return;
    if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)) this.startRouteProbe('F3_LEFT_MAINTENANCE_ROUTE');
    if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)) this.startRouteProbe('F3_RIGHT_PERIMETER_ROUTE');
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
    if (Phaser.Input.Keyboard.JustDown(this.keys.L)) this.startStairProbe('LEFT');
    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.startStairProbe('RIGHT');
    if (Phaser.Input.Keyboard.JustDown(this.keys.G)) this.startRoomProbe();
    if (Phaser.Input.Keyboard.JustDown(this.keys.X)) this.resetRobot();

    this.currentEncounter = this.encounters.find(object => contains(object, this.robot.x, this.robot.y)) ?? null;
    this.currentTransition = this.transitions.find(object => contains(object, this.robot.x, this.robot.y)) ?? null;
    this.refreshHud();
  }

  private createTileLayers(map: TiledMapJson, tilesetsBySource: Map<string, ManualTileset>) {
    const tilesets = map.tilesets.map(reference => {
      const tileset = reference.source ? tilesetsBySource.get(reference.source) : undefined;
      if (!tileset) throw new Error(`Floor 3 debug: unsupported tileset ${reference.source ?? '(embedded)'}`);
      return { firstgid: reference.firstgid, source: reference.source, tileById: new Map((tileset.tiles ?? []).map(tile => [tile.id, tile])) };
    }).sort((left, right) => left.firstgid - right.firstgid);
    for (const name of TILE_LAYERS) {
      const layer = map.layers.find(candidate => candidate.name === name && candidate.type === 'tilelayer');
      if (!layer || !Array.isArray(layer.data)) throw new Error(`Floor 3 debug: tile layer "${name}" is unavailable`);
      layer.data.forEach((rawGid, cell) => {
        if (!rawGid) return;
        const gid = Phaser.Tilemaps.Parsers.Tiled.ParseGID(rawGid);
        let tileset = tilesets[0];
        for (const candidate of tilesets) if (candidate.firstgid <= gid.gid) tileset = candidate;
        const tile = tileset?.tileById.get(gid.gid - tileset.firstgid);
        if (!tile) throw new Error(`Floor 3 debug: tileset has no tile entry for gid ${gid.gid}`);
        const assetId = tile.class ?? tile.type;
        if (!assetId) throw new Error(`Floor 3 debug: tile gid ${gid.gid} has no Class`);
        if (!this.textures.exists(assetId)) {
          if (tileset.source === FLOOR3_TILESET_SOURCE) throw new Error(missingFloor3TextureMessage(assetId));
          throw new Error(`Floor 3 debug: blockout texture "${assetId}" is not loaded`);
        }
        const cellX = (cell % map.width) * map.tilewidth;
        const cellY = Math.floor(cell / map.width) * map.tileheight;
        this.add.image(cellX + tile.imagewidth / 2, cellY + map.tileheight - tile.imageheight / 2, assetId)
          .setRotation(gid.rotation).setFlipX(gid.flipped).setDepth(floor3TileDepth(name, tileset.source === FLOOR3_TILESET_SOURCE));
      });
    }
  }

  private createSourceColorOverlay() {
    const add = (x: number, y: number, width: number, height: number, color: number, alpha = 0.2) =>
      this.add.rectangle(x, y, width, height, color, alpha).setOrigin(0).setDepth(5);
    const blue: [number, number, number, number][] = [[576, 448, 128, 448], [576, 896, 352, 128], [800, 1024, 128, 128], [800, 1152, 224, 128]];
    const orange: [number, number, number, number][] = [[1536, 1152, 720, 128], [2112, 544, 144, 608], [1984, 384, 384, 160], [1792, 1088, 96, 64]];
    for (const rect of blue) add(...rect, 0x2789de);
    for (const rect of orange) add(...rect, 0xef4b00);
    add(1024, 1088, 512, 192, 0xf2ff00, 0.25);
    add(1632, 800, 384, 288, 0x00ff36, 0.32);
  }

  private createRobot() {
    const graphic = this.make.graphics({ x: 0, y: 0 }, false).fillStyle(0x29b6f6).fillCircle(12, 12, 12);
    graphic.generateTexture('reinforcement-floor3-debug-robot', 24, 24).destroy();
    this.robot = this.physics.add.sprite(this.spawn.x, this.spawn.y, 'reinforcement-floor3-debug-robot').setDepth(8).setCollideWorldBounds(true);
    this.robot.body!.setSize(24, 24);
  }

  private createCollision(objects: TiledObject[]) {
    const texture = this.make.graphics({ x: 0, y: 0 }, false);
    texture.fillStyle(0xffffff).fillRect(0, 0, 1, 1).generateTexture('reinforcement-floor3-debug-collider', 1, 1).destroy();
    const group = this.physics.add.staticGroup();
    const graphics = this.add.graphics().setDepth(10).lineStyle(1, 0xff5252, 0.85).fillStyle(0xff1744, 0.08);
    for (const object of objects) {
      const bounds = axisAlignedBounds(object);
      const collider = group.create(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, 'reinforcement-floor3-debug-collider') as Phaser.Physics.Arcade.Image;
      collider.setDisplaySize(bounds.width, bounds.height).refreshBody().setVisible(false);
      graphics.fillRect(bounds.x, bounds.y, bounds.width, bounds.height).strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    this.physics.add.collider(this.robot, group);
    const room = objects.find(object => object.name === 'F3_GREEN_FACILITY_ROOM')!;
    this.collisionOverlay = this.add.container(0, 0, [graphics, this.debugLabel(room.x + 4, room.y + 4, room.name, '#ff8a80')]).setDepth(10).setVisible(false);
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

  private resetRobot() {
    this.robot.setPosition(this.spawn.x, this.spawn.y).setVelocity(0, 0);
    this.currentEncounter = null;
    this.currentTransition = null;
    this.probePoints = [];
    this.probeName = 'NONE';
  }

  private startRouteProbe(route: Floor3RouteId) {
    this.probePoints = floor3RoutePoints(this.navigationEdges, route).map(point => new Phaser.Math.Vector2(point.x, point.y));
    this.probeIndex = 1;
    this.probeName = route;
    this.probeTarget = route === 'F3_LEFT_MAINTENANCE_ROUTE' ? 'F3_LEFT_STAIR' : 'F3_RIGHT_STAIR';
    this.probeSpeed = PROBE_SPEED;
    this.robot.setPosition(this.probePoints[0].x, this.probePoints[0].y).setVelocity(0, 0);
    this.game.events.emit('reinforcement-floor3-route-probe-start', route);
  }

  private startStairProbe(side: Floor3StairSide) {
    const edge = this.navigationEdges.find(item => properties(item).edgeId === `E_F3_${side}_C`)!;
    this.probePoints = (edge.polyline ?? []).map(point => new Phaser.Math.Vector2(edge.x + point.x, edge.y + point.y));
    this.probeIndex = 1;
    this.probeName = `F3_${side}_GUARD_STAIR_PASS`;
    this.probeTarget = `F3_${side}_STAIR`;
    this.probeSpeed = PROBE_SPEED;
    this.robot.setPosition(this.probePoints[0].x, this.probePoints[0].y).setVelocity(0, 0);
    this.game.events.emit('reinforcement-floor3-route-probe-start', this.probeName);
  }

  private startRoomProbe() {
    this.probePoints = [new Phaser.Math.Vector2(1824, 1120), new Phaser.Math.Vector2(1824, 960)];
    this.probeIndex = 1;
    this.probeName = 'F3_GREEN_ROOM_BLOCK_PROBE';
    this.probeTarget = 'F3_GREEN_FACILITY_ROOM';
    this.probeSpeed = SPEED;
    this.robot.setPosition(1824, 1120).setVelocity(0, 0);
    this.game.events.emit('reinforcement-floor3-route-probe-start', this.probeName);
  }

  private handleOverlayRequest(overlay: 'Collision' | 'Navigation' | 'Encounters') {
    const target = overlay === 'Collision' ? this.collisionOverlay : overlay === 'Navigation' ? this.navigationOverlay : this.encounterOverlay;
    target.setVisible(!target.visible);
    if (overlay === 'Encounters') this.transitionOverlay.setVisible(target.visible);
    this.game.events.emit('reinforcement-floor3-overlay-changed', overlay, target.visible);
  }

  private followRouteProbe(delta: number) {
    const target = this.probePoints[this.probeIndex];
    if (!target) {
      const route = this.probeName;
      this.probePoints = [];
      this.probeName = `${route}:PASS`;
      this.robot.setVelocity(0, 0);
      this.game.events.emit('reinforcement-floor3-route-probe-complete', route, this.probeTarget);
      return;
    }
    const body = this.robot.body as Phaser.Physics.Arcade.Body;
    if (this.probeName === 'F3_GREEN_ROOM_BLOCK_PROBE' && body.blocked.up) {
      const probe = this.probeName;
      this.probePoints = [];
      this.probeName = `${probe}:PASS`;
      this.robot.setVelocity(0, 0);
      this.game.events.emit('reinforcement-floor3-route-probe-blocked', probe);
      return;
    }
    const direction = target.clone().subtract(this.robot);
    if (direction.length() <= this.probeSpeed * delta / 1000 + 2) {
      this.robot.setPosition(target.x, target.y);
      this.probeIndex += 1;
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
      'Floor: 3 · FACILITY / SPLIT · BLOCKOUT',
      `Position: ${this.robot.x.toFixed(1)}, ${this.robot.y.toFixed(1)}`,
      `Tile: ${Math.floor(this.robot.x / 32)}, ${Math.floor(this.robot.y / 32)}`,
      `Encounter: ${this.currentEncounter?.name ?? 'NONE'}`,
      this.currentEncounter ? `  type=${encounterValues.encounterType} bypass=${encounterValues.bypassAvailable ?? 'n/a'}` : '',
      `Transition: ${this.currentTransition?.name ?? 'NONE'}`,
      this.currentTransition ? `  targetFloor=${transitionValues.targetFloor} targetSpawn=${transitionValues.targetSpawn}` : '',
      `Collision [C]: ${this.collisionOverlay.visible ? 'ON' : 'OFF'} · Navigation [N]: ${this.navigationOverlay.visible ? 'ON' : 'OFF'}`,
      `Encounters [E]: ${this.encounterOverlay.visible ? 'ON' : 'OFF'} · Probe: ${this.probeName}`,
      'Auto: [1] LEFT maintenance · [2] RIGHT perimeter',
      'Stair: [L] LEFT · [R] RIGHT · Room block: [G] · Reset: [X]',
      'Move: Arrow Keys',
    ].filter(Boolean));
  }
}
