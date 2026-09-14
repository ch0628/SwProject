import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { canOccupy, footprint, overlaps } from '../src/collision.ts';
import { loadCameraZones, setUserLabel, visibleCharactersForZone } from '../src/cctvManualLabeling.ts';
import { mapObjects, mapWorld, type GrayboxMap } from '../src/plazaPark.ts';
import {
  createRound1Group, loadNpcScenarioPoints, ROUND1_SCENARIO, round1TrainingState,
  SCENARIO_POINT_NAMES, stepRound1Group, verifyRoundTrainingSample,
} from '../src/plazaRound1.ts';

const map:GrayboxMap=JSON.parse(readFileSync(new URL('../public/maps/plaza-park-v2.tmj',import.meta.url),'utf8'));
const cameras=loadCameraZones(map),solids=mapObjects(map,'Collision'),world=mapWorld(map);

test('A: PLAZA_CAM_A~E load exactly from TMJ geometry',()=>{
  assert.deepEqual(cameras,mapObjects(map,'Camera_Zone').filter(object=>object.type==='Coverage').sort((a,b)=>a.name.localeCompare(b.name)).map(({name,x,y,width,height})=>({name,x,y,width,height})));
  assert.deepEqual(cameras.map(camera=>camera.name),['PLAZA_CAM_A','PLAZA_CAM_B','PLAZA_CAM_C','PLAZA_CAM_D','PLAZA_CAM_E']);
});

test('B/C: 23 authored Scenario Points are unique, collision-safe and non-overlapping',()=>{
  const points=loadNpcScenarioPoints(map);
  assert.equal(points.size,23);assert.deepEqual([...points.keys()].sort(),[...SCENARIO_POINT_NAMES].sort());
  for(const point of points.values())assert.ok(canOccupy(footprint(point.x,point.y,{width:26,height:16}),solids,world),point.name);
  const values=[...points.values()];
  for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++)assert.equal(overlaps(footprint(values[i].x,values[i].y,{width:26,height:16}),footprint(values[j].x,values[j].y,{width:26,height:16})),false,`${values[i].name}/${values[j].name}`);
  assert.equal(createRound1Group(map,cameras).pointPlans.size,20);
});

test('D: approved Round 1 assignment distributions are exact',()=>{
  const assignments=ROUND1_SCENARIO.assignments;
  assert.equal(assignments.length,35);assert.equal(new Set(assignments.map(item=>item.characterId)).size,35);
  assert.deepEqual(Object.fromEntries(['CITIZEN','VILLAIN'].map(label=>[label,assignments.filter(item=>item.actualLabel===label).length])),{CITIZEN:28,VILLAIN:7});
  assert.deepEqual(assignments.filter(item=>item.actualLabel==='VILLAIN').map(item=>item.characterId),['NPC01','NPC10','NPC12','NPC18','NPC19','NPC25','NPC35']);
  assert.deepEqual(Object.fromEntries(cameras.map(camera=>[camera.name,assignments.filter(item=>item.homeObservationZone===camera.name).length])),{PLAZA_CAM_A:7,PLAZA_CAM_B:7,PLAZA_CAM_C:7,PLAZA_CAM_D:7,PLAZA_CAM_E:7});
  assert.deepEqual(Object.fromEntries(cameras.map(camera=>[camera.name,assignments.filter(item=>item.homeObservationZone===camera.name&&item.actualLabel==='VILLAIN').length])),{PLAZA_CAM_A:1,PLAZA_CAM_B:2,PLAZA_CAM_C:2,PLAZA_CAM_D:1,PLAZA_CAM_E:1});
  assert.deepEqual(Object.fromEntries(['STATIC_HOLD','ENTER_AND_STAY','ENTER_HOLD_EXIT','THROUGH_TRAFFIC'].map(lifecycle=>[lifecycle,assignments.filter(item=>item.lifecycle===lifecycle).length])),{STATIC_HOLD:10,ENTER_AND_STAY:10,ENTER_HOLD_EXIT:10,THROUGH_TRAFFIC:5});
});

test('E-K: lifecycles remain physical, persistent and identity-stable',()=>{
  const group=createRound1Group(map,cameras),phases=new Map(group.npcs.map(npc=>[npc.assignment.characterId,new Set([npc.phase])])),initialHome=new Map(group.npcs.map(npc=>[npc.assignment.characterId,npc.assignment.homeObservationZone]));
  const labeled=group.npcs.find(npc=>npc.assignment.characterId==='NPC35')!;setUserLabel(labeled.character,'VILLAIN');
  let overlapCount=0,fixedCount=0,peakRoadMovers=0,sawReservedRejoin=false,sawReleasedAfterRejoin=false;
  for(let frame=0;frame<12000;frame++){
    stepRound1Group(group,.05);const visible=group.npcs.filter(npc=>npc.active&&npc.visible);
    peakRoadMovers=Math.max(peakRoadMovers,visible.filter(npc=>['MOVING_TO_TARGET','REJOINING','EXITING'].includes(npc.phase)).length);
    for(const npc of group.npcs)phases.get(npc.assignment.characterId)!.add(npc.phase);
    const hold=group.npcs.find(npc=>npc.assignment.characterId==='NPC12')!;
    if(hold.phase==='REJOINING'&&group.laneRuntime.coordination.stopReservations.get('SP5')==='NPC12')sawReservedRejoin=true;
    if(sawReservedRejoin&&!group.laneRuntime.coordination.stopReservations.has('SP5')&&['EXITING','OFFSCREEN'].includes(hold.phase))sawReleasedAfterRejoin=true;
    for(let i=0;i<visible.length;i++){
      const body=footprint(visible[i].position.x,visible[i].position.y,visible[i].config.footprint);
      if(solids.some(solid=>overlaps(body,solid)))fixedCount++;
      for(let j=i+1;j<visible.length;j++)if(overlaps(body,footprint(visible[j].position.x,visible[j].position.y,visible[j].config.footprint)))overlapCount++;
    }
  }
  const statics=group.npcs.filter(npc=>npc.assignment.lifecycle==='STATIC_HOLD');
  assert.ok(statics.every(npc=>npc.phase==='HOLDING'&&npc.position.x===group.scenarioPoints.get(npc.assignment.target!)!.x&&npc.position.y===group.scenarioPoints.get(npc.assignment.target!)!.y));
  assert.ok(group.npcs.filter(npc=>npc.assignment.lifecycle==='ENTER_AND_STAY').every(npc=>npc.phase==='HOLDING'));
  for(const npc of group.npcs.filter(npc=>npc.assignment.lifecycle==='ENTER_HOLD_EXIT'))for(const phase of ['MOVING_TO_TARGET','HOLDING','REJOINING','EXITING','OFFSCREEN'])assert.ok(phases.get(npc.assignment.characterId)!.has(phase as never),`${npc.assignment.characterId}:${phase}`);
  for(const npc of group.npcs.filter(npc=>npc.assignment.lifecycle==='THROUGH_TRAFFIC')){assert.equal(npc.assignment.target,null);assert.ok(phases.get(npc.assignment.characterId)!.has('EXITING'));assert.ok(phases.get(npc.assignment.characterId)!.has('OFFSCREEN'));}
  assert.equal(sawReservedRejoin,true);assert.equal(sawReleasedAfterRejoin,true);
  assert.equal(fixedCount,0);assert.equal(overlapCount,0);assert.ok(peakRoadMovers<=15);
  assert.ok(group.npcs.filter(npc=>npc.assignment.reEntryPolicy==='SAME_IDENTITY').every(npc=>npc.cycle>=1));
  assert.equal(labeled.character.labels.userLabel,'VILLAIN');assert.equal(labeled.definition.id,'NPC35');
  assert.ok(group.npcs.every(npc=>npc.assignment.homeObservationZone===initialHome.get(npc.assignment.characterId)));
  const crossing=group.npcs.find(npc=>npc.assignment.characterId==='NPC07')!,zoneB=cameras[1];crossing.active=true;crossing.visible=true;crossing.position={x:zoneB.x+1,y:zoneB.y+1};
  assert.ok(visibleCharactersForZone([crossing],zoneB).includes(crossing));assert.equal(crossing.assignment.homeObservationZone,'PLAZA_CAM_A');
});

test('I: busy authored target defers offscreen and retries without road waiting',()=>{
  const group=createRound1Group(map,cameras),npc=group.npcs.find(candidate=>candidate.assignment.characterId==='NPC03')!;
  for(const other of group.npcs)if(other!==npc&&!other.active)other.admissionAt=Infinity;
  npc.admissionAt=0;group.laneRuntime.coordination.stopReservations.set('A_STAY_01','BLOCKER');
  for(let frame=0;frame<40;frame++)stepRound1Group(group,.05);
  assert.equal(npc.phase,'OFFSCREEN');assert.equal(npc.active,false);
  group.laneRuntime.coordination.stopReservations.delete('A_STAY_01');stepRound1Group(group,.05);
  assert.equal(npc.phase,'MOVING_TO_TARGET');assert.equal(group.laneRuntime.coordination.stopReservations.get('A_STAY_01'),'NPC03');
});

test('L: only eight distinct verified samples with label diversity activate trainingReady',()=>{
  const group=createRound1Group(map,cameras),sampleIds=['NPC01','NPC02','NPC03','NPC04','NPC05','NPC06','NPC07','NPC08'];
  for(const id of sampleIds){const npc=group.npcs.find(candidate=>candidate.assignment.characterId===id)!;setUserLabel(npc.character,'CITIZEN');}
  const repeated=group.npcs.find(npc=>npc.assignment.characterId==='NPC02')!;setUserLabel(repeated.character,'VILLAIN');setUserLabel(repeated.character,'CITIZEN');
  assert.deepEqual(round1TrainingState(group),{manualLabeledDistinctCount:8,verifiedTrainingSampleCount:0,trainingReady:false});
  for(const id of sampleIds.slice(0,7))verifyRoundTrainingSample(group.npcs.find(npc=>npc.assignment.characterId===id)!);
  assert.equal(round1TrainingState(group).trainingReady,false);
  verifyRoundTrainingSample(group.npcs.find(npc=>npc.assignment.characterId===sampleIds[7])!);
  assert.deepEqual(round1TrainingState(group),{manualLabeledDistinctCount:8,verifiedTrainingSampleCount:8,trainingReady:true});
});
