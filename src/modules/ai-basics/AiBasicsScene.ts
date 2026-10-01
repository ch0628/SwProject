import * as Phaser from 'phaser';
import { LOGICAL } from '../../config';
import { characterAssetPath, characterTexture } from '../../characterManifest';
import { NOTES, nearbyNote, type Note } from './notes';
import darkBackground from '../../../assets/background/background.png';
import powerStage1 from '../../../assets/background/background_power_stage_1.png';
import powerStage2 from '../../../assets/background/background_power_stage_2.png';
import fairy from '../../../assets/ai/fairy.png';

const WORLD = { width: 1536, height: 960 };
const FLOOR_Y = [925, 652, 320] as const;
const ARI_Y = 310;
// The PNG has transparent pixels below the visible feet (same foot line in both facings).
const FOOT_ORIGIN_Y = 627 / 682;
const ANIM_FOOT_ORIGIN_Y = 670 / 682;
const PLAYER_HEIGHT = 152;
const SPAWN_X = 288;
const LADDER_X = { left: 100, right: 1420 };
const SPEED = 190;
const IDLE = characterTexture('cat', 'female', 'down');
const ANIMATIONS = {
  WALK_LEFT: { key: 'ai-cat-female-walk-left', file: 'cat_female_walk_left.png', frameRate: 9, repeat: -1 },
  WALK_RIGHT: { key: 'ai-cat-female-walk-right', file: 'cat_female_walk_right.png', frameRate: 9, repeat: -1 },
  CLIMB: { key: 'ai-cat-female-climb', file: 'cat_female_climb.png', frameRate: 8, repeat: -1 },
  PICKUP_LEFT: { key: 'ai-cat-female-pickup-left', file: 'cat_female_pickup_left.png', frameRate: 9, repeat: 0 },
  PICKUP_RIGHT: { key: 'ai-cat-female-pickup-right', file: 'cat_female_pickup_right.png', frameRate: 9, repeat: 0 },
} as const;
type VisualState = 'IDLE_DOWN' | keyof typeof ANIMATIONS;

export class AiBasicsScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private ari!: Phaser.GameObjects.Image;
  private background!: Phaser.GameObjects.Image;
  private keys!: Record<'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'Q', Phaser.Input.Keyboard.Key>;
  private prompt!: Phaser.GameObjects.Container;
  private noteVisuals = new Map<string, Phaser.GameObjects.Container>();
  private collected = new Set<string>();
  private floor: 0 | 1 | 2 = 0;
  private climbTo: 0 | 1 | 2 | null = null;
  private facing: 'left' | 'right' = 'right';
  private visualState: VisualState = 'IDLE_DOWN';
  private pickingUp = false;
  private blocked = true;
  private reachedAri = false;
  private powerCamera?: { zoom: number; scrollX: number; scrollY: number; useBounds: boolean };

  constructor(private onCollect: (note: Note) => void, private onAri: () => void) { super('AiBasicsScene'); }

  preload() {
    this.load.image('ai-basics-dark', darkBackground);
    this.load.image('ai-basics-power-1', powerStage1);
    this.load.image('ai-basics-power-2', powerStage2);
    this.load.image('ai-basics-ari', fairy);
    this.load.image(IDLE, characterAssetPath('cat', 'female', 'down'));
    for (const animation of Object.values(ANIMATIONS)) {
      this.load.spritesheet(animation.key, `/assets/characters/cat/animations/female/processed/${animation.file}`, { frameWidth: 512, frameHeight: 682 });
    }
  }

  create() {
    for (const animation of Object.values(ANIMATIONS)) {
      if (!this.anims.exists(animation.key)) this.anims.create({ key: animation.key, frames: this.anims.generateFrameNumbers(animation.key, { start: 0, end: 5 }), frameRate: animation.frameRate, repeat: animation.repeat });
    }
    this.background = this.add.image(0, 0, 'ai-basics-dark').setOrigin(0).setDisplaySize(WORLD.width, WORLD.height);
    for (const note of NOTES) {
      const y = FLOOR_Y[note.floor];
      const line = this.add.rectangle(0, 0, 42, 3, 0xc8f4ff).setStrokeStyle(1, 0xffffff);
      const spark = this.add.star(0, -17, 4, 3, 9, 0xe1fbff);
      this.tweens.add({ targets: spark, alpha: 0.25, scale: 0.55, yoyo: true, repeat: -1, duration: 650 + NOTES.indexOf(note) * 90 });
      this.noteVisuals.set(note.id, this.add.container(note.x, y - 4, [line, spark]).setScale(0.5).setDepth(2));
    }
    this.ari = this.add.image(1320, ARI_Y, 'ai-basics-ari').setOrigin(0.5, 1).setDisplaySize(76, 102).setVisible(false).setDepth(3);
    this.player = this.add.sprite(SPAWN_X, FLOOR_Y[0], IDLE).setOrigin(0.5, FOOT_ORIGIN_Y).setDepth(4);
    this.player.setScale(PLAYER_HEIGHT / this.player.height);
    const ring = this.add.circle(0, 0, 23, 0xffffff, 0).setStrokeStyle(3, 0xffffff, 0.9);
    const q = this.add.text(0, 0, 'Q', { fontFamily: 'sans-serif', fontSize: '25px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    this.prompt = this.add.container(0, 0, [ring, q]).setVisible(false).setDepth(5);
    this.tweens.add({ targets: ring, scale: 1.25, alpha: 0.5, duration: 900, yoyo: true, repeat: -1 });

    this.keys = this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,Q') as typeof this.keys;
    this.input.keyboard!.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'Q']);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height).setZoom(1.5);
    this.cameras.main.setScroll(-160, 510);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllKeys(true);
      this.noteVisuals.clear();
    });
  }

  setBlocked(blocked: boolean) { this.blocked = blocked; if (blocked) this.prompt?.setVisible(false); }
  revealAri() { this.ari.setVisible(true); }
  setPowerStage(stage: 0 | 1 | 2) { this.background?.setTexture(['ai-basics-dark', 'ai-basics-power-1', 'ai-basics-power-2'][stage]); }

  showWholeMap() {
    const camera = this.cameras.main;
    this.powerCamera = { zoom: camera.zoom, scrollX: camera.scrollX, scrollY: camera.scrollY, useBounds: camera.useBounds };
    camera.useBounds = false;
    const zoom = Math.min(camera.width / WORLD.width, camera.height / WORLD.height);
    return new Promise<void>(resolve => {
      camera.once(Phaser.Cameras.Scene2D.Events.ZOOM_COMPLETE, () => resolve());
      camera.pan(WORLD.width / 2, WORLD.height / 2, 1100, 'Sine.easeInOut');
      camera.zoomTo(zoom, 1100, 'Sine.easeInOut');
    });
  }

  restoreCamera() {
    const previous = this.powerCamera;
    if (!previous) return Promise.resolve();
    const camera = this.cameras.main;
    return new Promise<void>(resolve => {
      camera.once(Phaser.Cameras.Scene2D.Events.ZOOM_COMPLETE, () => {
        camera.setZoom(previous.zoom).setScroll(previous.scrollX, previous.scrollY);
        camera.useBounds = previous.useBounds;
        this.powerCamera = undefined;
        resolve();
      });
      camera.pan(previous.scrollX + camera.width / 2, previous.scrollY + camera.height / 2, 900, 'Sine.easeInOut');
      camera.zoomTo(previous.zoom, 900, 'Sine.easeInOut');
    });
  }

  reset() {
    this.player.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE);
    this.pickingUp = false;
    this.collected.clear();
    for (const visual of this.noteVisuals.values()) visual.setVisible(true);
    this.floor = 0;
    this.climbTo = null;
    this.facing = 'right';
    this.visualState = 'WALK_RIGHT';
    this.setVisual('IDLE_DOWN');
    this.player.setPosition(SPAWN_X, FLOOR_Y[0]);
    this.ari.setVisible(false);
    this.reachedAri = false;
    this.setPowerStage(0);
    this.powerCamera = undefined;
    this.cameras.main.setScroll(-160, 510);
  }

  update(_time: number, delta: number) {
    if (this.blocked || this.pickingUp) return;
    const k = this.keys;
    const step = SPEED * Math.min(delta, 50) / 1000;
    if (this.climbTo !== null) {
      this.setVisual('CLIMB');
      const targetY = FLOOR_Y[this.climbTo];
      this.player.y += Math.sign(targetY - this.player.y) * Math.min(Math.abs(targetY - this.player.y), step);
      if (this.player.y === targetY) { this.floor = this.climbTo; this.climbTo = null; this.setVisual('IDLE_DOWN'); }
    } else {
      const dx = Number(k.RIGHT.isDown) - Number(k.LEFT.isDown);
      const previousX = this.player.x;
      if (dx) {
        this.player.x = Phaser.Math.Clamp(this.player.x + dx * step, 38, WORLD.width - 38);
        this.facing = dx > 0 ? 'right' : 'left';
      }
      this.setVisual(this.player.x === previousX ? 'IDLE_DOWN' : dx < 0 ? 'WALK_LEFT' : 'WALK_RIGHT');
      if (k.UP.isDown && this.floor === 0 && Math.abs(this.player.x - LADDER_X.right) < 48) this.startClimb(1, LADDER_X.right);
      else if (k.UP.isDown && this.floor === 1 && Math.abs(this.player.x - LADDER_X.left) < 48) this.startClimb(2, LADDER_X.left);
      else if (k.DOWN.isDown && this.floor === 1 && Math.abs(this.player.x - LADDER_X.right) < 48) this.startClimb(0, LADDER_X.right);
      else if (k.DOWN.isDown && this.floor === 2 && Math.abs(this.player.x - LADDER_X.left) < 48) this.startClimb(1, LADDER_X.left);
    }

    const camera = this.cameras.main;
    const viewWidth = LOGICAL.width / 1.5;
    const viewHeight = LOGICAL.height / 1.5;
    const xInset = (LOGICAL.width - viewWidth) / 2;
    const yInset = (LOGICAL.height - viewHeight) / 2;
    const targetScrollX = Phaser.Math.Clamp(this.player.x - viewWidth * 0.48 - xInset, -xInset, WORLD.width - viewWidth - xInset);
    camera.scrollX = Phaser.Math.Linear(camera.scrollX, targetScrollX, 0.18);
    const targetScrollY = Phaser.Math.Clamp((this.climbTo === null ? FLOOR_Y[this.floor] : this.player.y) - 270, 0, WORLD.height - viewHeight) - yInset;
    camera.scrollY = Phaser.Math.Linear(camera.scrollY, targetScrollY, 0.12);

    const note = this.climbTo === null ? nearbyNote(this.player.x, this.floor, this.collected) : undefined;
    this.prompt.setVisible(!!note);
    if (note) {
      this.prompt.setPosition(note.x, FLOOR_Y[note.floor] - 68);
      if (Phaser.Input.Keyboard.JustDown(k.Q)) {
        this.prompt.setVisible(false);
        this.blocked = true;
        this.pickingUp = true;
        this.setVisual(note.x < this.player.x ? 'PICKUP_LEFT' : note.x > this.player.x ? 'PICKUP_RIGHT' : this.facing === 'left' ? 'PICKUP_LEFT' : 'PICKUP_RIGHT');
        this.player.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          this.pickingUp = false;
          this.collected.add(note.id);
          this.noteVisuals.get(note.id)?.setVisible(false);
          this.setVisual('IDLE_DOWN');
          this.onCollect(note);
        });
      }
    }
    if (!this.reachedAri && this.floor === 2 && this.collected.size === NOTES.length && this.player.x >= 1260) {
      this.reachedAri = true;
      this.blocked = true;
      this.setVisual('IDLE_DOWN');
      this.onAri();
    }
  }

  private setVisual(state: VisualState) {
    if (this.visualState === state) return;
    this.visualState = state;
    if (state === 'IDLE_DOWN') {
      this.player.anims.stop();
      this.player.setTexture(IDLE).setOrigin(0.5, FOOT_ORIGIN_Y);
    } else {
      this.player.setOrigin(0.5, ANIM_FOOT_ORIGIN_Y).play(ANIMATIONS[state].key);
    }
  }

  private startClimb(target: 0 | 1 | 2, x: number) { this.player.x = x; this.climbTo = target; this.prompt.setVisible(false); this.setVisual('CLIMB'); }
}
