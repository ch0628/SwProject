import { canOccupy, footprint, overlaps, sweptFootprint, type Bounds } from './collision.ts';
import {
  appendBehaviorHistory, characterDefinition, createCharacterRuntimeState,
  type BehaviorPrimitive, type CharacterDefinition, type CharacterId, type CharacterLabel,
  type CharacterRuntimeState, type SemanticBehavior,
} from './characterPool.ts';
import { mapObjects, mapWorld, type GrayboxMap } from './plazaPark.ts';
import {
  findNavigationPath, loadNavigationV2,
  type NavigationGraph, type NavigationPath, type NavigationPoint,
} from './plazaNavigationV2.ts';
import {
  createPlazaLaneRuntime, lanePath, releaseStopReservation, reserveAuthoredPointMovementPlan,
  type AuthoredPoint, type AuthoredPointMovementPlan, type PlazaLaneRuntime,
} from './plazaLaneRuntime.ts';
import type { CameraZone } from './cctvManualLabeling.ts';

export const ROUND1_CAMERA_IDS = Object.freeze(['PLAZA_CAM_A','PLAZA_CAM_B','PLAZA_CAM_C','PLAZA_CAM_D','PLAZA_CAM_E'] as const);
export type RoundCameraId = typeof ROUND1_CAMERA_IDS[number];
export type RoundLifecycle = 'STATIC_HOLD' | 'ENTER_AND_STAY' | 'ENTER_HOLD_EXIT' | 'THROUGH_TRAFFIC';
export type RoundMovementRole = 'STATIONARY' | 'TEMPORARY_MOVER' | 'RECURRING_MOVER';
export type RoundInitialState = 'STATIC_PRESENT' | 'OFFSCREEN_STAGGERED';
export type RoundCharacterAssignment = Readonly<{
  characterId: CharacterId;
  actualLabel: CharacterLabel;
  homeObservationZone: RoundCameraId;
  lifecycle: RoundLifecycle;
  movementRole: RoundMovementRole;
  initialState: RoundInitialState;
  entry: 'N01' | 'N02' | 'N03' | 'N16' | null;
  target: string | null;
  mainBehavior: SemanticBehavior;
  exit: 'N24' | 'N25' | 'N26' | null;
  reEntryPolicy: 'NEVER' | 'SAME_IDENTITY';
  historyBehavior?: SemanticBehavior;
}>;
export type RoundScenario = Readonly<{ roundId:'ROUND_1'; assignments:readonly RoundCharacterAssignment[] }>;

const a = (
  characterId:CharacterId, actualLabel:CharacterLabel, homeObservationZone:RoundCameraId,
  lifecycle:RoundLifecycle, entry:RoundCharacterAssignment['entry'], target:string|null,
  mainBehavior:SemanticBehavior, exit:RoundCharacterAssignment['exit'], historyBehavior?:SemanticBehavior,
):RoundCharacterAssignment => Object.freeze({
  characterId, actualLabel, homeObservationZone, lifecycle,
  movementRole:lifecycle==='STATIC_HOLD'?'STATIONARY':lifecycle==='THROUGH_TRAFFIC'?'RECURRING_MOVER':'TEMPORARY_MOVER',
  initialState:lifecycle==='STATIC_HOLD'?'STATIC_PRESENT':'OFFSCREEN_STAGGERED',
  entry, target, mainBehavior, exit,
  reEntryPolicy:lifecycle==='STATIC_HOLD'||lifecycle==='ENTER_AND_STAY'?'NEVER':'SAME_IDENTITY',
  ...(historyBehavior?{historyBehavior}:{}),
});

export const ROUND1_SCENARIO: RoundScenario = Object.freeze({ roundId:'ROUND_1', assignments:Object.freeze([
  a('NPC01','VILLAIN','PLAZA_CAM_A','STATIC_HOLD',null,'A_STATIC_01','LOOKING_AROUND',null,'STEALING'),
  a('NPC02','CITIZEN','PLAZA_CAM_A','STATIC_HOLD',null,'A_STATIC_02','IDLING',null),
  a('NPC03','CITIZEN','PLAZA_CAM_A','ENTER_AND_STAY','N01','A_STAY_01','TALKING',null),
  a('NPC04','CITIZEN','PLAZA_CAM_A','ENTER_AND_STAY','N03','A_STAY_02','CARRYING_TOOLS',null),
  a('NPC05','CITIZEN','PLAZA_CAM_A','ENTER_HOLD_EXIT','N01','SP1','RESTING','N24'),
  a('NPC06','CITIZEN','PLAZA_CAM_A','ENTER_HOLD_EXIT','N03','A_ACTION_01','EXERCISING','N24'),
  a('NPC07','CITIZEN','PLAZA_CAM_A','THROUGH_TRAFFIC','N01',null,'WALKING','N24'),

  a('NPC08','CITIZEN','PLAZA_CAM_B','STATIC_HOLD',null,'B_STATIC_01','RESTING',null),
  a('NPC09','CITIZEN','PLAZA_CAM_B','STATIC_HOLD',null,'B_STATIC_02','TALKING',null),
  a('NPC10','VILLAIN','PLAZA_CAM_B','ENTER_AND_STAY','N02','B_STAY_01','THREATENING',null),
  a('NPC11','CITIZEN','PLAZA_CAM_B','ENTER_AND_STAY','N02','B_STAY_02','WAITING',null),
  a('NPC12','VILLAIN','PLAZA_CAM_B','ENTER_HOLD_EXIT','N02','SP5','SNATCHING','N25'),
  a('NPC13','CITIZEN','PLAZA_CAM_B','ENTER_HOLD_EXIT','N02','SP6','DELIVERING','N25'),
  a('NPC14','CITIZEN','PLAZA_CAM_B','THROUGH_TRAFFIC','N02',null,'TRANSITING','N25'),

  a('NPC15','CITIZEN','PLAZA_CAM_C','STATIC_HOLD',null,'C_STATIC_01','IDLING',null),
  a('NPC16','CITIZEN','PLAZA_CAM_C','STATIC_HOLD',null,'C_STATIC_02','RESTING',null),
  a('NPC17','CITIZEN','PLAZA_CAM_C','ENTER_AND_STAY','N03','C_STAY_01','CAFE_SERVICE',null),
  a('NPC18','VILLAIN','PLAZA_CAM_C','ENTER_AND_STAY','N03','C_STAY_02','THREATENING',null),
  a('NPC19','VILLAIN','PLAZA_CAM_C','ENTER_HOLD_EXIT','N03','C_ACTION_01','STEALING','N24'),
  a('NPC20','CITIZEN','PLAZA_CAM_C','ENTER_HOLD_EXIT','N03','SP8','CAFE_SERVICE','N24'),
  a('NPC21','CITIZEN','PLAZA_CAM_C','THROUGH_TRAFFIC','N03',null,'COMMUTING','N24'),

  a('NPC22','CITIZEN','PLAZA_CAM_D','STATIC_HOLD',null,'D_STATIC_01','RESTING',null),
  a('NPC23','CITIZEN','PLAZA_CAM_D','STATIC_HOLD',null,'D_STATIC_02','CARRYING_TOOLS',null),
  a('NPC24','CITIZEN','PLAZA_CAM_D','ENTER_AND_STAY','N16','D_STAY_01','REPAIRING',null),
  a('NPC25','VILLAIN','PLAZA_CAM_D','ENTER_HOLD_EXIT','N16','SP10','MANHOLE_TAMPER','N26'),
  a('NPC26','CITIZEN','PLAZA_CAM_D','ENTER_AND_STAY','N16','D_STAY_02','WAITING',null),
  a('NPC27','CITIZEN','PLAZA_CAM_D','ENTER_HOLD_EXIT','N16','SP9','REPAIRING','N26'),
  a('NPC28','CITIZEN','PLAZA_CAM_D','THROUGH_TRAFFIC','N16',null,'WALKING','N26'),

  a('NPC29','CITIZEN','PLAZA_CAM_E','STATIC_HOLD',null,'E_STATIC_01','TALKING',null),
  a('NPC30','CITIZEN','PLAZA_CAM_E','STATIC_HOLD',null,'E_STATIC_02','IDLING',null),
  a('NPC31','CITIZEN','PLAZA_CAM_E','ENTER_AND_STAY','N02','E_STAY_01','WAITING',null),
  a('NPC32','CITIZEN','PLAZA_CAM_E','ENTER_AND_STAY','N02','E_STAY_02','EXERCISING',null),
  a('NPC33','CITIZEN','PLAZA_CAM_E','ENTER_HOLD_EXIT','N02','SP2','RESTING','N25'),
  a('NPC34','CITIZEN','PLAZA_CAM_E','ENTER_HOLD_EXIT','N02','E_ACTION_01','TALKING','N25'),
  a('NPC35','VILLAIN','PLAZA_CAM_E','THROUGH_TRAFFIC','N02',null,'ESCAPING','N25','STEALING'),
]) });

export const SCENARIO_POINT_NAMES = Object.freeze([
  'A_STATIC_01','A_STATIC_02','A_STAY_01','A_STAY_02','A_ACTION_01',
  'B_STATIC_01','B_STATIC_02','B_STAY_01','B_STAY_02',
  'C_STATIC_01','C_STATIC_02','C_STAY_01','C_STAY_02','C_ACTION_01',
  'D_STATIC_01','D_STATIC_02','D_STAY_01','D_STAY_02',
  'E_STATIC_01','E_STATIC_02','E_STAY_01','E_STAY_02','E_ACTION_01',
] as const);

export function loadNpcScenarioPoints(map:GrayboxMap):ReadonlyMap<string,AuthoredPoint> {
  const objects=mapObjects(map,'NPC_Scenario_Points'), expected=new Set<string>(SCENARIO_POINT_NAMES);
  if(objects.length!==expected.size||new Set(objects.map(point=>point.name)).size!==objects.length||objects.some(point=>!expected.has(point.name)))
    throw new Error('NPC_Scenario_Points must contain exactly the 23 approved unique names');
  const solids=mapObjects(map,'Collision'),world=mapWorld(map),points=new Map<string,AuthoredPoint>();
  for(const object of objects){
    if(!object.point||object.width!==0||object.height!==0)throw new Error(`${object.name} must be a Point Object`);
    if(!canOccupy(footprint(object.x,object.y,{width:26,height:16}),solids,world))throw new Error(`${object.name} cannot hold a Large 26x16 footprint`);
    points.set(object.name,Object.freeze({name:object.name,x:object.x,y:object.y}));
  }
  for(const [name,point] of points)for(const [otherName,other] of points)if(name<otherName&&overlaps(footprint(point.x,point.y,{width:26,height:16}),footprint(other.x,other.y,{width:26,height:16})))
    throw new Error(`${name} overlaps ${otherName}`);
  return points;
}

export const DEFAULT_ROUND1_CONFIG=Object.freeze({
  // Prototype knobs; final cadence/dwell remain TBD_BY_BROWSER_UX.
  admissionIntervalSeconds:.75,
  reentryDelaySeconds:3,
  transientHoldSeconds:4,
  maxRoadMovers:15,
});
export type Round1Config=Readonly<{admissionIntervalSeconds:number;reentryDelaySeconds:number;transientHoldSeconds:number;maxRoadMovers:number}>;
export type RoundNpcPhase='OFFSCREEN'|'MOVING_TO_TARGET'|'HOLDING'|'REJOINING'|'EXITING';
export type RoundNpcRuntime={
  definition:CharacterDefinition;
  assignment:RoundCharacterAssignment;
  character:CharacterRuntimeState;
  verifiedLabel:CharacterLabel|null;
  active:boolean;
  visible:boolean;
  phase:RoundNpcPhase;
  simulationTime:number;
  position:{x:number;y:number};
  currentNode:string;
  targetNode:string;
  path:NavigationPath;
  pathPointIndex:number;
  rejoinPath?:NavigationPath;
  rejoinNode?:string;
  stopPoint?:string;
  holdRemaining:number;
  admissionAt:number;
  currentObservationZone:RoundCameraId|null;
  transitionReservation?:string;
  blockedByNpc?:CharacterId;
  stalledCandidate:boolean;
  stallReports:Readonly<{simulationTime:number;targetNode:string;displacement:number}>[];
  watchdogAnchor:{time:number;x:number;y:number};
  config:{walkSpeed:number;runSpeed:number;footprint:Readonly<{width:number;height:number}>;watchdog:Readonly<{observationWindowSeconds:number;minimumDisplacement:number}>};
  pointPlan?:AuthoredPointMovementPlan;
  cycle:number;
};
export type Round1Group={
  scenario:RoundScenario;
  graph:NavigationGraph;
  laneRuntime:PlazaLaneRuntime;
  scenarioPoints:ReadonlyMap<string,AuthoredPoint>;
  cameras:readonly CameraZone[];
  npcs:RoundNpcRuntime[];
  pointPlans:ReadonlyMap<CharacterId,AuthoredPointMovementPlan>;
  elapsed:number;
  paused:boolean;
  config:Round1Config;
};

const primitive=(semantic:SemanticBehavior):BehaviorPrimitive=>
  ['RUNNING','ESCAPING'].includes(semantic)?'RUN':
  ['STEALING','SNATCHING','MANHOLE_TAMPER'].includes(semantic)?'SUSPICIOUS_ACTION':
  ['TALKING','THREATENING'].includes(semantic)?'TALK':semantic==='RESTING'?'REST':
  ['CAFE_SERVICE','REPAIRING','CARRYING_TOOLS','DELIVERING','EXERCISING'].includes(semantic)?'INTERACT':'IDLE';

function cameraAt(cameras:readonly CameraZone[],position:NavigationPoint):RoundCameraId|null {
  return (cameras.find(zone=>position.x>=zone.x&&position.x<zone.x+zone.width&&position.y>=zone.y&&position.y<zone.y+zone.height)?.name as RoundCameraId|undefined)??null;
}

function samePoint(a:NavigationPoint,b:NavigationPoint){return Math.hypot(a.x-b.x,a.y-b.y)<1e-5;}

export function createRound1Group(map:GrayboxMap,cameras:readonly CameraZone[],config:Round1Config=DEFAULT_ROUND1_CONFIG):Round1Group {
  if(cameras.length!==5||ROUND1_CAMERA_IDS.some(name=>!cameras.some(camera=>camera.name===name)))throw new Error('Round 1 requires PLAZA_CAM_A~E');
  const graph=loadNavigationV2(map),laneRuntime=createPlazaLaneRuntime(map,graph),scenarioPoints=loadNpcScenarioPoints(map);
  const moving=ROUND1_SCENARIO.assignments.filter(x=>x.initialState==='OFFSCREEN_STAGGERED');
  const npcs=ROUND1_SCENARIO.assignments.map(assignment=>{
    const definition=characterDefinition(assignment.characterId);
    if(!definition)throw new Error(`Missing definition ${assignment.characterId}`);
    const startName=assignment.entry??'N01',start=assignment.initialState==='STATIC_PRESENT'?scenarioPoints.get(assignment.target!)!:graph.nodes.get(startName)!;
    const character=createCharacterRuntimeState(definition,assignment.initialState==='STATIC_PRESENT'?'PLAZA':'OFFSCREEN');
    const runtime:RoundNpcRuntime={
      definition,assignment,character,verifiedLabel:null,
      active:assignment.initialState==='STATIC_PRESENT',visible:assignment.initialState==='STATIC_PRESENT',
      phase:assignment.initialState==='STATIC_PRESENT'?'HOLDING':'OFFSCREEN',simulationTime:0,
      position:{x:start.x,y:start.y},currentNode:startName,targetNode:startName,
      path:findNavigationPath(graph,startName,startName),pathPointIndex:1,holdRemaining:Infinity,
      admissionAt:assignment.initialState==='STATIC_PRESENT'?Infinity:(moving.indexOf(assignment)+1)*config.admissionIntervalSeconds,
      currentObservationZone:assignment.initialState==='STATIC_PRESENT'?cameraAt(cameras,start):null,
      stalledCandidate:false,stallReports:[],watchdogAnchor:{time:0,x:start.x,y:start.y},
      config:{walkSpeed:96,runSpeed:144,footprint:Object.freeze({width:26,height:16}),watchdog:Object.freeze({observationWindowSeconds:2,minimumDisplacement:1})},cycle:0,
    };
    if(assignment.historyBehavior)appendBehaviorHistory(character,-1,{primitive:primitive(assignment.historyBehavior),semantic:assignment.historyBehavior},'OFFSCREEN');
    if(runtime.active){
      if(laneRuntime.coordination.stopReservations.has(assignment.target!))throw new Error(`Duplicate Round 1 target ${assignment.target}`);
      laneRuntime.coordination.stopReservations.set(assignment.target!,assignment.characterId);
      appendBehaviorHistory(character,0,{primitive:primitive(assignment.mainBehavior),semantic:assignment.mainBehavior},assignment.target!);
    }
    return runtime;
  });
  const authored=[...scenarioPoints.values(),...laneRuntime.stops.values()];
  const pointPlans=new Map<CharacterId,AuthoredPointMovementPlan>();
  for(const assignment of ROUND1_SCENARIO.assignments.filter(candidate=>candidate.initialState==='OFFSCREEN_STAGGERED'&&candidate.target)){
    const point=pointFor({scenario:ROUND1_SCENARIO,graph,laneRuntime,scenarioPoints,cameras,npcs,pointPlans,elapsed:0,paused:false,config},assignment.target! )!;
    const entry=graph.nodes.get(assignment.entry!)!;
    const occupied=authored.filter(other=>other.name!==point.name).map(other=>footprint(other.x,other.y,{width:26,height:16}));
    const plan=reserveAuthoredPointMovementPlan(laneRuntime,point,assignment.entry!,entry,assignment.characterId,occupied);
    if(!plan)throw new Error(`${point.name} has no occupied-state-safe local connector`);
    pointPlans.set(assignment.characterId,plan);releaseStopReservation(laneRuntime,point.name,assignment.characterId);
  }
  return {scenario:ROUND1_SCENARIO,graph,laneRuntime,scenarioPoints,cameras,npcs,pointPlans,elapsed:0,paused:false,config};
}

const roadMoverCount=(group:Round1Group)=>group.npcs.filter(npc=>npc.active&&['MOVING_TO_TARGET','REJOINING','EXITING'].includes(npc.phase)).length;
const pointFor=(group:Round1Group,name:string)=>group.scenarioPoints.get(name)??group.laneRuntime.stops.get(name);

function admit(group:Round1Group,npc:RoundNpcRuntime){
  if(roadMoverCount(group)>=group.config.maxRoadMovers)return false;
  if(npc.cycle>0&&group.npcs.some(other=>other.assignment.lifecycle==='ENTER_AND_STAY'&&other.phase!=='HOLDING'))return false;
  const {assignment}=npc,entry=group.graph.nodes.get(assignment.entry!);
  if(!entry)return false;
  if(group.npcs.some(other=>other!==npc&&other.active&&other.assignment.entry===assignment.entry&&['MOVING_TO_TARGET','REJOINING','EXITING'].includes(other.phase)))return false;
  if(assignment.lifecycle==='ENTER_AND_STAY'&&group.npcs.some(other=>other!==npc&&other.assignment.lifecycle==='ENTER_AND_STAY'&&other.assignment.homeObservationZone===assignment.homeObservationZone&&other.active&&other.phase!=='HOLDING'))return false;
  const entryBody=footprint(entry.x,entry.y,npc.config.footprint);
  if(group.npcs.some(other=>other!==npc&&other.active&&other.visible&&overlaps(entryBody,footprint(other.position.x,other.position.y,other.config.footprint))))return false;
  let plan:AuthoredPointMovementPlan|undefined;
  if(assignment.target){
    const owner=group.laneRuntime.coordination.stopReservations.get(assignment.target);
    if(owner!==undefined&&owner!==assignment.characterId)return false;
    plan=group.pointPlans.get(assignment.characterId);
    if(!plan)return false;
    group.laneRuntime.coordination.stopReservations.set(assignment.target,assignment.characterId);
  }
  npc.active=true;npc.visible=true;npc.character.world.currentZone='PLAZA';npc.position={x:entry.x,y:entry.y};npc.currentNode=assignment.entry!;
  npc.pointPlan=plan;npc.stopPoint=assignment.target??undefined;npc.rejoinPath=plan?.rejoin;npc.rejoinNode=plan?.rejoinNode;
  npc.phase=plan?'MOVING_TO_TARGET':'EXITING';
  npc.path=plan?.approach??lanePath(group.laneRuntime,findNavigationPath(group.graph,assignment.entry!,assignment.exit!),entry);
  npc.targetNode=plan?.approachNode??assignment.exit!;npc.pathPointIndex=Math.min(1,npc.path.points.length);npc.stalledCandidate=false;
  npc.watchdogAnchor={time:npc.simulationTime,...npc.position};
  appendBehaviorHistory(npc.character,npc.simulationTime,{primitive:'ENTER',semantic:'ENTERING'},assignment.entry!);
  npc.character.world.currentBehavior={primitive:assignment.mainBehavior==='ESCAPING'?'RUN':'WALK',semantic:assignment.mainBehavior==='ESCAPING'?'ESCAPING':'WALKING'};
  return true;
}

function releaseTransition(npc:RoundNpcRuntime,lanes:PlazaLaneRuntime){
  if(npc.transitionReservation&&lanes.coordination.transitionReservations.get(npc.transitionReservation)===npc.assignment.characterId)
    lanes.coordination.transitionReservations.delete(npc.transitionReservation);
  npc.transitionReservation=undefined;
}

function startExit(group:Round1Group,npc:RoundNpcRuntime){
  npc.phase='EXITING';npc.path=lanePath(group.laneRuntime,findNavigationPath(group.graph,npc.currentNode,npc.assignment.exit!),npc.position);
  npc.targetNode=npc.assignment.exit!;npc.pathPointIndex=Math.min(1,npc.path.points.length);
}

function goOffscreen(group:Round1Group,npc:RoundNpcRuntime){
  releaseTransition(npc,group.laneRuntime);npc.active=false;npc.visible=false;npc.phase='OFFSCREEN';npc.currentObservationZone=null;
  npc.character.world.currentZone='OFFSCREEN';npc.cycle++;npc.admissionAt=group.elapsed+group.config.reentryDelaySeconds+group.config.admissionIntervalSeconds;
  appendBehaviorHistory(npc.character,npc.simulationTime,{primitive:'EXIT',semantic:npc.assignment.mainBehavior==='ESCAPING'?'ESCAPING':'COMMUTING'},npc.assignment.exit!);
}

function arrived(group:Round1Group,npc:RoundNpcRuntime){
  releaseTransition(npc,group.laneRuntime);
  if(npc.phase==='MOVING_TO_TARGET'){
    npc.phase='HOLDING';npc.position={...npc.path.points.at(-1)!};npc.holdRemaining=npc.assignment.lifecycle==='ENTER_AND_STAY'?Infinity:group.config.transientHoldSeconds;
    appendBehaviorHistory(npc.character,npc.simulationTime,{primitive:primitive(npc.assignment.mainBehavior),semantic:npc.assignment.mainBehavior},npc.assignment.target!);
  }else if(npc.phase==='REJOINING'){
    npc.currentNode=npc.rejoinNode!;
    if(npc.stopPoint)releaseStopReservation(group.laneRuntime,npc.stopPoint,npc.assignment.characterId);
    npc.stopPoint=undefined;npc.pointPlan=undefined;npc.rejoinPath=undefined;npc.rejoinNode=undefined;startExit(group,npc);
  }else if(npc.phase==='EXITING')goOffscreen(group,npc);
}

function move(group:Round1Group,npc:RoundNpcRuntime,delta:number,blockers:readonly Bounds[]){
  let remaining=(npc.assignment.mainBehavior==='ESCAPING'?npc.config.runSpeed:npc.config.walkSpeed)*delta;
  while(remaining>0&&npc.pathPointIndex<npc.path.points.length){
    if(npc.transitionReservation&&npc.phase!=='REJOINING'){
      const held=npc.path.junctionTransitions?.find(x=>`ROUND:${x.node}`===npc.transitionReservation);
      if(!held||npc.pathPointIndex>held.endIndex+64)releaseTransition(npc,group.laneRuntime);
    }
    const transition=npc.transitionReservation?undefined:npc.path.junctionTransitions?.find(x=>npc.pathPointIndex>=Math.max(0,x.startIndex-64)&&npc.pathPointIndex<=x.endIndex);
    const transitionKey=transition?`ROUND:${transition.node}`:undefined;
    if(transition&&npc.transitionReservation!==transitionKey){
      const owner=group.laneRuntime.coordination.transitionReservations.get(transitionKey!);
      if(owner&&owner!==npc.assignment.characterId)break;
      group.laneRuntime.coordination.transitionReservations.set(transitionKey!,npc.assignment.characterId);npc.transitionReservation=transitionKey;
    }
    const target=npc.path.points[npc.pathPointIndex],dx=target.x-npc.position.x,dy=target.y-npc.position.y,length=Math.hypot(dx,dy),step=Math.min(remaining,length);
    const next=length<=step?target:{x:npc.position.x+dx/length*step,y:npc.position.y+dy/length*step};
    if(!canOccupy(sweptFootprint(npc.position,next,npc.config.footprint),[...blockers],mapWorld(group.laneRuntime.map)))break;
    npc.position={...next};remaining-=step;if(length<=step)npc.pathPointIndex++;
  }
  if(npc.pathPointIndex>=npc.path.points.length)arrived(group,npc);
}

function observe(group:Round1Group,npc:RoundNpcRuntime){
  if(!npc.active||!npc.visible)return;
  const zone=cameraAt(group.cameras,npc.position);
  if(zone!==npc.currentObservationZone){npc.currentObservationZone=zone;if(zone)appendBehaviorHistory(npc.character,npc.simulationTime,npc.character.world.currentBehavior,zone);}
}

export function stepRound1Group(group:Round1Group,deltaSeconds:number,external:readonly Bounds[]=[]){
  if(group.paused||deltaSeconds<=0)return;
  const delta=Math.min(deltaSeconds,.05);group.elapsed+=delta;
  for(const npc of group.npcs)npc.simulationTime+=delta;
  const priority=(npc:RoundNpcRuntime)=>npc.assignment.lifecycle==='ENTER_AND_STAY'?0:npc.assignment.lifecycle==='ENTER_HOLD_EXIT'?1:2;
  for(const npc of group.npcs.filter(candidate=>candidate.phase==='OFFSCREEN'&&candidate.admissionAt<=group.elapsed)
    .sort((left,right)=>Number(left.cycle>0)-Number(right.cycle>0)||priority(left)-priority(right)||left.admissionAt-right.admissionAt||left.assignment.characterId.localeCompare(right.assignment.characterId)))admit(group,npc);
  const solids=mapObjects(group.laneRuntime.map,'Collision');
  for(const npc of group.npcs){
    if(!npc.active)continue;
    if(npc.phase==='HOLDING'&&npc.assignment.lifecycle==='ENTER_HOLD_EXIT'){
      npc.holdRemaining-=delta;
      const rejoinKey=`ROUND:${npc.rejoinNode}`;
      const rejoinOwner=group.laneRuntime.coordination.transitionReservations.get(rejoinKey);
      if(npc.holdRemaining<=0&&roadMoverCount(group)<group.config.maxRoadMovers&&(!rejoinOwner||rejoinOwner===npc.assignment.characterId)){
        group.laneRuntime.coordination.transitionReservations.set(rejoinKey,npc.assignment.characterId);npc.transitionReservation=rejoinKey;
        npc.phase='REJOINING';npc.path=npc.rejoinPath!;npc.pathPointIndex=Math.min(1,npc.path.points.length);npc.targetNode=npc.rejoinNode!;
      }
    }
    if(['MOVING_TO_TARGET','REJOINING','EXITING'].includes(npc.phase)){
      const others=group.npcs.filter(other=>other!==npc&&other.active&&other.visible).map(other=>footprint(other.position.x,other.position.y,other.config.footprint));
      const before={...npc.position};move(group,npc,delta,[...solids,...external,...others]);
      npc.blockedByNpc=group.npcs.find(other=>other!==npc&&other.active&&other.visible&&samePoint(npc.position,before)&&overlaps(footprint(npc.position.x,npc.position.y,npc.config.footprint),footprint(other.position.x,other.position.y,other.config.footprint)))?.assignment.characterId;
      const elapsed=npc.simulationTime-npc.watchdogAnchor.time;
      if(elapsed>=npc.config.watchdog.observationWindowSeconds){
        const displacement=Math.hypot(npc.position.x-npc.watchdogAnchor.x,npc.position.y-npc.watchdogAnchor.y);npc.stalledCandidate=displacement<npc.config.watchdog.minimumDisplacement;
        if(npc.stalledCandidate)npc.stallReports.push(Object.freeze({simulationTime:npc.simulationTime,targetNode:npc.targetNode,displacement}));
        npc.watchdogAnchor={time:npc.simulationTime,...npc.position};
      }
    }
    observe(group,npc);
  }
}

export function verifyRoundTrainingSample(npc:RoundNpcRuntime){
  if(npc.character.labels.userLabel===null)throw new Error(`${npc.assignment.characterId} must be manually labeled before verification`);
  npc.verifiedLabel=npc.assignment.actualLabel;
}

export function round1TrainingState(group:Round1Group){
  const manuallyLabeled=group.npcs.filter(npc=>npc.character.labels.userLabel!==null);
  const verified=group.npcs.filter(npc=>npc.verifiedLabel!==null);
  return Object.freeze({
    manualLabeledDistinctCount:new Set(manuallyLabeled.map(npc=>npc.assignment.characterId)).size,
    verifiedTrainingSampleCount:new Set(verified.map(npc=>npc.assignment.characterId)).size,
    trainingReady:verified.length>=8&&new Set(verified.map(npc=>npc.verifiedLabel)).size===2,
  });
}
