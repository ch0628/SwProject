import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { characterDefinition, createCharacterRuntimeState } from '../src/characterPool.ts';
import {
  isInsideCameraZone, loadCameraZones, manualCharacterView, setUserLabel, visibleCharactersForZone,
} from '../src/cctvManualLabeling.ts';
import type { GrayboxMap } from '../src/plazaPark.ts';
import { createPlazaNpcRuntime } from '../src/plazaNpcRuntime.ts';
import { createDestinationResolver, loadNavigationV2 } from '../src/plazaNavigationV2.ts';

const map:GrayboxMap=JSON.parse(readFileSync(new URL('../public/maps/plaza-park-v2.tmj',import.meta.url),'utf8'));
const zones=loadCameraZones(map);
const graph=loadNavigationV2(map),resolver=createDestinationResolver(map,graph);

test('Camera_Zone loads the five authored Coverage rectangles',()=>{
  assert.deepEqual(zones,[
    {name:'PLAZA_CAM_A',x:322,y:91,width:800,height:600},
    {name:'PLAZA_CAM_B',x:1370,y:842,width:800,height:600},
    {name:'PLAZA_CAM_C',x:449,y:1118,width:800,height:600},
    {name:'PLAZA_CAM_D',x:2261,y:375,width:800,height:600},
    {name:'PLAZA_CAM_E',x:1200,y:170,width:800,height:600},
  ]);
  assert.ok(zones.every(zone=>zone.width>0&&zone.height>0));
});

test('feet-position visibility enters and exits a selected Camera_Zone',()=>{
  const npc=createPlazaNpcRuntime(characterDefinition('NPC07')!,'N01',graph,resolver);
  const zone=zones[0];
  npc.position={x:zone.x-1,y:zone.y};
  assert.equal(visibleCharactersForZone([npc],zone).length,0);
  npc.position={x:zone.x+zone.width/2,y:zone.y+zone.height/2};
  assert.equal(visibleCharactersForZone([npc],zone)[0],npc);
  npc.position={x:zone.x+zone.width,y:zone.y+zone.height/2};
  assert.equal(visibleCharactersForZone([npc],zone).length,0);
});

test('only visible NPCs are selectable by the same membership predicate',()=>{
  const npc=createPlazaNpcRuntime(characterDefinition('NPC07')!,'N01',graph,resolver),zone=zones[0];
  npc.position={x:zone.x+1,y:zone.y+1};
  assert.ok(visibleCharactersForZone([npc],zone).includes(npc));
  npc.position={x:zone.x-1,y:zone.y};
  assert.ok(!visibleCharactersForZone([npc],zone).includes(npc));
});

test('user label is mutable with no lock',()=>{
  const runtime=createCharacterRuntimeState(characterDefinition('NPC07')!);
  assert.equal(runtime.labels.userLabel,null);
  for(const label of ['CITIZEN','VILLAIN','CITIZEN'] as const)setUserLabel(runtime,label);
  assert.equal(runtime.labels.userLabel,'CITIZEN');
});

test('user label persists while one runtime moves between CCTV zones',()=>{
  const npc=createPlazaNpcRuntime(characterDefinition('NPC20')!,'N01',graph,resolver);
  npc.position={x:zones[0].x+1,y:zones[0].y+1};
  setUserLabel(npc.character,'CITIZEN');
  npc.position={x:zones[1].x+zones[1].width-1,y:zones[1].y+zones[1].height-1};
  assert.equal(isInsideCameraZone(npc.position,zones[1]),true);
  assert.equal(npc.character.labels.userLabel,'CITIZEN');
});

test('UI-facing selected-character model does not leak truth or AI fields',()=>{
  const npc=createPlazaNpcRuntime(characterDefinition('NPC07')!,'N01',graph,resolver);
  const view=manualCharacterView(npc);
  assert.deepEqual(Object.keys(view).sort(),['currentBehavior','currentZone','id','userLabel']);
  const serialized=JSON.stringify(view);
  for(const forbidden of ['verifiedLabel','aiLabel','aiConfidence'])assert.equal(serialized.includes(forbidden),false);
});
