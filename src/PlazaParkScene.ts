import * as Phaser from 'phaser';
import { LOGICAL, TIGER_FOOTPRINT, TIGER_HEIGHT, ARCHITECTURE_CLEARANCE } from './config';
import { overlaps, footprint, navigationBounds, canNavigate } from './collision';
import { canStand, mapObjects, mapWorld, moveProbe, plazaArchitecture, enterDoor, doorLane, type GrayboxMap, type MapObject } from './plazaPark';
import { createSmoke, stepSmoke, smokeMetrics, SMOKE_ROUTES, TRAFFIC_ROUTE_PATHS, SMOKE_SIZES, type RouteId, type AllRouteId, type SmokeRun } from './plazaTraffic';
import { createPlazaFullFlow35, stepFullFlow, fullFlowSummary, type FullFlowState } from './plazaFullFlow';
import { characterTexture, characterAssetPath, SPECIES_LIST, GENDER_LIST, FACING_LIST, NPC_VISUAL_ASSIGNMENT, type Facing } from './characterManifest';
import { createSupervisedPlazaDemo, createSupervisedPlazaGroup, stepPlazaNpcGroup } from './plazaNpcRuntime';
import {
  loadCameraZones, manualCharacterView, setUserLabel, visibleCharactersForZone,
  type CameraZone, type ManualLabelingState,
} from './cctvManualLabeling';
import type { BehaviorHistoryEntry, CharacterId, CharacterLabel } from './characterPool';
import { createRound1Group, DEFAULT_ROUND1_CONFIG, round1TrainingState, stepRound1Group, verifyRoundTrainingSample, type Round1Group } from './plazaRound1';
import { applyRound2ToGroup, getPostRetrainingPrediction, MONITORING_TARGET_IDS, prepareMonitoringTargets, ROUND2_COMPARISON_PLAN, round2TargetStatus, round2TrainingState, submitRound2Comparison, verifyMonitoringTarget } from './plazaRound2';
import { labelAndVerifyRound1Sample } from './supervisedGameFlow';

export class PlazaParkScene extends Phaser.Scene {
  private mapData!: GrayboxMap;
  private probe!: Phaser.GameObjects.Container;
  private solids: MapObject[] = [];
  private waypoints: MapObject[] = [];
  private debugObjects: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text | Phaser.GameObjects.Arc)[] = [];
  private coverage!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private reportAt = 0;
  private debug = new URLSearchParams(window.location.search).get('debug') === '1' || new URLSearchParams(window.location.search).get('mode') === 'dev';
  private cctv = true;
  private overview = false;
  private zoom = 1;
  private blocked = false;
  private tiger!: Phaser.GameObjects.Image;
  private tigerMode = true;
  private actorDebug!: Phaser.GameObjects.Graphics;
  private routeDebug!: Phaser.GameObjects.Graphics;
  private smoke: SmokeRun = {npcs:[],elapsed:0,paused:false};
  private npcSprites: Phaser.GameObjects.Container[] = [];
  private fullFlow: FullFlowState | null = null;
  private supervised: ReturnType<typeof createSupervisedPlazaDemo> | null = null;
  private round1: Round1Group | null = null;
  private supervisedSprites: Phaser.GameObjects.Container[] = [];
  private supervisedPaused = false;
  private notice = '';
  private inside = 0;
  private doorCooldown = false;
  private enters = 0;
  private exits = 0;
  private mapVersion = 'v1';
  private cameraZones: readonly CameraZone[] = [];
  private selectedCctv: CameraZone | null = null;
  private selectedCharacterId: CharacterId | null = null;
  private manualStateSignature = '';
  private cctvManualMode = false;
  private currentRound: 1 | 2 = 1;
  constructor(
    private report: (value: string) => void,
    private reportSmoke: (value:string)=>void = ()=>{},
    private reportManual: (value:ManualLabelingState)=>void = ()=>{},
  ) { super('PlazaParkScene'); }
  private architecture(x:number,y:number){return plazaArchitecture(this.mapData,x,y);}
  private manualNpcs(){return this.round1?.npcs??this.supervised?.npcs??[];}
  private blockers(){return [
    ...this.solids,
    ...this.smoke.npcs.filter(n=>!n.inside).map(n=>footprint(n.x,n.y,SMOKE_SIZES[n.size])),
    ...(this.supervised?.npcs.filter(n=>n.active&&n.visible).map(n=>footprint(n.position.x,n.position.y,n.config.footprint))??[]),
    ...(this.round1?.npcs.filter(n=>n.active&&n.visible).map(n=>footprint(n.position.x,n.position.y,n.config.footprint))??[]),
  ];}
  preload() {
    const params = new URLSearchParams(window.location.search);
    this.mapVersion = params.get('map') === 'v1' ? 'v1' : 'v2';
    this.load.tilemapTiledJSON('plaza-park', this.mapVersion === 'v2' ? '/maps/plaza-park-v2.tmj' : '/maps/plaza-park.tmj');
    this.load.svg('graybox', '/maps/graybox.svg');
    this.load.once('loaderror', (file: Phaser.Loader.File) => this.report(`LOAD ERROR: ${file.key}`));
    const ASSETS = [
      ['cafe_base', '/assets/environment/buildings/cafe/cafe_base.png'],
      ['cafe_foreground', '/assets/environment/buildings/cafe/cafe_foreground.png'],
      ['public_facility_base', '/assets/environment/buildings/public_facility/public_facility_base.png'],
      ['public_facility_foreground', '/assets/environment/buildings/public_facility/public_facility_foreground.png'],
      ['bush_a', '/assets/environment/nature/bushes/bush_a.png'],
      ['bush_b', '/assets/environment/nature/bushes/bush_b.png'],
      ['flower_patch_b', '/assets/environment/nature/flowers/flower_patch_b.png'],
      ['tree_b', '/assets/environment/nature/trees/tree_b.png'],
      ['manhole_closed', '/assets/environment/special/manhole/manhole_closed.png'],
      ['bench', '/assets/environment/street/bench/bench.png'],
      ['fence_horizontal', '/assets/environment/street/fence/fence_horizontal.png'],
      ['fence_vertical', '/assets/environment/street/fence/fence_vertical.png'],
      ['lamp_base', '/assets/environment/street/lamp/lamp_base.png'],
      ['lamp_glow', '/assets/environment/street/lamp/lamp_glow.png'],
      ['grass_base', '/assets/environment/terrain/grass/grass_base.png'],
      ['park_path_center', '/assets/environment/terrain/path/park_path_center.png'],
      ['plaza_paving_base', '/assets/environment/terrain/plaza/plaza_paving_base.png'],
      ['main_route_base', '/assets/environment/terrain/road/main_route_base.png']
    ];
    for (const [k, p] of ASSETS) this.load.image(k, p);

    for (const species of SPECIES_LIST) {
      for (const gender of GENDER_LIST) {
        for (const facing of FACING_LIST) {
          this.load.image(characterTexture(species, gender, facing), characterAssetPath(species, gender, facing));
        }
      }
    }
  }
  create() {
    this.mapData = this.cache.tilemap.get('plaza-park').data as GrayboxMap;
    this.cameraZones = this.mapVersion === 'v2' ? loadCameraZones(this.mapData) : [];
    const map = this.make.tilemap({ key: 'plaza-park' });
    const tiles = map.addTilesetImage('graybox', 'graybox')!;
    map.createLayer('Ground', tiles)!.setVisible(false);
    map.createLayer('Ground_Detail', tiles)!.setVisible(false);
    
    const tileMap: Record<number, string> = { 1: 'grass_base', 2: 'grass_base', 3: 'park_path_center', 4: 'park_path_center', 5: 'plaza_paving_base', 6: 'main_route_base', 7: 'plaza_paving_base' };
    const groundData = this.mapData.layers.find(l => l.name === 'Ground')!.data!;
    for (let y = 0; y < 56; y++) {
      for (let x = 0; x < 96; x++) {
        const t = groundData[y * 96 + x];
        if (t && tileMap[t]) this.add.image(x * 32, y * 32, tileMap[t]).setOrigin(0).setDepth(-100);
      }
    }
    const detailData = this.mapData.layers.find(l => l.name === 'Ground_Detail')!.data!;
    for (let y = 0; y < 56; y++) {
      for (let x = 0; x < 96; x++) {
        if (detailData[y * 96 + x] === 8) this.add.image(x * 32, y * 32, 'flower_patch_b').setOrigin(0).setDepth(-90);
      }
    }

    this.solids = mapObjects(this.mapData, 'Collision');
    this.waypoints = mapObjects(this.mapData, 'Navigation').filter(o => o.type === 'Waypoint');
    
    for (const o of mapObjects(this.mapData, 'Object_Base')) {
      if (o.type === 'Building') {
        const keyBase = o.name === 'Cafe' ? 'cafe_base' : 'public_facility_base';
        const keyFg = o.name === 'Cafe' ? 'cafe_foreground' : 'public_facility_foreground';
        this.add.image(o.x, o.y, keyBase).setOrigin(0).setDepth(-20);
        this.add.image(o.x, o.y, keyFg).setOrigin(0).setDepth(8900);
      } else if (o.type === 'Tree') {
        this.add.image(o.x + o.width/2, o.y + o.height, 'tree_b').setOrigin(0.5, 1).setDepth(o.y + o.height);
      } else if (o.type === 'Bush') {
        const key = ['B1','B2','B3','B4'].includes(o.name) ? 'bush_a' : 'bush_b';
        this.add.image(o.x + o.width/2, o.y + o.height, key).setOrigin(0.5, 1).setDepth(o.y + o.height);
      } else if (o.type === 'Bench') {
        this.add.image(o.x + o.width/2, o.y + o.height, 'bench').setOrigin(0.5, 1).setDepth(o.y + o.height);
      } else if (o.type === 'Lamp') {
        this.add.image(o.x + o.width/2, o.y + o.height, 'lamp_base').setOrigin(0.5, 1).setDepth(o.y + o.height);
        this.add.image(o.x + o.width/2, o.y + o.height, 'lamp_glow').setOrigin(0.5, 1).setDepth(8900);
      } else if (o.type === 'Manhole') {
        this.add.image(o.x + o.width/2, o.y + o.height/2, 'manhole_closed').setOrigin(0.5, 0.5).setDepth(-90);
      } else if (o.type === 'Fence') {
        const key = o.width > o.height ? 'fence_horizontal' : 'fence_vertical';
        this.add.tileSprite(o.x, o.y, o.width, o.height, key).setOrigin(0).setDepth(o.y + o.height);
      }
      if (this.debug) this.debugObjects.push(this.add.text(o.x,o.y,o.name,{fontSize:'11px',color:'#ffffff',backgroundColor:'#273039'}).setDepth(9000));
    }
    const outlines = this.add.graphics().setDepth(8990);
    outlines.lineStyle(1,0xff7979,.9);
    for (const o of this.solids) outlines.strokeRect(o.x,o.y,o.width,o.height);
    outlines.lineStyle(1,0x75ffe1,.9);
    for (const o of mapObjects(this.mapData,'Interaction')) outlines.strokeRect(o.x,o.y,o.width,o.height);
    this.debugObjects.push(outlines);
    for (const o of mapObjects(this.mapData,'Navigation')) {
      if(o.type==='Waypoint') {
        this.debugObjects.push(this.add.circle(o.x,o.y,5,0xffffff).setStrokeStyle(1,0x203039).setDepth(8999));
        this.debugObjects.push(this.add.text(o.x+7,o.y-12,o.name,{fontSize:'12px',color:'#fff',backgroundColor:'#263238'}).setDepth(9000));
      } else {
        outlines.lineStyle(1,0xe6dc90,.35).strokeRect(o.x,o.y,o.width,o.height);
      }
    }
    
    this.debugObjects.forEach(o => o.setVisible(this.debug));
    this.coverage = this.add.graphics().setDepth(8000);
    for (const [i,o] of mapObjects(this.mapData,'Camera_Zone').entries()) {
      const color=[0x56bfff,0xffb75a,0xd078f0][i];
      this.coverage.fillStyle(color,.065).fillRect(o.x,o.y,o.width,o.height).lineStyle(3,color,.9).strokeRect(o.x,o.y,o.width,o.height);
    }
    const body=this.add.rectangle(0,0,26,16,0xffffff).setStrokeStyle(2,0x172129);
    const arrow=this.add.triangle(0,-17,0,10,6,0,12,10,0xffee66).setOrigin(.5);
    this.probe=this.add.container(0,0,[body,arrow]);
    // ScaleValidationScene already loads and trims these textures; reuse its exact frames.
    this.tiger=this.add.image(0,0,'tiger-down').setOrigin(.5,1);
    this.tiger.setScale(TIGER_HEIGHT/this.tiger.height);
    this.probe.setVisible(false);
    this.actorDebug=this.add.graphics().setDepth(8995);
    this.routeDebug=this.add.graphics().setDepth(7980);
    this.keys=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as typeof this.keys;
    this.input.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{
      if(pointer.y<50||!this.selectedCctv||!this.manualNpcs().length)return;
      const point=this.cameras.main.getWorldPoint(pointer.x,pointer.y);
      const npc=visibleCharactersForZone(this.manualNpcs(),this.selectedCctv)
        .filter(candidate=>Math.abs(point.x-candidate.position.x)<=140&&point.y>=candidate.position.y-160&&point.y<=candidate.position.y+64)
        .sort((a,b)=>Math.hypot(point.x-a.position.x,point.y-a.position.y)-Math.hypot(point.x-b.position.x,point.y-b.position.y))[0];
      if(npc)this.selectCharacter(npc.definition.id);
    });
    const world=mapWorld(this.mapData);
    this.cameras.main.setBounds(0,0,world.width,world.height).startFollow(this.probe,true,1,1);
    this.goTo('W01');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{this.input.keyboard?.removeAllKeys(true);this.input.removeAllListeners();this.debugObjects=[];});
    if(this.mapVersion==='v2'){
      this.cctvManualMode=true;
      this.startRound1();
      this.selectCctv(this.cameraZones[0].name);
      if (this.debug) {
        this.toggleDebug();
        this.toggleDebug(); // To force update
      }
      this.cctv=false;this.coverage.setVisible(false);
      this.probe.setVisible(false);this.tiger.setVisible(false);
    }
    this.publish();
  }

  private startRound1(){
    this.smoke={npcs:[],elapsed:0,paused:false};this.fullFlow=null;this.supervised=null;this.round1=null;
    this.supervisedSprites.forEach(sprite=>sprite.destroy());this.supervisedSprites=[];
    const authored=Number(new URLSearchParams(window.location.search).get('roundStagger'));
    const config={...DEFAULT_ROUND1_CONFIG,admissionIntervalSeconds:Number.isFinite(authored)&&authored>0?authored:DEFAULT_ROUND1_CONFIG.admissionIntervalSeconds};
    this.round1=createRound1Group(this.mapData,this.cameraZones,config);
    const CCTV_CHARACTER_VISUAL_SCALE = 1.20;
    const visualHeight={rabbit:56 * CCTV_CHARACTER_VISUAL_SCALE,cat:56 * CCTV_CHARACTER_VISUAL_SCALE,fox:68 * CCTV_CHARACTER_VISUAL_SCALE,dog:68 * CCTV_CHARACTER_VISUAL_SCALE,tiger:80 * CCTV_CHARACTER_VISUAL_SCALE};
    for(const npc of this.round1.npcs){
      const {species,gender,id}=npc.definition,sprite=this.add.image(0,0,characterTexture(species,gender,'down')).setOrigin(.5,1);
      sprite.setScale(visualHeight[species]/sprite.height);
      const label=this.add.text(0,-visualHeight[species]-10,`${id} ${npc.phase}`,{fontSize:'10px',color:'#fff',backgroundColor:'#000'}).setOrigin(.5).setVisible(this.debug);
      const selectionRing=this.add.ellipse(0,-7,42,22).setStrokeStyle(3,0xffe66d).setVisible(false);
      const badgeStyle={fontFamily:'monospace',fontSize:'13px',fontStyle:'bold',color:'#fff',stroke:'#142027',strokeThickness:2,padding:{x:3,y:2}};
      const labelMarker=this.add.text(0,-visualHeight[species]-8,'',badgeStyle).setOrigin(.5,1).setVisible(false);
      const phaseMarker=this.add.text(0,-visualHeight[species]-8,'',badgeStyle).setOrigin(.5,1).setVisible(false);
      const container=this.add.container(npc.position.x,npc.position.y,[sprite,label,selectionRing,labelMarker,phaseMarker]);
      (container as any).lastX=npc.position.x;(container as any).lastY=npc.position.y;(container as any).facing='down' as Facing;
      (container as any).debugText=label;(container as any).selectionRing=selectionRing;(container as any).labelMarker=labelMarker;(container as any).phaseMarker=phaseMarker;
      this.supervisedSprites.push(container);
    }
    this.routeDebug.clear();
    for(const lane of this.round1.laneRuntime.lanes.values())for(const [points,color] of [[lane.forward,0x5ee7ff],[lane.reverse,0xff8ee7]] as const){
      this.routeDebug.lineStyle(2,color,.65).beginPath().moveTo(points[0].x,points[0].y);points.slice(1).forEach(point=>this.routeDebug.lineTo(point.x,point.y));this.routeDebug.strokePath();
    }
    for(const point of [...this.round1.scenarioPoints.values(),...this.round1.laneRuntime.stops.values()])this.routeDebug.fillStyle(0xffe66d,.9).fillCircle(point.x,point.y,6).lineStyle(2,0x172129,1).strokeCircle(point.x,point.y,6);
    this.notice=`Round 1 · 35 persistent identities · stagger ${config.admissionIntervalSeconds}s prototype knob.`;
  }

  selectCctv(name:string){
    const zone=this.cameraZones.find(candidate=>candidate.name===name);
    if(!zone)return;
    this.selectedCctv=zone;
    this.selectedCharacterId=null;
    const camera=this.cameras.main,viewportWidth=LOGICAL.width*.75,toolbarAndSpriteSafeHeight=LOGICAL.height-160;
    camera.stopFollow().setViewport(0,0,viewportWidth,LOGICAL.height)
      .setZoom(Math.min(viewportWidth/zone.width,toolbarAndSpriteSafeHeight/zone.height) * 1.08)
      .centerOn(zone.x+zone.width/2,zone.y+zone.height/2);
    this.publishManualState(true);
  }

  selectCharacter(id:CharacterId){
    if(!this.selectedCctv)return;
    if(!visibleCharactersForZone(this.manualNpcs(),this.selectedCctv).some(npc=>npc.definition.id===id))return;
    this.selectedCharacterId=id;
    this.publishManualState(true);
  }

  focusCharacter(id:CharacterId):boolean{
    const npc=this.round1?.npcs.find(candidate=>candidate.definition.id===id);
    if(!npc)return false;
    const zoneName=npc.currentObservationZone??npc.assignment.homeObservationZone;
    if(!zoneName)return false;
    this.selectCctv(zoneName);
    this.selectCharacter(id);
    return this.selectedCharacterId===id;
  }

  focusComparisonTarget(id:CharacterId):boolean{return this.focusCharacter(id);}

  setSelectedUserLabel(label:CharacterLabel):CharacterLabel|null{
    const npc=this.manualNpcs().find(candidate=>candidate.definition.id===this.selectedCharacterId);
    if(!npc||!this.selectedCctv||!visibleCharactersForZone(this.manualNpcs(),this.selectedCctv).includes(npc))return null;
    const actualLabel=this.currentRound===1&&'assignment' in npc?labelAndVerifyRound1Sample(npc,label):null;
    if(this.currentRound!==1)setUserLabel(npc.character,label);
    this.publishManualState(true);
    return actualLabel;
  }

  compareCharacter(id:CharacterId,label:CharacterLabel){
    if(!this.round1||this.currentRound!==2)return null;
    const npc=this.round1.npcs.find(candidate=>candidate.assignment.characterId===id);
    if(!npc)return null;
    const status=submitRound2Comparison(npc,label);
    this.publishManualState(true);
    return status;
  }

  /** Verify a specific NPC and return actualLabel. */
  verifyCharacter(id: CharacterId, allowAiOnly=false): CharacterLabel | null {
    if(!this.round1) return null;
    const npc=this.round1.npcs.find(n=>n.assignment.characterId===id);
    if(!npc||(!allowAiOnly&&npc.character.labels.userLabel===null)) return null;
    if(allowAiOnly)verifyMonitoringTarget(npc);else verifyRoundTrainingSample(npc);
    this.publishManualState(true);
    return npc.assignment.actualLabel;
  }

  /** Get behavior history of a specific NPC. */
  getBehaviorHistory(id: CharacterId): readonly BehaviorHistoryEntry[] {
    const npc=this.round1?.npcs.find(n=>n.assignment.characterId===id);
    return npc?.character.world.behaviorHistory??[];
  }

  /** Perform Scenario Round Reset to Round 2. */
  applyRound2(){
    if(!this.round1) return;
    applyRound2ToGroup(this.round1,this.mapData,this.cameraZones);
    this.currentRound=2;
    this.selectedCharacterId=null;
    this.publishManualState(true);
  }

  /** Get AI label of a specific NPC. */
  getAiLabel(id: CharacterId): CharacterLabel | null {
    const npc=this.round1?.npcs.find(n=>n.assignment.characterId===id);
    return npc?.character.labels.aiLabel ?? null;
  }

  getVerifiedLabel(id:CharacterId):CharacterLabel|null{
    return this.round1?.npcs.find(n=>n.assignment.characterId===id)?.verifiedLabel??null;
  }

  getRound2TargetStatuses(){
    if(!this.round1||this.currentRound!==2)return [];
    return ROUND2_COMPARISON_PLAN.map(({characterId})=>{
      const npc=this.round1!.npcs.find(candidate=>candidate.assignment.characterId===characterId)!;
      return {characterId,status:round2TargetStatus(npc)} as const;
    });
  }

  /** Reveal AI label for a specific comparison target. */
  revealAiLabelFor(id: CharacterId){
    if(!this.round1||this.currentRound!==2) return;
    const entry = ROUND2_COMPARISON_PLAN.find(e => e.characterId === id);
    if(!entry) return;
    const npc=this.round1.npcs.find(n=>n.assignment.characterId===id);
    if(npc){
      npc.character.labels.aiLabel=entry.aiLabel;
      npc.character.labels.aiConfidence=entry.aiConfidence;
    }
    this.publishManualState(true);
  }

  /** Set deterministic post-retraining AI predictions for ALL NPCs. */
  revealPostRetrainingLabels(){
    if(!this.round1||this.currentRound!==2) return;
    prepareMonitoringTargets(this.round1);
    for(const npc of this.round1.npcs){
       const pred = getPostRetrainingPrediction(npc.assignment.actualLabel);
       npc.character.labels.aiLabel = pred.aiLabel;
       npc.character.labels.aiConfidence = pred.aiConfidence;
    }
    this.publishManualState(true);
  }

  getCurrentRound():1|2{return this.currentRound;}

  getRound2TrainingState(){
    if(!this.round1||this.currentRound!==2) return null;
    return round2TrainingState(this.round1);
  }

  private publishManualState(force=false){
    const npcs=this.manualNpcs(),visible=this.selectedCctv?visibleCharactersForZone(npcs,this.selectedCctv):[];
    if(this.selectedCharacterId&&!visible.some(npc=>npc.definition.id===this.selectedCharacterId))this.selectedCharacterId=null;
    const isMonitoring = this.currentRound === 2 && npcs.every(n => n.character.labels.aiLabel !== null);
    
    for(const [index,npc] of npcs.entries()){
      const container=this.supervisedSprites[index],isVisible=visible.includes(npc);
      container.setVisible(isVisible);
      (container as any).selectionRing?.setVisible(isVisible&&npc.definition.id===this.selectedCharacterId);
      const marker=(container as any).labelMarker as Phaser.GameObjects.Text|undefined;
      const phaseMarker=(container as any).phaseMarker as Phaser.GameObjects.Text|undefined;
      const label=npc.character.labels.userLabel;
      const aiLabel=npc.character.labels.aiLabel;
      
      // Round 1 uses one compact user badge. Round 2 reserves this slot for AI/target state.
      marker?.setText(label==='CITIZEN'?'✓':label==='VILLAIN'?'!':'').setVisible(isVisible&&this.currentRound===1&&label!==null)
        .setColor('#fff').setStroke('#142027',2).setBackgroundColor(label==='CITIZEN'?'#13796b':'#bd4b32');
        
      // Phase Marker (?, !, AI label)
      if (isVisible) {
        if (isMonitoring) {
          const isTarget = MONITORING_TARGET_IDS.includes(npc.definition.id as typeof MONITORING_TARGET_IDS[number]);
          const aiText = aiLabel==='CITIZEN'?'AI✓':'AI!';
          const bgColor = aiLabel==='CITIZEN'?'#087c91':'#9c2a72';
          phaseMarker?.setText(isTarget ? `${aiText}!` : aiText).setVisible(true).setColor('#fff')
            .setStroke(isTarget?'#f5a623':'#142027',isTarget?3:2).setBackgroundColor(bgColor);
        } else if (this.currentRound === 2) {
          const isCompareTarget = ROUND2_COMPARISON_PLAN.some(e => e.characterId === npc.definition.id);
          if (isCompareTarget && aiLabel === null) {
            phaseMarker?.setText('?').setVisible(true).setColor('#1c2428').setStroke('#fff3b0',2).setBackgroundColor('#f2c94c');
          } else if(isCompareTarget&&aiLabel!==null){
            phaseMarker?.setText(aiLabel==='CITIZEN'?'AI✓':'AI!').setVisible(true).setColor('#fff').setStroke('#142027',2)
              .setBackgroundColor(aiLabel==='CITIZEN'?'#087c91':'#9c2a72');
          } else {
            phaseMarker?.setVisible(false);
          }
        } else {
          phaseMarker?.setVisible(false);
        }
      } else {
        phaseMarker?.setVisible(false);
      }
    }
    const selected=visible.find(npc=>npc.definition.id===this.selectedCharacterId);
    const training=this.round1?round1TrainingState(this.round1):{manualLabeledDistinctCount:npcs.filter(npc=>npc.character.labels.userLabel!==null).length,verifiedTrainingSampleCount:0,trainingReady:false};
    const state:ManualLabelingState={
      cctvs:this.cameraZones.map(zone=>zone.name),
      selectedCctv:this.selectedCctv?.name??null,
      visibleCharacterIds:visible.map(npc=>npc.definition.id),
      selectedCharacter:selected?manualCharacterView(selected):null,
      ...training,
    };
    const signature=JSON.stringify(state);
    if(force||signature!==this.manualStateSignature){this.manualStateSignature=signature;this.reportManual(state);}
  }
  goTo(name: string) {
    const o=this.waypoints.find(w=>w.name===name);
    if(this.inside)return;
    const allowed=o&&(this.tigerMode?canNavigate(o.x,o.y,TIGER_FOOTPRINT,this.blockers(),mapWorld(this.mapData),this.architecture(o.x,o.y),ARCHITECTURE_CLEARANCE.large):canStand(o.x,o.y,this.blockers(),mapWorld(this.mapData)));
    this.notice=allowed?`${name}: inspection jump`:`${name}: rejected by collision / Large clearance; position unchanged`;
    if(o&&allowed){this.probe.setPosition(o.x,o.y);this.doorCooldown=false;}
    this.publish();
  }
  toggleTiger(){
    if(this.inside)return;
    if(!this.tigerMode&&!canNavigate(this.probe.x,this.probe.y,TIGER_FOOTPRINT,this.blockers(),mapWorld(this.mapData),this.architecture(this.probe.x,this.probe.y),ARCHITECTURE_CLEARANCE.large)){
      this.notice='Tiger switch rejected here. Return to a clear waypoint first.';this.publish();return;
    }
    this.tigerMode=!this.tigerMode;this.tiger.setVisible(this.tigerMode);this.probe.setVisible(!this.tigerMode);this.notice='';this.publish();
  }
  setSmoke(mode:string){
    this.npcSprites.forEach(s=>s.destroy());this.npcSprites=[];
    this.supervisedSprites.forEach(s=>s.destroy());this.supervisedSprites=[];
    this.fullFlow=null;
    this.supervised=null;
    this.round1=null;
    this.supervisedPaused=false;
    if(mode==='supervised'||mode.startsWith('supervised')){
      this.smoke={npcs:[],elapsed:0,paused:false};
      if(this.mapVersion!=='v2'){
        this.notice='Supervised runtime requires ?map=v2; no NPC spawned.';
      } else {
        const count=mode==='supervised'?5:Number(mode.slice('supervised'.length));
        this.goTo('W21'); // Keep the inspection actor outside the measured entry flows.
        this.supervised=count===5?createSupervisedPlazaDemo(this.mapData):createSupervisedPlazaGroup(this.mapData,count);
        const CCTV_CHARACTER_VISUAL_SCALE = 1.20;
        const visualHeight={rabbit:56 * CCTV_CHARACTER_VISUAL_SCALE,cat:56 * CCTV_CHARACTER_VISUAL_SCALE,fox:68 * CCTV_CHARACTER_VISUAL_SCALE,dog:68 * CCTV_CHARACTER_VISUAL_SCALE,tiger:80 * CCTV_CHARACTER_VISUAL_SCALE};
        for(const npc of this.supervised.npcs){
          const {species,gender,id}=npc.definition;
          const sprite=this.add.image(0,0,characterTexture(species,gender,'down')).setOrigin(.5,1);
          sprite.setScale(visualHeight[species]/sprite.height);
          const label=this.add.text(0,-visualHeight[species]-10,`${id} ${npc.intents[npc.intentIndex]}`,{fontSize:'10px',color:'#fff',backgroundColor:'#000'}).setOrigin(.5).setVisible(this.debug);
          const selectionRing=this.add.ellipse(0,-7,42,22).setStrokeStyle(3,0xffe66d).setVisible(false);
          const labelMarker=this.add.text(0,-visualHeight[species]-12,'',{fontSize:'24px',fontStyle:'bold',color:'#fff',padding:{x:5,y:3}}).setOrigin(.5).setVisible(false);
          const phaseMarker=this.add.text(0,-visualHeight[species]-45,'',{fontSize:'24px',fontStyle:'bold',color:'#fff',padding:{x:4,y:2}}).setOrigin(.5).setVisible(false);
          const container=this.add.container(npc.position.x,npc.position.y,[sprite,label,selectionRing,labelMarker,phaseMarker]);
          (container as any).lastX=npc.position.x;(container as any).lastY=npc.position.y;
          (container as any).facing='down' as Facing;(container as any).debugText=label;
          (container as any).selectionRing=selectionRing;(container as any).labelMarker=labelMarker;(container as any).phaseMarker=phaseMarker;
          this.supervisedSprites.push(container);
        }
        this.notice=`Navigation v2 lane validation: ${count} active · cyan/pink=lanes · orange=transition · yellow/green=SP free/owned.`;
      }
    } else if(mode==='full35'){
      this.fullFlow=createPlazaFullFlow35(this.mapData,[footprint(this.probe.x,this.probe.y,TIGER_FOOTPRINT)]);
      this.smoke=this.fullFlow.run;
    } else {
      this.smoke=mode==='off'?{npcs:[],elapsed:0,paused:false}:createSmoke(this.mapData,mode==='all'?undefined:mode as RouteId,[footprint(this.probe.x,this.probe.y,TIGER_FOOTPRINT)]);
    }
    this.routeDebug.clear();
    if(this.supervised){
      for(const lane of this.supervised.laneRuntime.lanes.values()){
        for(const [points,color] of [[lane.forward,0x5ee7ff],[lane.reverse,0xff8ee7]] as const){
          this.routeDebug.lineStyle(2,color,.65).beginPath().moveTo(points[0].x,points[0].y);
          points.slice(1).forEach(point=>this.routeDebug.lineTo(point.x,point.y));this.routeDebug.strokePath();
        }
      }
      for(const stop of this.supervised.laneRuntime.stops.values())this.routeDebug.fillStyle(0xffe66d,.9).fillCircle(stop.x,stop.y,6).lineStyle(2,0x172129,1).strokeCircle(stop.x,stop.y,6);
    }
    for(const route of new Set(this.smoke.npcs.map(n=>n.route))){
      const points=TRAFFIC_ROUTE_PATHS[route as AllRouteId]?.map(id=>this.waypoints.find(w=>w.name===id)!)??SMOKE_ROUTES[route as RouteId].map(id=>this.waypoints.find(w=>w.name===id)!);
      this.routeDebug.lineStyle(2,[0xffa8a8,0x80d8ff,0xffdf80,0xb4ee91,0xd3a6ff][Number(route.slice(1))-1],.6).beginPath().moveTo(points[0].x,points[0].y);
      points.slice(1).forEach(p=>this.routeDebug.lineTo(p.x,p.y));this.routeDebug.strokePath();
    }
    for(const [i, n] of this.smoke.npcs.entries()){
      const assignment = NPC_VISUAL_ASSIGNMENT[i % NPC_VISUAL_ASSIGNMENT.length];
      const tex = characterTexture(assignment.species, assignment.gender, 'down');
      const sprite = this.add.image(0, 0, tex).setOrigin(0.5, 1);
      
      const s = SMOKE_SIZES[n.size];
      sprite.setScale(s.visual / sprite.height);

      const text = this.add.text(0, -s.visual - 10, `${n.id} ${n.route}`, {fontSize:'10px',color:'#fff',backgroundColor:'#000'}).setOrigin(0.5);
      text.setVisible(this.debug);

      const container = this.add.container(n.x, n.y, [sprite, text]);
      (container as any).lastX = n.x;
      (container as any).lastY = n.y;
      (container as any).facing = 'down' as Facing;
      (container as any).visualId = i;
      (container as any).debugText = text;

      this.npcSprites.push(container);
    }
    this.publish();
    this.publishManualState(true);
  }
  pauseSmoke(){if(this.round1)this.round1.paused=!this.round1.paused;else if(this.supervised)this.supervisedPaused=!this.supervisedPaused;else this.smoke.paused=!this.smoke.paused;this.publish();}
  toggleDebug() {
    this.debug=!this.debug;
    this.debugObjects.forEach(o=>o.setVisible(this.debug));
    for (const container of this.npcSprites) {
      if ((container as any).debugText) {
        (container as any).debugText.setVisible(this.debug);
      }
    }
    for (const container of this.supervisedSprites) if ((container as any).debugText) (container as any).debugText.setVisible(this.debug);
    this.publish();
  }
  toggleCoverage(){this.cctv=!this.cctv;this.coverage.setVisible(this.cctv);this.publish();}
  toggleZoom(){this.zoom=this.zoom===1?1.25:1;if(!this.overview)this.cameras.main.setZoom(this.zoom);this.publish();}
  toggleOverview(){
    this.overview=!this.overview;
    const c=this.cameras.main,w=mapWorld(this.mapData);
    if(this.overview)c.stopFollow().setZoom(Math.min(LOGICAL.width/w.width,LOGICAL.height/w.height)).centerOn(w.width/2,w.height/2);
    else c.setZoom(this.zoom).startFollow(this.probe,true,1,1);
    this.publish();
  }
  update(time:number,delta:number){
    if(!this.probe)return;
    const k=this.keys,dx=Number(k.D.isDown||k.RIGHT.isDown)-Number(k.A.isDown||k.LEFT.isDown),dy=Number(k.S.isDown||k.DOWN.isDown)-Number(k.W.isDown||k.UP.isDown);
    if(this.inside){
      this.inside=Math.max(0,this.inside-Math.min(delta,50)/1000);
      if(!this.inside){
        if(canStand(this.probe.x,this.probe.y,this.blockers(),mapWorld(this.mapData))){this.exits++;this.notice='Exit: same threshold position';this.tiger.setVisible(this.tigerMode);}
        else this.inside=.05;
      }
    }
    const next=this.inside?{x:this.probe.x,y:this.probe.y}:moveProbe(this.probe,dx,dy,delta,this.blockers(),mapWorld(this.mapData),this.tigerMode?(x,y)=>this.architecture(x,y):undefined);
    this.blocked=!!(dx||dy)&&next.x===this.probe.x&&next.y===this.probe.y;
    this.probe.setPosition(next.x,next.y).setDepth(next.y);
    if(dx||dy){this.tiger.setTexture(`tiger-${dx?(dx>0?'right':'left'):(dy>0?'down':'up')}`);this.tiger.setScale(TIGER_HEIGHT/this.tiger.height);}
    this.tiger.setPosition(next.x,next.y).setDepth(next.y);
    if(!doorLane(this.mapData,next.x,next.y))this.doorCooldown=false;
    const door=enterDoor(this.mapData,next.x,next.y);
    if(this.tigerMode&&!this.inside&&!this.doorCooldown&&door&&((door==='Cafe'&&dx<0)||(door==='Facility'&&dy<0))){
      this.inside=2;this.doorCooldown=true;this.enters++;this.tiger.setVisible(false);this.notice=`${door} ENTER: physical opening verified; hidden 2s`;
    }
    if(this.round1){
      stepRound1Group(this.round1,delta/1000,this.cctvManualMode||this.inside?[]:[footprint(next.x,next.y,TIGER_FOOTPRINT)]);
    } else if(this.supervised){
      if(!this.supervisedPaused)stepPlazaNpcGroup(this.supervised.npcs,this.mapData,this.supervised.graph,this.supervised.resolver,delta/1000,this.cctvManualMode||this.inside?[]:[footprint(next.x,next.y,TIGER_FOOTPRINT)]);
    } else if(this.fullFlow){
      stepFullFlow(this.fullFlow,this.mapData,delta/1000,this.inside?[]:[footprint(next.x,next.y,TIGER_FOOTPRINT)]);
    } else {
      stepSmoke(this.smoke,this.mapData,delta/1000,this.inside?[]:[footprint(next.x,next.y,TIGER_FOOTPRINT)]);
    }
    this.actorDebug.clear();this.routeDebug.setVisible(this.debug);
    for(const [i,n] of this.smoke.npcs.entries()){
      const container = this.npcSprites[i];
      const lastX = (container as any).lastX;
      const lastY = (container as any).lastY;
      let facing = (container as any).facing as Facing;
      
      const dx = n.x - lastX;
      const dy = n.y - lastY;
      
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          facing = dx > 0 ? 'right' : 'left';
        } else {
          facing = dy > 0 ? 'down' : 'up';
        }
      }
      
      (container as any).lastX = n.x;
      (container as any).lastY = n.y;
      (container as any).facing = facing;
      
      const assignment = NPC_VISUAL_ASSIGNMENT[(container as any).visualId % NPC_VISUAL_ASSIGNMENT.length];
      const sprite = container.list[0] as Phaser.GameObjects.Image;
      sprite.setTexture(characterTexture(assignment.species, assignment.gender, facing));
      
      container.setPosition(n.x, n.y).setDepth(n.y).setVisible(!n.inside);
      
      if(this.debug&&!n.inside){
        const f=footprint(n.x,n.y,SMOKE_SIZES[n.size]);
        this.actorDebug.lineStyle(2,n.blockedBy?0xff4d4d:0xffef8e).strokeRect(f.x,f.y,f.width,f.height);
      }
      if ((container as any).debugText) {
        (container as any).debugText.setText(`${n.id} ${n.route}`);
      }
    }
    for(const [i,n] of (this.round1?.npcs??this.supervised?.npcs??[]).entries()){
      const container=this.supervisedSprites[i],lastX=(container as any).lastX,lastY=(container as any).lastY;
      const moveX=n.position.x-lastX,moveY=n.position.y-lastY;
      let facing=(container as any).facing as Facing;
      if(Math.abs(moveX)>.001||Math.abs(moveY)>.001)facing=Math.abs(moveX)>=Math.abs(moveY)?(moveX>0?'right':'left'):(moveY>0?'down':'up');
      (container as any).lastX=n.position.x;(container as any).lastY=n.position.y;(container as any).facing=facing;
      (container.list[0] as Phaser.GameObjects.Image).setTexture(characterTexture(n.definition.species,n.definition.gender,facing));
      container.setPosition(n.position.x,n.position.y).setDepth(n.position.y);
      const state='assignment' in n?n.phase:(n.phase==='EXITED'?'EXITED':n.intents[n.intentIndex]);
      (container as any).debugText?.setText(`${n.definition.id} ${state}${n.stopPoint?` @ ${n.stopPoint}`:''}`);
      if(this.debug&&n.active&&n.visible){
        const f=footprint(n.position.x,n.position.y,n.config.footprint);
        this.actorDebug.lineStyle(2,n.stalledCandidate?0xff4d4d:0x7dff9b).strokeRect(f.x,f.y,f.width,f.height);
      }
    }
    this.publishManualState();
    const laneGroup=this.round1??this.supervised;
    if(this.debug&&laneGroup){
      for(const npc of laneGroup.npcs.filter(candidate=>candidate.active))for(const transition of npc.path.junctionTransitions??[]){
        const points=npc.path.points.slice(transition.startIndex,transition.endIndex+1);
        if(points.length>1){this.actorDebug.lineStyle(3,0xffa94d,.75).beginPath().moveTo(points[0].x,points[0].y);points.slice(1).forEach(point=>this.actorDebug.lineTo(point.x,point.y));this.actorDebug.strokePath();}
      }
      for(const stop of this.round1?[...this.round1.scenarioPoints.values(),...this.round1.laneRuntime.stops.values()]:this.supervised!.laneRuntime.stops.values()){
        const owner=laneGroup.laneRuntime.coordination.stopReservations.get(stop.name);
        this.actorDebug.fillStyle(owner?0x7dff9b:0xffe66d,.9).fillCircle(stop.x,stop.y,owner?8:6).lineStyle(2,0x172129,1).strokeCircle(stop.x,stop.y,owner?8:6);
      }
    }
    if(this.debug){
      const f=footprint(next.x,next.y,TIGER_FOOTPRINT),v=navigationBounds(next.x,next.y,ARCHITECTURE_CLEARANCE.large);
      this.actorDebug.lineStyle(1,0xffff00).strokeRect(f.x,f.y,f.width,f.height);
      if(this.tigerMode)this.actorDebug.lineStyle(1,0xd69bff).strokeRect(v.x,v.y,v.width,v.height);
    }
    if(time-this.reportAt>200){this.reportAt=time;this.publish();}
  }
  private publish(){
    if(!this.probe)return;
    const body=footprint(this.probe.x,this.probe.y,TIGER_FOOTPRINT);
    const hits=mapObjects(this.mapData,'Interaction').filter(o=>overlaps(body,o)).map(o=>o.name);
    const inside=mapObjects(this.mapData,'Camera_Zone').filter(o=>this.probe.x>=o.x&&this.probe.x<o.x+o.width&&this.probe.y>=o.y&&this.probe.y<o.y+o.height).map(o=>o.name);
    this.report(`Plaza & Park READY · Map: ${this.mapVersion} · 96×56 · 3072×1792\n${this.tigerMode?'Tiger Male 80px · Large 30/56/8':'Debug probe · physical only'} · footprint26×16\nPixel (${this.probe.x.toFixed(1)}, ${this.probe.y.toFixed(1)}) · Tile (${Math.floor(this.probe.x/32)}, ${Math.floor(this.probe.y/32)})\n${this.blocked?'BLOCKED':'FREE'} · Interaction: ${hits.join(', ')||'—'}\nCoverage: ${inside.join(', ')||'—'} · overlay ${this.cctv?'ON':'OFF'}\n${this.overview?'Overview':'Follow'} · zoom ${this.cameras.main.zoom.toFixed(2)} · Debug ${this.debug?'ON':'OFF'} · FPS ${this.game.loop.actualFps.toFixed(0)}\n${this.notice}\nDoor Enter ${this.enters} / Exit ${this.exits} · ${this.inside?'INSIDE':'OUTSIDE'}`);
    const moving=this.smoke.paused?0:this.smoke.npcs.filter(n=>n.moving).length;
    const metrics=smokeMetrics(this.smoke);
    if(this.round1){
      const training=round1TrainingState(this.round1),active=this.round1.npcs.filter(npc=>npc.active).length;
      const road=this.round1.npcs.filter(npc=>npc.active&&['MOVING_TO_TARGET','REJOINING','EXITING'].includes(npc.phase)).length;
      this.reportSmoke(`ROUND 1 · Persistent identities 35 · ${this.round1.paused?'PAUSED':'RUNNING'}\nWorld active ${active} · Road movers ${road}/${this.round1.config.maxRoadMovers}\nManual ${training.manualLabeledDistinctCount}/8 · Verified ${training.verifiedTrainingSampleCount}/8 · ${training.trainingReady?'READY':'FIRST_TRAINING not ready'}\n`+
        this.round1.npcs.map(npc=>`${npc.assignment.characterId} ${npc.assignment.homeObservationZone} ${npc.phase}${npc.stopPoint?` @ ${npc.stopPoint}`:''} · cycle ${npc.cycle} · history ${npc.character.world.behaviorHistory.length}`).join('\n'));
    } else if(this.supervised){
      const total=this.supervised.npcs.length,active=this.supervised.npcs.filter(n=>n.active).length,stalled=this.supervised.npcs.filter(n=>n.stalledCandidate).length;
      const stopState=[...this.supervised.laneRuntime.stops.keys()].map(name=>`${name}:${this.supervised!.laneRuntime.coordination.stopReservations.get(name)??'FREE'}`).join(' ');
      const junctionState=[...this.supervised.laneRuntime.coordination.transitionReservations].map(([turn,owner])=>`${turn}:${owner}`).join(' ')||'FREE';
      this.reportSmoke(`Character Pool 35 · Validation ${total} (not final concurrency)\n${this.supervisedPaused?'PAUSED':'RUNNING'} · Active ${active} · Exited ${total-active} · Stalled candidates ${stalled}\nSP ${stopState}\nJunction ${junctionState}\n`+
        this.supervised.npcs.map(n=>`${n.definition.id} ${n.phase==='EXITED'?`EXIT → ${n.character.world.currentZone}`:`${n.intents[n.intentIndex]} → ${n.stopPoint??n.targetNode}`} · history ${n.character.world.behaviorHistory.length}`).join('\n'));
    } else if(this.fullFlow){
      const ff=this.fullFlow;
      const m=ff.metrics;
      const allRoutes=['R1','R2','R3','R4','R5','R6','R7','R8'];
      this.reportSmoke(
        `NPC 35 · Phase: ${ff.phase}\nGlobal ${ff.globalElapsed.toFixed(1)}s / 330s · Measurement ${ff.measurementElapsed.toFixed(1)}s / 300s\n`+
        `Completed Routes ${m.completed_routes} · Collision ${m.collision_violation_total}\n`+
        `20s+ Block: ${m.ever_20sec_block_count} · Deadlock: ${m.deadlock_count}\n`+
        `Max Wait ${m.max_continuous_blocked_time.toFixed(1)}s · Peak Blocked: ${m.blocked_npc_count_peak}\n`+
        `Cafe Enter/Exit: ${m.cafe_enter_count}/${m.cafe_exit_count} · Facility: ${m.facility_enter_count}/${m.facility_exit_count}\n`+
        `Upper Narrow Q: ${m.upper_narrow_max_queue} · Lower Narrow Q: ${m.lower_narrow_max_queue}\n`+
        `W12 Q: ${m.w12_max_queue} · Owner Changes: ${m.w12_owner_change_count}\n`+
        `FPS: ${this.game.loop.actualFps.toFixed(1)} · (measurement FPS: Browser only)\n`+
        allRoutes.map(id=>{const ns=this.smoke.npcs.filter(n=>n.route===id);if(!ns.length)return'';return`${id}: arrivals ${ns.reduce((s,n)=>s+n.arrivals,0)} trips ${ns.reduce((s,n)=>s+n.trips,0)}`;}).filter(Boolean).join('\n')
      );
    } else {
      this.reportSmoke(`NPC ${this.smoke.npcs.length} · ${this.smoke.elapsed.toFixed(1)}s / 120s · ${this.smoke.paused?'PAUSED':'RUNNING'}\nMoving ${moving} / Waiting ${this.smoke.npcs.length-moving}\n${this.smoke.policy??'v2'} · side-step / narrow reservation / W12 FIFO\nBlocked ${metrics.blocked_npc_count} · Severe ${metrics.severe_block_count} · 20s+ ${metrics.unrecovered_20sec}\nRecoveries ${metrics.recoveries} · Active ${metrics.active_npc}\n`+Object.keys(SMOKE_ROUTES).map(id=>{
        const ns=this.smoke.npcs.filter(n=>n.route===id);if(!ns.length)return '';
        return `${id}: arrivals ${ns.reduce((s,n)=>s+n.arrivals,0)} / trips ${ns.reduce((s,n)=>s+n.trips,0)}\nmax wait ${Math.max(...ns.map(n=>n.longestWait)).toFixed(1)}s / events ${ns.reduce((s,n)=>s+n.blockedEvents,0)}\n${ns.filter(n=>n.blockedBy).map(n=>`#${n.id} → ${(TRAFFIC_ROUTE_PATHS[n.route] as readonly string[])[n.target]} blocked: ${n.blockedBy}`).join('; ')}`;
      }).filter(Boolean).join('\n'));
    }
  }
}
