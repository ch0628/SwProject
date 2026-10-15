import * as Phaser from 'phaser';
import { BuildingTransitionGate } from '../debug/buildingTransitions.ts';
import type { F5Room } from '../sim/actualMapEnvironment.ts';
import {
  TILE_LAYERS,
  axisAlignedBounds,
  decompressTileLayers,
  properties,
  type TiledMapJson,
  type TiledObject,
} from '../debug/floor1Tiled.ts';
import { RUNTIME_ASSETS, RUNTIME_VISUAL_CONFIG } from './runtimeAssets.ts';
import {
  applyRuntimeCommand,
  directionForSegment,
  directionTowardTarget,
  initialRuntimePlaybackState,
  RUNTIME_CONTACT_FOOTPRINTS,
  type RuntimeCommand,
  type RuntimeDirection,
  type RuntimePlaybackState,
  type RuntimePoint,
} from './runtimeCommands.ts';
import {
  applyRuntimePresentationCommand,
  createRuntimePresentation,
  entitiesForFloor,
  presentationMotionForCommand,
  resolveRuntimePublicPath,
  setRuntimeCoreState,
  type RuntimePresentationState,
  type RuntimePresentedEntity,
} from './runtimePresentation.ts';
import {
  movementPathIsClear,
  planLocalBypass,
  planLocalRetreat,
  planDistractMovement,
  planLocalMovement,
  projectRouteProgress,
  runtimeVisualFootprint,
  type RuntimeRect,
  type RuntimeRouteCursor,
} from './runtimeMovement.ts';
import {
  planSecureEntrance,
  RUNTIME_ENVIRONMENT_VISUAL_CONFIG,
  runtimeRobotEncounterState,
  runtimeRobotTexture,
  runtimeSearchDoorTexture,
  type RuntimeRobotVisualState,
} from './runtimeVisualConfig.ts';

type ManualTile = { id: number; class?: string; type?: string; image: string; imagewidth: number; imageheight: number };
type ManualTileset = { tiles?: ManualTile[] };
type LoadedTileset = { firstgid: number; source: string; manual: boolean; tiles: Map<number, ManualTile & { texture: string }> };

export type RuntimeSceneOptions = {
  maps: TiledMapJson[];
  commands: RuntimeCommand[];
  waitForStart?: boolean;
  runtimeSyncDebug?: boolean;
  runtimeIdentity?: Record<string, unknown>;
};

const MAP_URLS = Array.from({ length: 5 }, (_, index) => `/maps/reinforcement/floor_${index + 1}_blockout.tmj`);
const LAYER_DEPTHS: Record<(typeof TILE_LAYERS)[number], number> = { Ground: 0, FloorDetail: 1, Walls: 2, StaticProps: 3, WallTop: 5 };
const EVENT_DELAY = 420;

export class ReinforcementRuntimeScene extends Phaser.Scene {
  private maps: TiledMapJson[];
  private commands: RuntimeCommand[];
  private tilesets = new Map<number, LoadedTileset[]>();
  private floorObjects: Phaser.GameObjects.GameObject[] = [];
  private permanentGroup?: Phaser.Physics.Arcade.StaticGroup;
  private permanentCollider?: Phaser.Physics.Arcade.Collider;
  private robot?: Phaser.Physics.Arcade.Sprite;
  private floor = 1;
  private cursor = 0;
  private paused = false;
  private started: boolean;
  private terminal = false;
  private terminalEmitted = false;
  private robotDisabled = false;
  private runtimeSyncDebug: boolean;
  private runtimeIdentity: Record<string, unknown>;
  private completedCommandIds = new Set<number>();
  private playbackState: RuntimePlaybackState = initialRuntimePlaybackState();
  private presentationBusy = false;
  private movementPlaybackSpeed = 1;
  private eventPlaybackSpeed = 1;
  private nextCommandAt = 0;
  private move?: {
    command: Extract<RuntimeCommand, { type: 'MOVE' }>;
    points: RuntimePoint[];
    macroPoints: RuntimePoint[];
    progressBase: number;
    index: number;
    lastDistance: number;
    stalledMs: number;
  };
  private routeCursor: RuntimeRouteCursor = { segment: 0, progress: 0, worldPosition: { x: 0, y: 0 } };
  private presentation: RuntimePresentationState;
  private entities = new Map<string, Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Image>();
  private doors = new Map<string, { visual: Phaser.GameObjects.Image; collider: Phaser.Physics.Arcade.Image }>();
  private securityLock?: {
    collider: Phaser.Physics.Arcade.Image;
    left: Phaser.GameObjects.Image;
    centers: Phaser.GameObjects.Image[];
    right: Phaser.GameObjects.Image;
  };
  private robotVisualState: RuntimeRobotVisualState = 'NORMAL';
  private cores: Array<{
    visual: Phaser.GameObjects.Image;
    offTexture: string;
    displayWidth: number;
    displayHeight: number;
    originX: number;
    originY: number;
    depth: number;
  }> = [];
  private lastDirection: RuntimeDirection = 'DOWN';
  private transitionGate = new BuildingTransitionGate();

  constructor(options: RuntimeSceneOptions) {
    super('ReinforcementRuntimeScene');
    this.maps = options.maps;
    this.commands = options.commands;
    this.started = !options.waitForStart;
    this.runtimeSyncDebug = options.runtimeSyncDebug ?? false;
    this.runtimeIdentity = options.runtimeIdentity ?? {};
    this.presentation = createRuntimePresentation(options.commands, options.maps);
    for (const command of this.commands) this.traceCommand('CREATED', command);
  }

  preload() {
    const loadImage = (key: string, url: string) => { if (!this.textures.exists(key)) this.load.image(key, url); };
    for (const direction of ['UP', 'DOWN', 'LEFT', 'RIGHT'] as const) {
      loadImage(`runtime-robot-idle-${direction}`, RUNTIME_ASSETS.ROBOT.idle[direction]);
      RUNTIME_ASSETS.ROBOT.walk[direction].forEach((url, index) => loadImage(`runtime-robot-walk-${direction}-${index}`, url));
      loadImage(`runtime-robot-combat-${direction}`, RUNTIME_ASSETS.ROBOT.combat[direction]);
      loadImage(`runtime-robot-work-${direction}`, RUNTIME_ASSETS.ROBOT.work[direction]);
      loadImage(`runtime-robot-neutralized-${direction}`, RUNTIME_ASSETS.ROBOT.neutralized[direction]);
      loadImage(`runtime-citizen-${direction}`, RUNTIME_ASSETS.CITIZEN[direction]);
      loadImage(`runtime-ambiguous-${direction}`, RUNTIME_ASSETS.AMBIGUOUS_PERSON[direction]);
      loadImage(`runtime-boss-${direction}`, RUNTIME_ASSETS.BOSS.idle[direction]);
    }
    loadImage('runtime-boss-neutralized', RUNTIME_ASSETS.BOSS.neutralized);
    RUNTIME_ASSETS.VILLAIN.forEach((variant, index) => {
      for (const direction of ['UP', 'DOWN', 'LEFT', 'RIGHT'] as const) loadImage(`runtime-villain-${index + 1}-${direction}`, variant.idle[direction]);
      loadImage(`runtime-villain-${index + 1}-neutralized`, variant.neutralized);
    });
    Object.entries(RUNTIME_ASSETS.OBSTACLE).forEach(([key, url]) => loadImage(`runtime-obstacle-${key}`, url));
    loadImage('runtime-door-closed', RUNTIME_ASSETS.F5_SEARCH_DOOR.CLOSED);
    loadImage('runtime-door-open', RUNTIME_ASSETS.F5_SEARCH_DOOR.OPEN);
    loadImage('runtime-secure-left', RUNTIME_ASSETS.F5_SECURE_ENTRANCE.LEFT);
    loadImage('runtime-secure-glass', RUNTIME_ASSETS.F5_SECURE_ENTRANCE.CENTER);
    loadImage('runtime-secure-right', RUNTIME_ASSETS.F5_SECURE_ENTRANCE.RIGHT);
    loadImage('runtime-secure-left-open', RUNTIME_ASSETS.F5_SECURE_ENTRANCE.LEFT_OPEN);
    loadImage('runtime-secure-right-open', RUNTIME_ASSETS.F5_SECURE_ENTRANCE.RIGHT_OPEN);
    loadImage('runtime-core-on', RUNTIME_ASSETS.F5_CORE.ON);
  }

  create() {
    this.createAnimations();
    this.game.events.on('reinforcement-runtime-pause', this.setPaused, this);
    this.game.events.on('reinforcement-runtime-speed', this.setPlaybackSpeed, this);
    this.game.events.on('reinforcement-runtime-start', this.startPlayback, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('reinforcement-runtime-pause', this.setPaused, this);
      this.game.events.off('reinforcement-runtime-speed', this.setPlaybackSpeed, this);
      this.game.events.off('reinforcement-runtime-start', this.startPlayback, this);
    });
    void this.initialize().catch(error => {
      console.error(error);
      this.game.events.emit('reinforcement-runtime-error', error instanceof Error ? error.message : String(error));
    });
  }

  update(time: number, delta: number) {
    if (!this.started || this.paused || this.terminal || this.presentationBusy || !this.robot) {
      this.robot?.setVelocity(0, 0);
      return;
    }
    if (this.move) {
      this.advanceMove(delta);
      return;
    }
    if (time < this.nextCommandAt) return;
    const command = this.commands[this.cursor++];
    if (!command) return;
    this.execute(command, time);
  }

  private async initialize() {
    await this.loadTilesets();
    await this.renderFloor(1, 'F1_ROBOT_SPAWN');
    this.game.events.emit('reinforcement-runtime-ready');
  }

  private createAnimations() {
    for (const direction of ['UP', 'DOWN', 'LEFT', 'RIGHT'] as const) {
      const key = `runtime-robot-walk-${direction}`;
      if (!this.anims.exists(key)) this.anims.create({
        key,
        frames: RUNTIME_ASSETS.ROBOT.walk[direction].map((_url, index) => ({ key: `${key}-${index}` })),
        frameRate: RUNTIME_VISUAL_CONFIG.animationFps,
        repeat: -1,
      });
    }
  }

  private async loadTilesets() {
    const queued = new Map<string, { texture: string; source: string }>();
    const sources = new Map<string, string>();
    let textureIndex = 0;
    for (const [mapIndex, map] of this.maps.entries()) {
      const loaded: LoadedTileset[] = [];
      for (const [tilesetIndex, reference] of map.tilesets.entries()) {
        if (!reference.source) throw new Error(`Floor ${mapIndex + 1}: embedded tilesets are unsupported`);
        const tilesetPath = resolveRuntimePublicPath(reference.source, MAP_URLS[mapIndex]);
        const response = await fetch(tilesetPath);
        if (!response.ok) throw new Error(`Floor ${mapIndex + 1}: failed to load ${tilesetPath}`);
        const source = await response.json() as ManualTileset;
        const tiles = new Map<number, ManualTile & { texture: string }>();
        for (const tile of source.tiles ?? []) {
          const imagePath = resolveRuntimePublicPath(tile.image, tilesetPath);
          let entry = queued.get(imagePath);
          if (!entry) {
            entry = { texture: `runtime-tile-${textureIndex++}`, source: `${reference.source}#tile-${tile.id}` };
            queued.set(imagePath, entry);
            sources.set(entry.texture, `${entry.source} -> ${imagePath}`);
            this.load.image(entry.texture, imagePath);
          }
          tiles.set(tile.id, { ...tile, texture: entry.texture });
        }
        loaded.push({ firstgid: reference.firstgid, source: reference.source, manual: tilesetIndex > 0 || map.tilesets.length === 1, tiles });
      }
      this.tilesets.set(mapIndex + 1, loaded.sort((left, right) => left.firstgid - right.firstgid));
    }
    if (!queued.size) return;
    await new Promise<void>((resolve, reject) => {
      const failed = (file: Phaser.Loader.File) => reject(new Error(`Runtime tile ${file.key} failed to load: ${sources.get(String(file.key)) ?? file.url}`));
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, failed);
      this.load.start();
    });
  }

  private clearFloor() {
    this.tweens.killAll();
    this.permanentCollider?.destroy();
    this.permanentGroup?.clear(true, true);
    this.permanentGroup = undefined;
    for (const object of this.floorObjects) object.destroy();
    this.floorObjects = [];
    this.entities.clear();
    this.doors.clear();
    this.securityLock = undefined;
    this.cores = [];
    this.robot?.destroy();
    this.robot = undefined;
  }

  private async renderFloor(floor: number, spawnId: string) {
    this.clearFloor();
    this.floor = floor;
    const source = this.maps[floor - 1];
    const map = await decompressTileLayers(source);
    const worldWidth = map.width * map.tilewidth;
    const worldHeight = map.height * map.tileheight;
    this.floorObjects.push(this.add.rectangle(worldWidth / 2, worldHeight / 2, worldWidth, worldHeight, 0x101820).setDepth(-5));
    const tilesets = this.tilesets.get(floor)!;
    const coreCandidates: Phaser.GameObjects.Image[] = [];
    for (const name of TILE_LAYERS) {
      const layer = map.layers.find(candidate => candidate.name === name && candidate.type === 'tilelayer');
      if (!layer || !Array.isArray(layer.data)) throw new Error(`Floor ${floor}: tile layer ${name} is unavailable`);
      layer.data.forEach((rawGid, cell) => {
        if (!rawGid) return;
        const gid = Phaser.Tilemaps.Parsers.Tiled.ParseGID(rawGid);
        let tileset = tilesets[0];
        for (const candidate of tilesets) if (candidate.firstgid <= gid.gid) tileset = candidate;
        const tile = tileset.tiles.get(gid.gid - tileset.firstgid);
        if (!tile) throw new Error(`Floor ${floor}: tile gid ${gid.gid} is missing`);
        const cellX = (cell % map.width) * map.tilewidth;
        const cellY = Math.floor(cell / map.width) * map.tileheight;
        const visual = this.add.image(cellX + tile.imagewidth / 2, cellY + map.tileheight - tile.imageheight / 2, tile.texture)
          .setRotation(gid.rotation).setFlipX(gid.flipped).setAlpha(layer.opacity ?? 1)
          .setDepth(LAYER_DEPTHS[name] + (tileset.manual && map.tilesets.length > 1 ? 6 : 0));
        this.floorObjects.push(visual);
        if (floor === 5 && tile.type === 'F5_CORE') coreCandidates.push(visual);
      });
    }

    const objects = (name: string) => map.layers.find(layer => layer.name === name)?.objects ?? [];
    if (floor === 5) {
      if (coreCandidates.length !== 3) throw new Error(`Floor 5: expected 3 Core visuals, found ${coreCandidates.length}`);
      this.cores = coreCandidates.map(visual => ({
        visual,
        offTexture: visual.texture.key,
        displayWidth: visual.displayWidth,
        displayHeight: visual.displayHeight,
        originX: visual.originX,
        originY: visual.originY,
        depth: visual.depth,
      }));
      this.showPoweredCore(this.presentation.coreState === 'CORE_ON');
    }
    const spawn = objects('SpawnPoints').find(object => properties(object).spawnId === spawnId) ?? objects('SpawnPoints')[0];
    if (!spawn) throw new Error(`Floor ${floor}: spawn ${spawnId} is missing`);
    this.createRobot(spawn.x, spawn.y);
    this.routeCursor = { ...this.routeCursor, edgeId: undefined, segment: 0, worldPosition: { x: spawn.x, y: spawn.y } };
    this.createCollision(objects('Collision'));
    if (floor === 5) this.createF5Gates(objects('Collision'));
    this.restoreFloorEntities(floor);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight).setZoom(1.05).startFollow(this.robot!, true, 0.12, 0.12);
    this.emitStatus(`F${floor} START`, 0);
  }

  private createRobot(x: number, y: number) {
    this.robot = this.physics.add.sprite(x, y, 'runtime-robot-idle-DOWN').setOrigin(0.5, 1).setDepth(20).setCollideWorldBounds(true);
    this.scaleSprite(this.robot, RUNTIME_VISUAL_CONFIG.robotDisplayHeight);
    const body = this.robot.body as Phaser.Physics.Arcade.Body;
    body.setSize(RUNTIME_VISUAL_CONFIG.robotFootprint.width / this.robot.scaleX, RUNTIME_VISUAL_CONFIG.robotFootprint.height / this.robot.scaleY);
    body.setOffset((this.robot.width - body.width) / 2, this.robot.height - body.height);
  }

  private createCollision(objects: TiledObject[]) {
    if (!this.textures.exists('runtime-collider')) {
      this.make.graphics({ x: 0, y: 0 }, false).fillStyle(0xffffff).fillRect(0, 0, 1, 1).generateTexture('runtime-collider', 1, 1).destroy();
    }
    this.permanentGroup = this.physics.add.staticGroup();
    for (const object of objects) {
      const values = properties(object);
      if (values.blocksRobot === false || values.dynamicDoor === true || values.dynamicLock === true || object.width <= 0 || object.height <= 0) continue;
      const bounds = axisAlignedBounds(object);
      const collider = this.permanentGroup.create(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, 'runtime-collider') as Phaser.Physics.Arcade.Image;
      collider.setDisplaySize(bounds.width, bounds.height).setVisible(false).refreshBody();
    }
    this.permanentCollider = this.physics.add.collider(this.robot!, this.permanentGroup);
  }

  private createF5Gates(objects: TiledObject[]) {
    for (const object of objects) {
      const values = properties(object);
      if (values.dynamicDoor !== true && values.dynamicLock !== true) continue;
      const bounds = axisAlignedBounds(object);
      const isLock = values.dynamicLock === true;
      const collider = this.physics.add.staticImage(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, 'runtime-collider').setVisible(false);
      collider.setDisplaySize(bounds.width, bounds.height).refreshBody();
      this.physics.add.collider(this.robot!, collider);
      if (isLock) {
        const architecture = planSecureEntrance(bounds).map(tile => this.add.image(tile.x, tile.y, tile.texture)
          .setOrigin(0.5, 1).setDisplaySize(tile.width, tile.height).setDepth(18));
        this.floorObjects.push(...architecture, collider);
        this.securityLock = {
          collider,
          left: architecture[0],
          centers: architecture.slice(1, -1),
          right: architecture.at(-1)!,
        };
        if (this.presentation.securityLockOpen) this.showSecurityEntranceOpen();
      } else {
        const size = RUNTIME_ENVIRONMENT_VISUAL_CONFIG.searchDoor;
        const visual = this.add.image(bounds.x + bounds.width / 2, bounds.y + bounds.height, runtimeSearchDoorTexture(false))
          .setOrigin(0.5, 1).setDisplaySize(size.width, size.height).setDepth(18);
        this.floorObjects.push(visual, collider);
        const room = String(values.roomId);
        this.doors.set(room, { visual, collider });
        if (this.presentation.openDoors.some(openRoom => openRoom === room)) {
          visual.setTexture(runtimeSearchDoorTexture(true));
          collider.body!.enable = false;
        }
      }
    }
  }

  private execute(command: RuntimeCommand, time: number) {
    this.traceCommand('STARTED', command);
    this.emitStatus(this.describe(command), command.simulationTime, command);
    if (command.type === 'MOVE') {
      const current = { x: this.robot!.x, y: this.robot!.y };
      const map = this.maps[command.floor - 1];
      const bounds = { x: 0, y: 0, width: map.width * map.tilewidth, height: map.height * map.tileheight };
      const plan = planLocalMovement(command.points, current, bounds, this.movementWalls(command.floor), this.movementBlockers(command.floor));
      if (!plan.valid) {
        const target = 'invalidTarget' in plan ? plan.invalidTarget : command.points.at(-1);
        this.traceCommand('INVALID_MOVE_TARGET', command, { target, ...this.collisionAudit(command, current) });
        this.failRuntime(new Error(`Runtime MOVE ${command.commandId ?? '?'} has no collision-free path`));
        return;
      }
      const progressBase = this.routeCursor.progress;
      this.routeCursor = {
        edgeId: command.edgeIds[0],
        segment: plan.segment,
        progress: progressBase,
        worldPosition: current,
      };
      this.move = { command, points: plan.points, macroPoints: command.points, progressBase, index: 1, lastDistance: Number.POSITIVE_INFINITY, stalledMs: 0 };
      return;
    }
    if (command.type === 'ENCOUNTER' && this.handleEncounter(command)) return;
    if (command.type === 'ACTION') {
      this.faceEncounter(command.zoneId);
      if (command.action === 'SUBDUE') {
        this.presentationBusy = true;
        const repetitions = command.state === 'BOSS_ENCOUNTER' ? 2 : 1;
        void this.animateSubdueAttempt(command.zoneId, repetitions).then(() => {
          this.presentationBusy = false;
          this.nextCommandAt = this.time.now;
          this.completeCommand(command);
        }).catch(error => this.failRuntime(error));
        return;
      }
      if (command.state === 'OBSTACLE' && (command.action === 'PUSH' || command.action === 'CLEAR')) this.setRobotVisualState('WORK');
    }
    if (command.type === 'OUTCOME' && this.handleOutcomeFeedback(command)) return;
    if (command.type === 'LOCAL_RETREAT' || command.type === 'LOCAL_BYPASS') {
      this.presentationBusy = true;
      void this.animateLocalMotion(command).then(() => {
        this.presentationBusy = false;
        this.nextCommandAt = this.time.now;
        this.completeCommand(command);
      }).catch(error => this.failRuntime(error));
      return;
    }
    if (command.type === 'STATE_CHANGE' && this.handleStateChange(command)) return;
    if (command.type === 'FLOOR_TRANSITION') {
      this.presentationBusy = true;
      void this.transitionFloor(command).then(() => {
        this.presentationBusy = false;
        this.completeCommand(command);
      }).catch(error => this.failRuntime(error));
      return;
    }
    if (command.type === 'TERMINAL') {
      this.applyTerminal(command);
      this.completeCommand(command);
      return;
    }
    this.completeCommand(command);
    this.nextCommandAt = time + EVENT_DELAY / this.eventPlaybackSpeed;
  }

  private advanceMove(delta: number) {
    if (!this.move || !this.robot) return;
    const target = this.move.points[this.move.index];
    if (!target) {
      this.robot.setVelocity(0, 0).anims.stop();
      this.showRobotVisual();
      const total = projectRouteProgress(this.move.macroPoints, this.move.macroPoints.at(-1)!).total;
      this.routeCursor.progress = Math.max(this.routeCursor.progress, this.move.progressBase + total);
      this.routeCursor.worldPosition = { x: this.robot.x, y: this.robot.y };
      this.completeCommand(this.move.command);
      this.move = undefined;
      this.nextCommandAt = this.time.now + 80 / this.movementPlaybackSpeed;
      return;
    }
    const from = { x: this.robot.x, y: this.robot.y };
    this.lastDirection = directionForSegment(from, target);
    if (this.robotVisualState === 'NORMAL') this.robot.play(`runtime-robot-walk-${this.lastDirection}`, true);
    else this.showRobotVisual();
    const distance = RUNTIME_VISUAL_CONFIG.movementPixelsPerSecond * this.movementPlaybackSpeed * delta / 1000;
    const remaining = Phaser.Math.Distance.Between(from.x, from.y, target.x, target.y);
    this.move.stalledMs = remaining + 0.1 < this.move.lastDistance ? 0 : this.move.stalledMs + delta;
    this.move.lastDistance = remaining;
    if (this.move.stalledMs >= 750) {
      this.traceCommand('STUCK', this.move.command, { target, remaining });
      this.failRuntime(new Error(`Runtime MOVE ${this.move.command.commandId ?? '?'} made no progress`));
      return;
    }
    if (remaining <= distance + 1) {
      this.robot.setPosition(target.x, target.y).setVelocity(0, 0);
      this.move.index++;
      this.move.stalledMs = 0;
      this.move.lastDistance = Number.POSITIVE_INFINITY;
    } else {
      const direction = new Phaser.Math.Vector2(target.x - from.x, target.y - from.y).normalize().scale(RUNTIME_VISUAL_CONFIG.movementPixelsPerSecond * this.movementPlaybackSpeed);
      this.robot.setVelocity(0, 0).setPosition(from.x + direction.x * delta / 1000, from.y + direction.y * delta / 1000);
    }
    const position = { x: this.robot.x, y: this.robot.y };
    const projection = projectRouteProgress(this.move.macroPoints, position);
    this.routeCursor.segment = projection.segment;
    this.routeCursor.progress = Math.max(this.routeCursor.progress, this.move.progressBase + projection.progress);
    this.routeCursor.worldPosition = position;
    this.robot.setDepth(this.robot.y + 20);
  }

  private movementWalls(floor: number): RuntimeRect[] {
    const objects = this.maps[floor - 1].layers.find(layer => layer.name === 'Collision')?.objects ?? [];
    return objects.filter(object => {
      const values = properties(object);
      if (values.blocksRobot === false || object.width <= 0 || object.height <= 0) return false;
      if (values.dynamicLock === true) return !this.presentation.securityLockOpen;
      if (values.dynamicDoor === true) return !this.presentation.openDoors.includes(String(values.roomId) as F5Room);
      return true;
    }).map(axisAlignedBounds);
  }

  private movementBlockers(floor: number) {
    return entitiesForFloor(this.presentation, floor).filter(entity => entity.blocking).map(entity => ({
      id: entity.id,
      point: entity.position,
      footprint: runtimeVisualFootprint(entity.kind),
    }));
  }

  private collisionAudit(command: Extract<RuntimeCommand, { type: 'MOVE' }>, current: RuntimePoint) {
    const map = this.maps[command.floor - 1];
    const bounds = { x: 0, y: 0, width: map.width * map.tilewidth, height: map.height * map.tileheight };
    const route = [current, ...command.points];
    const footprint = runtimeVisualFootprint('ROBOT');
    const activeWalls = (map.layers.find(layer => layer.name === 'Collision')?.objects ?? []).filter(object => {
      const values = properties(object);
      if (values.blocksRobot === false || object.width <= 0 || object.height <= 0) return false;
      if (values.dynamicLock === true) return !this.presentation.securityLockOpen;
      if (values.dynamicDoor === true) return !this.presentation.openDoors.includes(String(values.roomId) as F5Room);
      return true;
    }).map((object, index) => ({
      id: object.name || `collision-${index}`,
      bounds: axisAlignedBounds(object),
      dynamic: properties(object).dynamicDoor === true || properties(object).dynamicLock === true,
    }));
    const blockers = this.movementBlockers(command.floor);
    const intersectsWall = (wall: RuntimeRect) => !movementPathIsClear(route, footprint, bounds, [wall]);
    const intersectsBlocker = (blocker: (typeof blockers)[number]) => !movementPathIsClear(route, footprint, bounds, [], [blocker]);
    const entities = entitiesForFloor(this.presentation, command.floor);
    const staticCollisionIntersections = activeWalls.filter(wall => !wall.dynamic && intersectsWall(wall.bounds)).map(wall => wall.id);
    const dynamicCollisionIntersections = activeWalls.filter(wall => wall.dynamic && intersectsWall(wall.bounds)).map(wall => wall.id);
    const entityCollisionIntersections = blockers.filter(intersectsBlocker).map(blocker => blocker.id);
    const whyNoCollisionFreePath = dynamicCollisionIntersections.length
      ? `closed runtime gate intersects route: ${dynamicCollisionIntersections.join(', ')}`
      : entityCollisionIntersections.length
        ? `active blocking entity intersects route: ${entityCollisionIntersections.join(', ')}`
        : staticCollisionIntersections.length
          ? `static collision intersects runtime source-to-target route: ${staticCollisionIntersections.join(', ')}`
          : 'runtime source is outside the canonical route or no in-bounds deterministic detour exists';
    return {
      WHY_NO_COLLISION_FREE_PATH: whyNoCollisionFreePath,
      staticCollisionIntersections,
      dynamicCollisionIntersections,
      entityCollisionIntersections,
      doorState: { openRooms: this.presentation.openDoors, securityLockOpen: this.presentation.securityLockOpen },
      enemyPositions: entities.filter(entity => entity.kind === 'VILLAIN' || entity.kind === 'GUARD' || entity.kind === 'BOSS')
        .map(entity => ({ id: entity.id, kind: entity.kind, position: entity.position, blocking: entity.blocking, visualState: entity.visualState })),
      obstaclePositions: entities.filter(entity => entity.kind === 'OBSTACLE')
        .map(entity => ({ id: entity.id, position: entity.position, blocking: entity.blocking })),
    };
  }

  private handleEncounter(command: Extract<RuntimeCommand, { type: 'ENCOUNTER' }>) {
    this.setRobotVisualState(runtimeRobotEncounterState(command.phase, command.encounter));
    if (command.phase === 'START') {
      this.restoreFloorEntities(command.floor);
      this.faceEncounter(command.zoneId, command.position);
      this.presentationBusy = true;
      void this.animateEncounterFocus(command).then(() => {
        this.presentationBusy = false;
        this.nextCommandAt = this.time.now;
        this.completeCommand(command);
      }).catch(error => this.failRuntime(error));
      return true;
    }
    return false;
  }

  private handleOutcomeFeedback(command: Extract<RuntimeCommand, { type: 'OUTCOME' }>) {
    const isCitizen = command.state === 'CITIZEN_NEARBY'
      || (command.state === 'AMBIGUOUS_PERSON' && (command.outcome.includes('CITIZEN') || command.events.some(event => event.includes('CITIZEN'))));
    const isVillain = command.state === 'AMBIGUOUS_PERSON'
      && (command.outcome.includes('VILLAIN') || command.events.some(event => event.includes('VILLAIN')));
    if (!isCitizen && !isVillain) return false;
    this.presentationBusy = true;
    const target = this.encounterPosition(command.zoneId) ?? (this.robot ? { x: this.robot.x, y: this.robot.y - 30 } : { x: 0, y: 0 });
    void this.showWorldCallout(isCitizen ? '시민이에요!' : '악당이에요!', target, isCitizen ? 0x69a879 : 0xc9685d, 520).then(() => {
      this.presentationBusy = false;
      this.nextCommandAt = this.time.now;
      this.completeCommand(command);
    }).catch(error => this.failRuntime(error));
    return true;
  }

  private faceEncounter(zoneId: string, fallback?: RuntimePoint) {
    if (!this.robot) return;
    const target = this.encounterPosition(zoneId) ?? fallback;
    if (!target) return;
    this.lastDirection = directionTowardTarget({ x: this.robot.x, y: this.robot.y }, target, this.lastDirection);
    this.showRobotVisual();
  }

  private encounterPosition(zoneId: string): RuntimePoint | undefined {
    return Object.values(this.presentation.entities).find(entity => entity.zoneId === zoneId && entity.visible)?.position;
  }

  private reducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  private async animateEncounterFocus(command: Extract<RuntimeCommand, { type: 'ENCOUNTER' }>) {
    const target = this.encounterPosition(command.zoneId) ?? command.position;
    const color = command.encounter === 'CITIZEN_NEARBY' ? 0x69a879
      : command.encounter === 'AMBIGUOUS_PERSON' ? 0xe0aa3e : 0xc9685d;
    const indicator = this.add.circle(target.x, target.y - 18, 21, color, 0.08)
      .setStrokeStyle(3, color, 0.9).setDepth(target.y + 60);
    const question = command.encounter === 'AMBIGUOUS_PERSON'
      ? this.add.text(target.x, target.y - 62, '?', { color: '#5b4620', backgroundColor: '#fff4c7', fontFamily: 'sans-serif', fontSize: '22px', fontStyle: 'bold', padding: { x: 8, y: 3 } })
        .setOrigin(0.5).setDepth(target.y + 61)
      : undefined;
    if (!this.reducedMotion()) this.tweens.add({ targets: indicator, scale: 1.18, alpha: 0.45, duration: 260 / this.eventPlaybackSpeed, yoyo: true });
    await this.presentationDelay(this.reducedMotion() ? 80 : 280);
    indicator.destroy();
    question?.destroy();
  }

  private async showWorldCallout(text: string, point: RuntimePoint, color: number, duration = 620) {
    const callout = this.add.text(point.x, point.y - 62, text, {
      color: '#2f2b26', backgroundColor: '#fffaf0', fontFamily: 'sans-serif', fontSize: '18px', fontStyle: 'bold',
      padding: { x: 10, y: 6 }, stroke: `#${color.toString(16).padStart(6, '0')}`, strokeThickness: 1,
    }).setOrigin(0.5).setDepth(point.y + 80);
    if (!this.reducedMotion()) this.tweens.add({ targets: callout, y: callout.y - 6, duration: duration / this.eventPlaybackSpeed, ease: 'Sine.easeOut' });
    await this.presentationDelay(this.reducedMotion() ? Math.min(duration, 180) : duration);
    callout.destroy();
  }

  private handleStateChange(command: Extract<RuntimeCommand, { type: 'STATE_CHANGE' }>) {
    if (command.change === 'ROBOT_RECOVERY') {
      this.presentationBusy = true;
      this.robot?.setVelocity(0, 0).anims.stop();
      this.robotVisualState = 'NEUTRALIZED';
      this.robot?.setTexture('runtime-robot-neutralized-DOWN');
      const recoveryPoint = command.position ?? (this.robot ? { x: this.robot.x, y: this.robot.y } : { x: 0, y: 0 });
      void Promise.all([
        this.presentationDelay(RUNTIME_VISUAL_CONFIG.recoveryVisualMs),
        this.showWorldCallout('다시 일어나고 있어요...', recoveryPoint, 0x53799a, RUNTIME_VISUAL_CONFIG.recoveryVisualMs),
      ]).then(() => {
        this.setRobotVisualState('COMBAT');
        this.faceEncounter(command.location, command.position);
        this.presentationBusy = false;
        this.nextCommandAt = this.time.now;
        this.completeCommand(command);
      }).catch(error => this.failRuntime(error));
      return true;
    }
    if (command.change === 'SYSTEM_RESTORED') {
      this.presentationBusy = true;
      void this.animateCorePowerOn(command).then(() => {
        this.presentationBusy = false;
        this.nextCommandAt = this.time.now;
        this.completeCommand(command);
      }).catch(error => this.failRuntime(error));
      return true;
    }
    if (command.change === 'SECURITY_LOCK_OPEN' && this.securityLock) {
      this.presentation = applyRuntimePresentationCommand(this.presentation, command);
      this.presentationBusy = true;
      void this.animateSecurityEntranceOpen().then(() => {
        this.presentationBusy = false;
        this.nextCommandAt = this.time.now;
        this.completeCommand(command);
      }).catch(error => this.failRuntime(error));
      return true;
    }
    if (command.change === 'BOSS_FOUND') {
      this.presentation = applyRuntimePresentationCommand(this.presentation, command);
      this.restoreFloorEntities(command.floor);
      this.presentationBusy = true;
      const point = command.position ?? this.encounterPosition(command.location) ?? { x: this.robot?.x ?? 0, y: this.robot?.y ?? 0 };
      void this.animateBossReveal(point).then(() => {
        this.presentationBusy = false;
        this.nextCommandAt = this.time.now;
        this.completeCommand(command);
      }).catch(error => this.failRuntime(error));
      return true;
    }
    if (command.change === 'NO_BOSS') {
      this.presentation = applyRuntimePresentationCommand(this.presentation, command);
      this.restoreFloorEntities(command.floor);
      this.presentationBusy = true;
      const point = command.position ?? { x: this.robot?.x ?? 0, y: this.robot?.y ?? 0 };
      void this.showWorldCallout('여기에는 보스가 없어요.', point, 0x6f7b83, 620).then(() => {
        this.presentationBusy = false;
        this.nextCommandAt = this.time.now;
        this.completeCommand(command);
      }).catch(error => this.failRuntime(error));
      return true;
    }
    if (command.change === 'BOSS_NEUTRALIZED') {
      this.presentation = applyRuntimePresentationCommand(this.presentation, command);
      this.restoreFloorEntities(command.floor);
      this.presentationBusy = true;
      const point = command.position ?? this.encounterPosition(command.location) ?? { x: this.robot?.x ?? 0, y: this.robot?.y ?? 0 };
      void this.showWorldCallout('보스를 제압했어요!', point, 0x69a879, 720).then(() => {
        this.presentationBusy = false;
        this.nextCommandAt = this.time.now;
        this.completeCommand(command);
      }).catch(error => this.failRuntime(error));
      return true;
    }
    const motion = presentationMotionForCommand(this.presentation, command);
    if (motion?.entities.length) {
      if (motion.kind === 'PUSH' || motion.kind === 'CLEAR') this.setRobotVisualState('WORK');
      if (motion.kind === 'FORCE_PASS' || motion.kind === 'DISTRACT') this.setRobotVisualState('COMBAT');
      this.presentationBusy = true;
      void this.animatePresentation(motion).then(() => {
        this.presentation = applyRuntimePresentationCommand(this.presentation, command);
        this.restoreFloorEntities(command.floor);
        if (motion.kind === 'PUSH' || motion.kind === 'CLEAR') this.setRobotVisualState('NORMAL');
        this.presentationBusy = false;
        this.nextCommandAt = this.time.now + EVENT_DELAY / this.eventPlaybackSpeed;
        this.completeCommand(command);
      }).catch(error => this.failRuntime(error));
      return true;
    }
    this.presentation = applyRuntimePresentationCommand(this.presentation, command);
    this.restoreFloorEntities(command.floor);
    if (command.change === 'F5_DOOR_OPEN' && command.room) {
      const door = this.doors.get(command.room);
      if (door) {
        door.visual.setTexture(runtimeSearchDoorTexture(true));
        door.collider.body!.enable = false;
      }
    }
    return false;
  }

  private tweenTo(targets: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[], point: RuntimePoint, duration: number) {
    return new Promise<void>(resolve => this.tweens.add({
      targets,
      x: point.x,
      y: point.y,
      duration: duration / this.eventPlaybackSpeed,
      ease: 'Sine.easeInOut',
      onComplete: () => resolve(),
    }));
  }

  private presentationDelay(duration: number) {
    const timer = { progress: 0 };
    return new Promise<void>(resolve => this.tweens.add({
      targets: timer,
      progress: 1,
      duration: duration / this.eventPlaybackSpeed,
      onComplete: () => resolve(),
    }));
  }

  private showPoweredCore(powered: boolean) {
    for (const { visual, offTexture, displayWidth, displayHeight, originX, originY, depth } of this.cores) {
      visual.setTexture(powered ? 'runtime-core-on' : offTexture)
        .setOrigin(originX, originY)
        .setDisplaySize(displayWidth, displayHeight)
        .setDepth(depth);
    }
  }

  private showSecurityEntranceOpen() {
    if (!this.securityLock) return;
    const swapFrame = (visual: Phaser.GameObjects.Image, texture: string) => {
      const transform = {
        x: visual.x,
        y: visual.y,
        width: visual.displayWidth,
        height: visual.displayHeight,
        originX: visual.originX,
        originY: visual.originY,
        depth: visual.depth,
      };
      visual.setTexture(texture).setPosition(transform.x, transform.y)
        .setOrigin(transform.originX, transform.originY)
        .setDisplaySize(transform.width, transform.height).setDepth(transform.depth);
    };
    swapFrame(this.securityLock.left, 'runtime-secure-left-open');
    swapFrame(this.securityLock.right, 'runtime-secure-right-open');
    for (const center of this.securityLock.centers) center.setVisible(false);
    this.securityLock.collider.body!.enable = false;
  }

  private async animateSecurityEntranceOpen() {
    const timing = RUNTIME_VISUAL_CONFIG.secureEntranceOpen;
    this.robot?.setVelocity(0, 0);
    await this.presentationDelay(timing.unlockPauseMs);
    this.showSecurityEntranceOpen();
    if (!this.reducedMotion()) this.cameras.main.flash(130 / this.eventPlaybackSpeed, 255, 222, 116, false);
    const point = this.securityLock ? { x: this.securityLock.collider.x, y: this.securityLock.collider.y } : { x: this.robot?.x ?? 0, y: this.robot?.y ?? 0 };
    await Promise.all([
      this.presentationDelay(timing.openHoldMs),
      this.showWorldCallout('제어실로 가는 길이 열렸어요!', point, 0xe0aa3e, timing.openHoldMs),
    ]);
  }

  private async animateBossReveal(point: RuntimePoint) {
    this.robot?.setVelocity(0, 0);
    const boss = Object.values(this.presentation.entities).find(entity => entity.kind === 'BOSS' && entity.visible);
    if (boss) this.faceEncounter(boss.zoneId, boss.position);
    if (!this.reducedMotion()) {
      this.cameras.main.flash(140 / this.eventPlaybackSpeed, 255, 218, 150, false);
      const sprite = boss ? this.entities.get(boss.id) : undefined;
      if (sprite) this.tweens.add({ targets: sprite, alpha: { from: 0.25, to: 1 }, scaleX: sprite.scaleX * 1.06, scaleY: sprite.scaleY * 1.06, duration: 360 / this.eventPlaybackSpeed, yoyo: true });
    }
    await this.showWorldCallout('보스를 찾았어!', point, 0xc9685d, this.reducedMotion() ? 220 : 900);
  }

  private async animateSubdueAttempt(zoneId: string, repetitions: number) {
    if (!this.robot) return;
    const targets = Object.values(this.presentation.entities).filter(entity => entity.zoneId === zoneId);
    const encounter = targets[0];
    if (!encounter) return;
    const start = { x: this.robot.x, y: this.robot.y };
    const length = Math.hypot(encounter.position.x - start.x, encounter.position.y - start.y) || 1;
    const direction = {
      x: (encounter.position.x - start.x) / length,
      y: (encounter.position.y - start.y) / length,
    };
    const maximum = Math.min(RUNTIME_VISUAL_CONFIG.subdueLunge.distance, length);
    const map = this.maps[this.floor - 1];
    const bounds = { x: 0, y: 0, width: map.width * map.tilewidth, height: map.height * map.tileheight };
    const targetIds = new Set(targets.map(entity => entity.id));
    const blockers = this.movementBlockers(this.floor).filter(blocker => !targetIds.has(blocker.id));
    const distances = [...new Set([maximum, 12, 8, 4])].filter(distance => distance > 0 && distance <= maximum);
    const target = distances.map(distance => ({ x: start.x + direction.x * distance, y: start.y + direction.y * distance }))
      .find(point => movementPathIsClear([start, point], runtimeVisualFootprint('ROBOT'), bounds, this.movementWalls(this.floor), blockers))
      ?? start;

    this.lastDirection = directionForSegment({ x: 0, y: 0 }, direction);
    this.setRobotVisualState('COMBAT');
    this.robot.setVelocity(0, 0);
    for (let repetition = 0; repetition < repetitions; repetition++) {
      await this.tweenTo(this.robot, target, RUNTIME_VISUAL_CONFIG.subdueLunge.forwardMs);
      this.animateImpact(encounter.position);
      await this.presentationDelay(RUNTIME_VISUAL_CONFIG.subdueLunge.impactHoldMs);
      await this.tweenTo(this.robot, start, RUNTIME_VISUAL_CONFIG.subdueLunge.returnMs);
      if (repetitions > 1 && repetition === 0) await this.presentationDelay(this.reducedMotion() ? 30 : 120);
    }
    this.showRobotVisual();
  }

  private animateImpact(point: RuntimePoint) {
    const flash = this.add.circle(point.x, point.y - 20, 8, 0xffd56a, 0.8).setDepth(point.y + 90);
    this.tweens.add({
      targets: flash, scale: this.reducedMotion() ? 1.25 : 2.2, alpha: 0,
      duration: (this.reducedMotion() ? 70 : 120) / this.eventPlaybackSpeed,
      onComplete: () => flash.destroy(),
    });
    if (!this.reducedMotion()) this.cameras.main.shake(70 / this.eventPlaybackSpeed, 0.0012);
  }

  private animateWorkParticles(point: RuntimePoint) {
    if (this.reducedMotion()) return;
    for (const [index, offset] of [-12, 0, 12].entries()) {
      const particle = this.add.circle(point.x + offset, point.y - 16, 2.5, index === 1 ? 0xffd56a : 0xd7b689, 0.85).setDepth(point.y + 70);
      this.tweens.add({
        targets: particle, x: particle.x + offset * 0.5, y: particle.y - 12 - index * 3, alpha: 0,
        duration: (260 + index * 50) / this.eventPlaybackSpeed,
        onComplete: () => particle.destroy(),
      });
    }
  }

  private async animateLocalMotion(command: Extract<RuntimeCommand, { type: 'LOCAL_RETREAT' | 'LOCAL_BYPASS' }>) {
    if (!this.robot) return;
    const map = this.maps[command.floor - 1];
    const bounds = { x: 0, y: 0, width: map.width * map.tilewidth, height: map.height * map.tileheight };
    const walls = this.movementWalls(command.floor);
    const current = { x: this.robot.x, y: this.robot.y };
    let points: RuntimePoint[];
    if (command.type === 'LOCAL_RETREAT') {
      const plan = planLocalRetreat(current, command.incomingDirection, command.distance, bounds, walls, this.movementBlockers(command.floor));
      if (!plan.valid) throw new Error(`LOCAL_RETREAT ${command.commandId ?? '?'} has no collision-free path`);
      points = plan.points;
    } else {
      const target = Object.values(this.presentation.entities).find(entity => entity.zoneId === command.zoneId);
      if (!target) throw new Error(`LOCAL_BYPASS ${command.commandId ?? '?'} target is missing`);
      const targetBlocker = { id: target.id, point: target.position, footprint: runtimeVisualFootprint(target.kind) };
      const blockers = [...this.movementBlockers(command.floor).filter(blocker => blocker.id !== target.id), targetBlocker];
      const plan = planLocalBypass(current, target.position, command.incomingDirection, targetBlocker.footprint, command.tileSize, bounds, walls, blockers);
      if (!plan.valid) throw new Error(`LOCAL_BYPASS ${command.commandId ?? '?'} has no collision-free path`);
      if (plan.side === 'RIGHT') this.traceCommand('LOCAL_BYPASS_FALLBACK_RIGHT', command);
      points = plan.points;
    }
    this.robot.setVelocity(0, 0);
    for (const [index, point] of points.slice(1).entries()) {
      this.lastDirection = directionForSegment({ x: this.robot.x, y: this.robot.y }, point);
      this.showRobotVisual();
      await this.tweenTo(this.robot, point, 160);
      if (command.type === 'LOCAL_RETREAT' && index === 0) await this.presentationDelay(120);
    }
    this.showRobotVisual();
  }

  private setRobotVisualState(state: RuntimeRobotVisualState) {
    if (this.robotDisabled && state !== 'NEUTRALIZED') return;
    this.robotVisualState = state;
    this.showRobotVisual();
  }

  private showRobotVisual() {
    if (!this.robot) return;
    this.robot.anims.stop();
    this.robot.setTexture(runtimeRobotTexture(this.robotVisualState, this.lastDirection)).setOrigin(0.5, 1);
    this.scaleSprite(this.robot, RUNTIME_VISUAL_CONFIG.robotDisplayHeight);
  }

  private async animateCorePowerOn(command: Extract<RuntimeCommand, { type: 'STATE_CHANGE' }>) {
    const timing = RUNTIME_VISUAL_CONFIG.corePowerOn;
    this.setRobotVisualState('WORK');
    await this.presentationDelay(timing.arrivalPauseMs);
    this.presentation = setRuntimeCoreState(this.presentation, 'CORE_POWERING');
    await this.presentationDelay(timing.poweringMs);
    this.presentation = applyRuntimePresentationCommand(this.presentation, command);
    this.showPoweredCore(true);
    if (!this.reducedMotion()) this.cameras.main.flash(180 / this.eventPlaybackSpeed, 255, 232, 156, false);
    const point = this.cores[0] ? { x: this.cores[0].visual.x, y: this.cores[0].visual.y } : { x: this.robot?.x ?? 0, y: this.robot?.y ?? 0 };
    await Promise.all([
      this.presentationDelay(timing.poweredHoldMs),
      this.showWorldCallout('제어 시스템 복구 완료!', point, 0x69a879, timing.poweredHoldMs),
    ]);
    this.setRobotVisualState('NORMAL');
  }

  private async animatePresentation(motion: NonNullable<ReturnType<typeof presentationMotionForCommand>>) {
    const targets = motion.entities.map(entity => this.entities.get(entity.id))
      .filter((sprite): sprite is Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Image => Boolean(sprite));
    if (!targets.length) return;
    if (motion.kind === 'PUSH' || motion.kind === 'CLEAR') this.animateWorkParticles({ x: targets[0].x, y: targets[0].y });
    if (motion.kind === 'PUSH' && this.robot && motion.direction) {
      const entity = motion.entities[0];
      const contact = motion.robotContact!;
      const approach = [...(motion.robotApproach ?? []), contact]
        .filter((point, index, points) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
      const targetsToContact = approach.filter(point => Phaser.Math.Distance.Between(this.robot!.x, this.robot!.y, point.x, point.y) > 1);
      const lengths = targetsToContact.map((point, index) => {
        const from = index ? targetsToContact[index - 1] : { x: this.robot!.x, y: this.robot!.y };
        return Phaser.Math.Distance.Between(from.x, from.y, point.x, point.y);
      });
      const total = lengths.reduce((sum, length) => sum + length, 0) || 1;
      for (const [index, point] of targetsToContact.entries()) {
        this.lastDirection = directionForSegment({ x: this.robot.x, y: this.robot.y }, point);
        this.showRobotVisual();
        await this.tweenTo(this.robot, point, RUNTIME_VISUAL_CONFIG.pushDurationMs * 0.3 * lengths[index] / total);
      }
      this.lastDirection = directionForSegment({ x: 0, y: 0 }, motion.direction);
      this.showRobotVisual();
      const via = entity.via ?? entity.to;
      const robotVia = motion.robotPushTo!;
      await Promise.all([
        this.tweenTo(this.robot, robotVia, RUNTIME_VISUAL_CONFIG.pushDurationMs * 0.45),
        this.tweenTo(targets[0], via, RUNTIME_VISUAL_CONFIG.pushDurationMs * 0.45),
      ]);
      await this.tweenTo(targets[0], entity.to, RUNTIME_VISUAL_CONFIG.pushDurationMs * 0.25);
      this.showRobotVisual();
      return;
    }
    if (motion.kind === 'DISTRACT' && this.robot) {
      const center = { x: this.robot.x, y: this.robot.y };
      const map = this.maps[this.floor - 1];
      const bounds = { x: 0, y: 0, width: map.width * map.tilewidth, height: map.height * map.tileheight };
      const targetIds = new Set(motion.entities.map(entity => entity.id));
      const blockers = entitiesForFloor(this.presentation, this.floor)
        .filter(entity => entity.blocking && !targetIds.has(entity.id))
        .map(entity => ({ id: entity.id, point: entity.position, footprint: runtimeVisualFootprint(entity.kind) }));
      const plan = planDistractMovement(center, bounds, this.movementWalls(this.floor), blockers);
      this.robot.setVelocity(0, 0).anims.stop();
      for (const point of plan.points.slice(1)) {
        const direction = directionForSegment({ x: this.robot.x, y: this.robot.y }, point);
        this.lastDirection = direction;
        this.showRobotVisual();
        await Promise.all([
          this.tweenTo(this.robot, point, RUNTIME_VISUAL_CONFIG.distractSideDurationMs),
          ...motion.entities.map((entity, index) => this.tweenTo(
            targets[index],
            direction === 'LEFT' ? entity.reactionLeft! : entity.reactionRight!,
            RUNTIME_VISUAL_CONFIG.distractSideDurationMs,
          )),
        ]);
      }
      this.robot.setPosition(center.x, center.y);
      this.showRobotVisual();
      await Promise.all(motion.entities.map((entity, index) =>
        this.tweenTo(targets[index], entity.to, RUNTIME_VISUAL_CONFIG.distractFinalDurationMs)));
      return;
    }
    const duration = motion.kind === 'CLEAR'
      ? RUNTIME_VISUAL_CONFIG.clearDurationMs
      : RUNTIME_VISUAL_CONFIG.forcePassDurationMs;
    await Promise.all(motion.entities.map((entity, index) => this.tweenTo(targets[index], entity.to, duration)));
  }

  private async transitionFloor(command: Extract<RuntimeCommand, { type: 'FLOOR_TRANSITION' }>) {
    this.robot?.setVelocity(0, 0);
    const transitions = this.maps[command.floor - 1].layers.find(layer => layer.name === 'FloorTransitions')?.objects ?? [];
    const object = transitions.find(candidate => properties(candidate).transitionId === command.transitionId);
    if (!object) throw new Error(`Runtime transition ${command.transitionId} is missing`);
    this.transitionGate.reset();
    this.transitionGate.consume(null);
    const destination = this.transitionGate.consume(object);
    if (!destination || destination.targetFloor !== command.targetFloor || destination.targetSpawn !== command.targetSpawn) throw new Error(`Runtime transition ${command.transitionId} contract mismatch`);
    const fadeMs = this.reducedMotion() ? 60 : 190;
    this.cameras.main.fadeOut(fadeMs / this.eventPlaybackSpeed, 32, 29, 25);
    await this.presentationDelay(fadeMs);
    await this.renderFloor(destination.targetFloor, destination.targetSpawn);
    this.cameras.main.fadeIn(fadeMs / this.eventPlaybackSpeed, 32, 29, 25);
    const floorPoint = this.robot ? { x: this.robot.x, y: this.robot.y } : { x: 0, y: 0 };
    await Promise.all([
      this.presentationDelay(fadeMs),
      this.showWorldCallout(`${destination.targetFloor}층`, floorPoint, 0xe0aa3e, this.reducedMotion() ? 100 : 360),
    ]);
    this.nextCommandAt = this.time.now + EVENT_DELAY / this.eventPlaybackSpeed;
  }

  private restoreFloorEntities(floor: number) {
    for (const entity of entitiesForFloor(this.presentation, floor)) {
      let sprite = this.entities.get(entity.id);
      if (!sprite) {
        sprite = this.createPresentedEntity(entity);
        this.entities.set(entity.id, sprite);
        this.floorObjects.push(sprite);
      }
      sprite.setVisible(entity.visible).setPosition(entity.position.x, entity.position.y).setDepth(entity.position.y + 15);
      if (entity.kind === 'OBSTACLE') {
        const body = sprite as Phaser.Physics.Arcade.Image;
        body.body!.enable = entity.blocking;
        body.setTint(entity.visualState === 'CLEARED' ? 0xffb067 : 0xffffff);
        body.refreshBody();
      } else if (entity.kind === 'BOSS') {
        sprite.setTexture(entity.visualState === 'NEUTRALIZED' ? 'runtime-boss-neutralized' : 'runtime-boss-DOWN');
        this.scaleSprite(sprite, RUNTIME_VISUAL_CONFIG.bossDisplayHeight);
      } else if (entity.kind === 'VILLAIN' || entity.kind === 'GUARD') {
        const suffix = entity.visualState === 'NEUTRALIZED' ? 'neutralized' : 'DOWN';
        sprite.setTexture(`runtime-villain-${entity.variant ?? 1}-${suffix}`);
        this.scaleSprite(sprite, RUNTIME_VISUAL_CONFIG.villainDisplayHeight);
      }
    }
  }

  private createPresentedEntity(entity: RuntimePresentedEntity) {
    if (entity.kind === 'OBSTACLE') {
      const index = Math.abs([...entity.zoneId].reduce((sum, value) => sum + value.charCodeAt(0), 0)) % 3;
      const key = ['runtime-obstacle-CART', 'runtime-obstacle-BOX', 'runtime-obstacle-CART_BOX'][index];
      const body = this.physics.add.staticImage(entity.position.x, entity.position.y, key);
      this.scaleSprite(body, 58);
      const arcadeBody = body.body as Phaser.Physics.Arcade.StaticBody;
      arcadeBody.setSize(
        RUNTIME_CONTACT_FOOTPRINTS.OBSTACLE.width / body.scaleX,
        RUNTIME_CONTACT_FOOTPRINTS.OBSTACLE.height / body.scaleY,
      );
      arcadeBody.setOffset((body.width - arcadeBody.width) / 2, body.height - arcadeBody.height);
      body.refreshBody();
      return body;
    }
    const [texture, height] = entity.kind === 'CITIZEN'
      ? ['runtime-citizen-DOWN', RUNTIME_VISUAL_CONFIG.citizenDisplayHeight] as const
      : entity.kind === 'AMBIGUOUS'
        ? ['runtime-ambiguous-DOWN', RUNTIME_VISUAL_CONFIG.ambiguousDisplayHeight] as const
        : entity.kind === 'BOSS'
          ? ['runtime-boss-DOWN', RUNTIME_VISUAL_CONFIG.bossDisplayHeight] as const
          : [`runtime-villain-${entity.variant ?? 1}-DOWN`, RUNTIME_VISUAL_CONFIG.villainDisplayHeight] as const;
    const sprite = this.add.sprite(entity.position.x, entity.position.y, texture).setOrigin(0.5, 1);
    this.scaleSprite(sprite, height);
    return sprite;
  }

  private scaleSprite(sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, displayHeight: number) {
    sprite.setScale(displayHeight / sprite.height);
  }

  private setPaused(value: boolean) {
    this.paused = value;
    if (value) {
      this.robot?.setVelocity(0, 0).anims.pause();
      this.tweens.pauseAll();
    } else {
      this.robot?.anims.resume();
      this.tweens.resumeAll();
    }
  }

  private startPlayback() {
    if (this.started || this.terminal) return;
    this.started = true;
    this.nextCommandAt = this.time.now;
  }

  private applyTerminal(command: Extract<RuntimeCommand, { type: 'TERMINAL' }>) {
    if (this.terminalEmitted) return;
    this.terminal = true;
    this.terminalEmitted = true;
    this.move = undefined;
    this.presentationBusy = false;
    this.robot?.setVelocity(0, 0).anims.stop();
    this.robotDisabled = command.reason === 'ROBOT_DISABLED';
    this.setRobotVisualState(command.reason === 'ROBOT_DISABLED' ? 'NEUTRALIZED' : 'NORMAL');
    this.game.events.emit('reinforcement-runtime-terminal', command.reason, command.simulationTime);
  }

  private failRuntime(error: unknown) {
    console.error(error);
    this.terminal = true;
    this.presentationBusy = false;
    this.robot?.setVelocity(0, 0).anims.stop();
    this.game.events.emit('reinforcement-runtime-error', error instanceof Error ? error.message : String(error));
    if (this.move) this.traceCommand('CANCELLED', this.move.command, { reason: error instanceof Error ? error.message : String(error) });
    this.move = undefined;
  }

  private setPlaybackSpeed(value: number | { movement: number; event: number }) {
    const clamp = (speed: number) => Number.isFinite(speed) ? Phaser.Math.Clamp(speed, 0.25, 8) : 1;
    this.movementPlaybackSpeed = clamp(typeof value === 'number' ? value : value.movement);
    this.eventPlaybackSpeed = clamp(typeof value === 'number' ? value : value.event);
  }

  private emitStatus(trace: string, simulationTime: number, command?: RuntimeCommand) {
    this.game.events.emit('reinforcement-runtime-status', { floor: this.floor, trace, simulationTime, command });
  }

  private completeCommand(command: RuntimeCommand) {
    if (command.commandId !== undefined) {
      if (this.completedCommandIds.has(command.commandId)) {
        this.traceCommand('DUPLICATE_COMPLETION', command);
        return;
      }
      this.completedCommandIds.add(command.commandId);
    }
    this.playbackState = applyRuntimeCommand(this.playbackState, command);
    this.traceCommand('COMPLETED', command);
  }

  private traceCommand(phase: string, command: RuntimeCommand, detail: Record<string, unknown> = {}) {
    if (!this.runtimeSyncDebug) return;
    const commandContext = command.type === 'MOVE'
      ? {
          edgeIds: command.edgeIds,
          logicalSourceNode: command.logicalSourceNode,
          logicalTargetNode: command.logicalTargetNode,
          source: command.points[0],
          target: command.points.at(-1),
        }
      : command.type === 'FLOOR_TRANSITION'
        ? { transitionId: command.transitionId, targetFloor: command.targetFloor, targetSpawn: command.targetSpawn }
        : command.type === 'ENCOUNTER'
          ? { encounterId: command.zoneId, encounterPhase: command.phase }
          : command.type === 'ACTION' || command.type === 'OUTCOME'
            ? { encounterId: command.zoneId }
            : {};
    const entry = {
      ...this.runtimeIdentity,
      phase,
      commandId: command.commandId,
      type: command.type,
      commandFloor: command.floor,
      runtimeFloor: this.floor,
      simulationTime: command.simulationTime,
      position: this.robot ? { x: this.robot.x, y: this.robot.y } : undefined,
      velocity: this.robot?.body && 'velocity' in this.robot.body ? { x: this.robot.body.velocity.x, y: this.robot.body.velocity.y } : undefined,
      activeMoveTarget: this.move?.points[this.move.index],
      pendingCommandCount: Math.max(0, this.commands.length - this.cursor),
      bossFound: this.playbackState.bossFound,
      bossRoomId: this.playbackState.bossRoomId,
      currentSearchRoom: this.playbackState.currentSearchRoom,
      currentEncounterId: this.playbackState.currentEncounterId,
      bossNeutralized: this.playbackState.bossNeutralized,
      securityLockOpen: this.playbackState.securityLockOpen,
      systemRestored: this.playbackState.systemRestored,
      terminalReason: this.playbackState.terminal,
      ...commandContext,
      ...detail,
    };
    console.debug('[runtime-sync]', entry);
    this.game?.events.emit('reinforcement-runtime-sync-debug', entry);
  }

  private describe(command: RuntimeCommand) {
    if (command.type === 'MOVE') return `MOVE · ${command.edgeIds.join(' → ')}`;
    if (command.type === 'ACTION') return `ACTION → ${command.action}`;
    if (command.type === 'OUTCOME') return `OUTCOME → ${command.outcome}`;
    if (command.type === 'LOCAL_RETREAT') return 'LOCAL RETREAT';
    if (command.type === 'LOCAL_BYPASS') return 'LOCAL BYPASS';
    if (command.type === 'ENCOUNTER') return `${command.phase === 'START' ? command.encounter : 'ENCOUNTER END'}${command.villainCount ? ` ×${command.villainCount}` : ''}${command.stagingFallback ? ' · STAGING_FALLBACK' : ''}`;
    if (command.type === 'FLOOR_TRANSITION') return `TRANSITION → F${command.targetFloor}`;
    if (command.type === 'STATE_CHANGE') return command.change;
    return `TERMINAL → ${command.reason}`;
  }
}
