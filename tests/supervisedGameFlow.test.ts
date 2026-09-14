import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createGameFlow, canStartRetraining, canStartFinalScan, startFinalScan, completeFinalScan,
  labelAndVerifyRound1Sample, recordMonitoringVerification,
} from '../src/supervisedGameFlow.ts';
import {
  applyRound2ToGroup, MONITORING_TARGET_IDS, prepareMonitoringTargets, round2TargetStatus,
  round2TrainingState, submitRound2Comparison, verifyMonitoringTarget, ROUND2_COMPARISON_PLAN, ROUND2_ROWS,
} from '../src/plazaRound2.ts';
import { createRound1Group, round1TrainingState, verifyRoundTrainingSample } from '../src/plazaRound1.ts';
import { loadCameraZones } from '../src/cctvManualLabeling.ts';
import type { GrayboxMap } from '../src/plazaPark.ts';

const map:GrayboxMap=JSON.parse(readFileSync(new URL('../public/maps/plaza-park-v2.tmj',import.meta.url),'utf8'));
const cameras=loadCameraZones(map);
const createRound2=()=>{
  const group=createRound1Group(map,cameras);
  applyRound2ToGroup(group,map,cameras);
  return group;
};

test('Round 1 label choice verifies immediately without copying the user label',()=>{
  const group=createRound1Group(map,cameras);
  const npc=group.npcs[0];
  const userLabel=npc.assignment.actualLabel==='CITIZEN'?'VILLAIN':'CITIZEN';
  const actual=labelAndVerifyRound1Sample(npc,userLabel);
  assert.equal(round1TrainingState(group).verifiedTrainingSampleCount,1);
  assert.equal(actual,npc.assignment.actualLabel);
  assert.equal(npc.character.labels.userLabel,userLabel);
  assert.equal(npc.verifiedLabel,npc.assignment.actualLabel);
  assert.notEqual(npc.character.labels.userLabel,npc.verifiedLabel);
});

test('Round 2 targets, focus zones, statuses, agreement and disagreement gates',()=>{
  const expected=['NPC08','NPC10','NPC18','NPC20','NPC23','NPC27','NPC31','NPC06'];
  assert.deepEqual(ROUND2_COMPARISON_PLAN.map(entry=>entry.characterId),expected);
  const cameraNames=new Set(cameras.map(camera=>camera.name));
  for(const id of expected){
    const row=ROUND2_ROWS.find(candidate=>candidate.characterId===id)!;
    assert.equal(row.lifecycle,'STATIC_HOLD',id);
    assert.ok(cameraNames.has(row.homeObservationZone),`${id} focus camera`);
  }

  const group=createRound2();
  const agreement=group.npcs.find(npc=>npc.assignment.characterId==='NPC10')!;
  assert.equal(round2TargetStatus(agreement),'WAITING');
  assert.equal(submitRound2Comparison(agreement,'CITIZEN'),'VERIFIED');
  assert.equal(agreement.verifiedLabel,'CITIZEN','agreement auto verifies');

  const disagreement=group.npcs.find(npc=>npc.assignment.characterId==='NPC08')!;
  assert.equal(submitRound2Comparison(disagreement,'VILLAIN'),'TRACKING_REQUIRED');
  assert.equal(disagreement.verifiedLabel,null);
  verifyRoundTrainingSample(disagreement);
  assert.equal(round2TargetStatus(disagreement),'VERIFIED','tracking confirmation verifies disagreement');
});

test('Retraining requires all 8 verifications and all 3 corrections',()=>{
  const group=createRound2();
  const wrongIds=['NPC08','NPC20','NPC27'];
  for(const plan of ROUND2_COMPARISON_PLAN){
    const npc=group.npcs.find(candidate=>candidate.assignment.characterId===plan.characterId)!;
    submitRound2Comparison(npc,npc.assignment.actualLabel);
  }
  for(const id of wrongIds.slice(0,2))verifyRoundTrainingSample(group.npcs.find(npc=>npc.assignment.characterId===id)!);
  const seven=round2TrainingState(group);
  assert.deepEqual({compared:seven.comparedCount,verified:seven.verifiedCount,ready:seven.retrainingReady},{compared:8,verified:7,ready:false});
  const flow=createGameFlow();flow.phase='HUMAN_AI_COMPARE';
  assert.equal(canStartRetraining(flow,seven),false);

  verifyRoundTrainingSample(group.npcs.find(npc=>npc.assignment.characterId==='NPC27')!);
  const ready=round2TrainingState(group);
  assert.deepEqual({compared:ready.comparedCount,verified:ready.verifiedCount,corrections:ready.aiWrongVerifiedCount,ready:ready.retrainingReady},{compared:8,verified:8,corrections:3,ready:true});
  assert.equal(canStartRetraining(flow,ready),true);
});

test('Monitoring counts only the three distinct configured targets',()=>{
  assert.deepEqual([...MONITORING_TARGET_IDS],['NPC15','NPC16','NPC26']);
  const flow=createGameFlow();flow.phase='AI_ASSISTED_MONITORING';
  for(const id of ['NPC01','NPC15','NPC15','NPC16'] as const)recordMonitoringVerification(flow,id);
  assert.deepEqual(flow.aiMonitorVerifiedIds,['NPC15','NPC16']);
  assert.equal(canStartFinalScan(flow),false);
  recordMonitoringVerification(flow,'NPC26');
  assert.equal(canStartFinalScan(flow),true);
  startFinalScan(flow);
  assert.equal(flow.phase,'FINAL_SCAN');
  completeFinalScan(flow);
  assert.equal(flow.phase,'COMPLETE');
  assert.equal(flow.scanComplete,true);
});

test('Monitoring targets are held visibly in focusable home observation zones',()=>{
  const group=createRound2();
  const cameraNames=new Set(cameras.map(camera=>camera.name));
  for(const id of MONITORING_TARGET_IDS){
    const npc=group.npcs.find(candidate=>candidate.assignment.characterId===id)!;
    npc.active=false;npc.visible=false;npc.currentObservationZone=null;
  }
  prepareMonitoringTargets(group);
  for(const id of MONITORING_TARGET_IDS){
    const npc=group.npcs.find(candidate=>candidate.assignment.characterId===id)!;
    assert.equal(npc.active,true,id);assert.equal(npc.visible,true,id);
    assert.equal(npc.phase,'HOLDING',id);assert.equal(npc.currentObservationZone,npc.assignment.homeObservationZone,id);
    assert.ok(cameraNames.has(npc.currentObservationZone!),`${id} focus camera`);
    assert.equal(npc.character.labels.userLabel,null,id);
    assert.equal(verifyMonitoringTarget(npc),npc.assignment.actualLabel,id);
    assert.equal(npc.verifiedLabel,npc.assignment.actualLabel,id);
    assert.equal(npc.character.labels.userLabel,null,`${id} keeps user label separate`);
  }
});
