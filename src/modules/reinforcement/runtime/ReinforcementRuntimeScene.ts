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
  directionForSegment,
  RUNTIME_CONTACT_FOOTPRINTS,
  type RuntimeCommand,
  type RuntimeDirection,
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
  runtimeSearchDoorTexture,
} from './runtimeVisualConfig.ts';

type ManualTile = { id: number; class?: string; type?: string; image: string; imagewidth: number; imageheight: number };
type ManualTileset = { tiles?: ManualTile[] };
type LoadedTileset = { firstgid: number; source: string; manual: boolean; tiles: Map<number, ManualTile & { texture: string }> };

export type RuntimeSceneOptions = {
  maps: TiledMapJson[];
  commands: RuntimeCommand[];
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
  private terminal = false;
  private presentationBusy = false;
  private playbackSpeed = 1;
  private nextCommandAt = 0;
  private move?: {
    command: Extract<RuntimeCommand, { type: 'MOVE' }>;
    points: RuntimePoint[];
    macroPoints: RuntimePoint[];
    progressBase: number;
    index: number;
  };
  private routeCursor: RuntimeRouteCursor = { segment: 0, progress: 0, worldPosition: { x: 0, y: 0 } };
  private presentation: RuntimePresentationState;
  private entities = new Map<string, Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Image>();
  private doors = new Map<string, { visual: Phaser.GameObjects.Image; collider: Phaser.Physics.Arcade.Image }>();
  private securityLock?: { collider: Phaser.Physics.Arcade.Image };
  private core?: {
    visual: Phaser.GameObjects.Image;
    offTexture: string;
    displayWidth: number;
    displayHeight: number;
    originX: number;
    originY: number;
    depth: number;
  };
  private lastDirection: RuntimeDirection = 'DOWN';
  private transitionGate = new BuildingTransitionGate();

  constructor(options: RuntimeSceneOptions) {
    super('ReinforcementRuntimeScene');
    this.maps = options.maps;
    this.commands = options.commands;
    this.presentation = createRuntimePresentation(options.commands, options.maps);
  }

  preload() {
    const loadImage = (key: string, url: string) => { if (!this.textures.exists(key)) this.load.image(key, url); };
    for (const direction of ['UP', 'DOWN', 'LEFT', 'RIGHT'] as const) {
      loadImage(`runtime-robot-idle-${direction}`, RUNTIME_ASSETS.ROBOT.idle[direction]);
      RUNTIME_ASSETS.ROBOT.walk[direction].forEach((url, index) => loadImage(`runtime-robot-walk-${direction}-${index}`, url));
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
    loadImage('runtime-core-on', RUNTIME_ASSETS.F5_CORE.ON);
  }

  create() {
    this.createAnimations();
    this.game.events.on('reinforcement-runtime-pause', this.setPaused, this);
    this.game.events.on('reinforcement-runtime-speed', this.setPlaybackSpeed, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('reinforcement-runtime-pause', this.setPaused, this);
      this.game.events.off('reinforcement-runtime-speed', this.setPlaybackSpeed, this);
    });
    void this.initialize().catch(error => {
      console.error(error);
      this.game.events.emit('reinforcement-runtime-error', error instanceof Error ? error.message : String(error));
    });
  }

  update(time: number, delta: number) {
    if (this.paused || this.terminal || this.presentationBusy || !this.robot) {
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
    this.core = undefined;
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
      const goal = objects('NavigationNodes').find(object => properties(object).nodeId === 'F5_GOAL');
      if (!goal || !coreCandidates.length) throw new Error('Floor 5: final Core visual is missing');
      const visual = coreCandidates.reduce((nearest, candidate) =>
        Phaser.Math.Distance.Between(candidate.x, candidate.y, goal.x, goal.y)
          < Phaser.Math.Distance.Between(nearest.x, nearest.y, goal.x, goal.y) ? candidate : nearest);
      this.core = {
        visual,
        offTexture: visual.texture.key,
        displayWidth: visual.displayWidth,
        displayHeight: visual.displayHeight,
        originX: visual.originX,
        originY: visual.originY,
        depth: visual.depth,
      };
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
        this.securityLock = { collider };
        if (this.presentation.securityLockOpen) collider.body!.enable = false;
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
    this.emitStatus(this.describe(command), command.simulationTime);
    if (command.type === 'MOVE') {
      const current = { x: this.robot!.x, y: this.robot!.y };
      const map = this.maps[command.floor - 1];
      const bounds = { x: 0, y: 0, width: map.width * map.tilewidth, height: map.height * map.tileheight };
      const plan = planLocalMovement(command.points, current, bounds, this.movementWalls(command.floor), this.movementBlockers(command.floor));
      const progressBase = this.routeCursor.progress;
      this.routeCursor = {
        edgeId: command.edgeIds[0],
        segment: plan.segment,
        progress: progressBase,
        worldPosition: current,
      };
      this.move = { command, points: plan.points, macroPoints: command.points, progressBase, index: 1 };
      return;
    }
    if (command.type === 'ENCOUNTER') this.handleEncounter(command);
    if (command.type === 'STATE_CHANGE' && this.handleStateChange(command)) return;
    if (command.type === 'FLOOR_TRANSITION') {
      void this.transitionFloor(command);
      return;
    }
    if (command.type === 'TERMINAL') {
      this.terminal = true;
      this.robot?.setVelocity(0, 0).setTexture(`runtime-robot-idle-${this.lastDirection}`).anims.stop();
      this.game.events.emit('reinforcement-runtime-terminal', command.reason, command.simulationTime);
      return;
    }
    this.nextCommandAt = time + EVENT_DELAY / this.playbackSpeed;
  }

  private advanceMove(delta: number) {
    if (!this.move || !this.robot) return;
    const target = this.move.points[this.move.index];
    if (!target) {
      this.robot.setVelocity(0, 0).anims.stop();
      this.robot.setTexture(`runtime-robot-idle-${this.lastDirection}`);
      const total = projectRouteProgress(this.move.macroPoints, this.move.macroPoints.at(-1)!).total;
      this.routeCursor.progress = Math.max(this.routeCursor.progress, this.move.progressBase + total);
      this.routeCursor.worldPosition = { x: this.robot.x, y: this.robot.y };
      this.move = undefined;
      this.nextCommandAt = this.time.now + 80 / this.playbackSpeed;
      return;
    }
    const from = { x: this.robot.x, y: this.robot.y };
    this.lastDirection = directionForSegment(from, target);
    this.robot.play(`runtime-robot-walk-${this.lastDirection}`, true);
    const distance = RUNTIME_VISUAL_CONFIG.movementPixelsPerSecond * this.playbackSpeed * delta / 1000;
    const remaining = Phaser.Math.Distance.Between(from.x, from.y, target.x, target.y);
    if (remaining <= distance + 1) {
      this.robot.setPosition(target.x, target.y).setVelocity(0, 0);
      this.move.index++;
    } else {
      const direction = new Phaser.Math.Vector2(target.x - from.x, target.y - from.y).normalize().scale(RUNTIME_VISUAL_CONFIG.movementPixelsPerSecond * this.playbackSpeed);
      this.robot.setVelocity(direction.x, direction.y);
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
    return entitiesForFloor(this.presentation, floor).map(entity => ({
      id: entity.id,
      point: entity.position,
      footprint: runtimeVisualFootprint(entity.kind),
    }));
  }

  private handleEncounter(command: Extract<RuntimeCommand, { type: 'ENCOUNTER' }>) {
    if (command.phase === 'START') this.restoreFloorEntities(command.floor);
  }

  private handleStateChange(command: Extract<RuntimeCommand, { type: 'STATE_CHANGE' }>) {
    if (command.change === 'SYSTEM_RESTORED') {
      this.presentationBusy = true;
      void this.animateCorePowerOn(command).then(() => {
        this.presentationBusy = false;
        this.nextCommandAt = this.time.now;
      });
      return true;
    }
    const motion = presentationMotionForCommand(this.presentation, command);
    if (motion?.entities.length) {
      this.presentationBusy = true;
      void this.animatePresentation(motion).then(() => {
        this.presentation = applyRuntimePresentationCommand(this.presentation, command);
        this.restoreFloorEntities(command.floor);
        this.presentationBusy = false;
        this.nextCommandAt = this.time.now + EVENT_DELAY / this.playbackSpeed;
      });
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
    if (command.change === 'SECURITY_LOCK_OPEN' && this.securityLock) {
      this.securityLock.collider.body!.enable = false;
    }
    return false;
  }

  private tweenTo(targets: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[], point: RuntimePoint, duration: number) {
    return new Promise<void>(resolve => this.tweens.add({
      targets,
      x: point.x,
      y: point.y,
      duration: duration / this.playbackSpeed,
      ease: 'Sine.easeInOut',
      onComplete: () => resolve(),
    }));
  }

  private presentationDelay(duration: number) {
    const timer = { progress: 0 };
    return new Promise<void>(resolve => this.tweens.add({
      targets: timer,
      progress: 1,
      duration: duration / this.playbackSpeed,
      onComplete: () => resolve(),
    }));
  }

  private showPoweredCore(powered: boolean) {
    if (!this.core) return;
    const { visual, offTexture, displayWidth, displayHeight, originX, originY, depth } = this.core;
    visual.setTexture(powered ? 'runtime-core-on' : offTexture)
      .setOrigin(originX, originY)
      .setDisplaySize(displayWidth, displayHeight)
      .setDepth(depth);
  }

  private async animateCorePowerOn(command: Extract<RuntimeCommand, { type: 'STATE_CHANGE' }>) {
    const timing = RUNTIME_VISUAL_CONFIG.corePowerOn;
    await this.presentationDelay(timing.arrivalPauseMs);
    this.presentation = setRuntimeCoreState(this.presentation, 'CORE_POWERING');
    await this.presentationDelay(timing.poweringMs);
    this.presentation = applyRuntimePresentationCommand(this.presentation, command);
    this.showPoweredCore(true);
    await this.presentationDelay(timing.poweredHoldMs);
  }

  private async animatePresentation(motion: NonNullable<ReturnType<typeof presentationMotionForCommand>>) {
    const targets = motion.entities.map(entity => this.entities.get(entity.id))
      .filter((sprite): sprite is Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Image => Boolean(sprite));
    if (!targets.length) return;
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
        this.robot.play(`runtime-robot-walk-${this.lastDirection}`, true);
        await this.tweenTo(this.robot, point, RUNTIME_VISUAL_CONFIG.pushDurationMs * 0.3 * lengths[index] / total);
      }
      this.lastDirection = directionForSegment({ x: 0, y: 0 }, motion.direction);
      this.robot.play(`runtime-robot-walk-${this.lastDirection}`, true);
      const via = entity.via ?? entity.to;
      const robotVia = motion.robotPushTo!;
      await Promise.all([
        this.tweenTo(this.robot, robotVia, RUNTIME_VISUAL_CONFIG.pushDurationMs * 0.45),
        this.tweenTo(targets[0], via, RUNTIME_VISUAL_CONFIG.pushDurationMs * 0.45),
      ]);
      await this.tweenTo(targets[0], entity.to, RUNTIME_VISUAL_CONFIG.pushDurationMs * 0.25);
      this.robot.anims.stop();
      this.robot.setTexture(`runtime-robot-idle-${this.lastDirection}`);
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
        this.robot.play(`runtime-robot-walk-${direction}`, true);
        await Promise.all([
          this.tweenTo(this.robot, point, RUNTIME_VISUAL_CONFIG.distractSideDurationMs),
          ...motion.entities.map((entity, index) => this.tweenTo(
            targets[index],
            direction === 'LEFT' ? entity.reactionLeft! : entity.reactionRight!,
            RUNTIME_VISUAL_CONFIG.distractSideDurationMs,
          )),
        ]);
      }
      this.robot.anims.stop();
      this.robot.setPosition(center.x, center.y).setTexture(`runtime-robot-idle-${this.lastDirection}`);
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
    await this.renderFloor(destination.targetFloor, destination.targetSpawn);
    this.nextCommandAt = this.time.now + EVENT_DELAY / this.playbackSpeed;
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

  private setPlaybackSpeed(value: number) { this.playbackSpeed = [1, 2, 4].includes(value) ? value : 1; }

  private emitStatus(trace: string, simulationTime: number) {
    this.game.events.emit('reinforcement-runtime-status', { floor: this.floor, trace, simulationTime });
  }

  private describe(command: RuntimeCommand) {
    if (command.type === 'MOVE') return `MOVE · ${command.edgeIds.join(' → ')}`;
    if (command.type === 'ACTION') return `ACTION → ${command.action}`;
    if (command.type === 'OUTCOME') return `OUTCOME → ${command.outcome}`;
    if (command.type === 'ENCOUNTER') return `${command.phase === 'START' ? command.encounter : 'ENCOUNTER END'}${command.villainCount ? ` ×${command.villainCount}` : ''}${command.stagingFallback ? ' · STAGING_FALLBACK' : ''}`;
    if (command.type === 'FLOOR_TRANSITION') return `TRANSITION → F${command.targetFloor}`;
    if (command.type === 'STATE_CHANGE') return command.change;
    return `TERMINAL → ${command.reason}`;
  }
}
