import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { canNavigate, footprint, overlaps } from '../src/collision.ts';
import { ARCHITECTURE_CLEARANCE,TIGER_FOOTPRINT } from '../src/config.ts';
import { canStand,mapObjects,mapWorld,moveProbe,plazaArchitecture,enterDoor,type GrayboxMap } from '../src/plazaPark.ts';
import { createSmoke,stepSmoke,SMOKE_ROUTES,SMOKE_SIZES,type RouteId } from '../src/plazaTraffic.ts';

const map:GrayboxMap=JSON.parse(readFileSync(new URL('../public/maps/plaza-park.tmj',import.meta.url),'utf8'));
const solids=mapObjects(map,'Collision'),world=mapWorld(map),architecture=solids.filter(o=>o.type==='Building'||o.type==='Fence');
const points=mapObjects(map,'Navigation').filter(o=>o.type==='Waypoint');
test('Large clearance observation keeps physical and architectural results separate',()=>{
  for(const p of points){
    assert.ok(canStand(p.x,p.y,solids,world));
    console.log(JSON.stringify({waypoint:p.name,physical:true,large:canNavigate(p.x,p.y,TIGER_FOOTPRINT,solids,world,architecture,ARCHITECTURE_CLEARANCE.large)}));
  }
  // These are discovered limitations, not coordinates to shift silently.
  for(const id of ['W04','W07','W17','W18','W19']){
    const p=points.find(p=>p.name===id)!;
    assert.equal(canNavigate(p.x,p.y,TIGER_FOOTPRINT,solids,world,architecture,ARCHITECTURE_CLEARANCE.large),false,id);
  }
  for(const [start,dx,dy] of [[{x:720,y:1296},-1,0],[{x:2720,y:640},0,-1]] as const){
    let p={...start};
    for(let i=0;i<200;i++){
      p=moveProbe(p,dx,dy,50,solids,world,architecture);
      assert.ok(canNavigate(p.x,p.y,TIGER_FOOTPRINT,solids,world,architecture,ARCHITECTURE_CLEARANCE.large));
    }
    console.log(JSON.stringify({largeDoorStop:p}));
    assert.deepEqual(moveProbe(p,dx,dy,50,solids,world,architecture),p);
  }
});
test('single NPC baseline for each existing-waypoint route, bounded 120 seconds',()=>{
  for(const route of Object.keys(SMOKE_ROUTES) as RouteId[]){
    const run=createSmoke(map,route);run.npcs=run.npcs.slice(0,1);
    for(let i=0;i<3600;i++){
      stepSmoke(run,map,1/30);
      const n=run.npcs[0];assert.ok(canStand(n.x,n.y,solids,world));
    }
    const n=run.npcs[0];
    console.log(JSON.stringify({baseline:route,trips:n.trips,arrivals:n.arrivals,wait:n.longestWait,blocked:n.blockedBy,target:SMOKE_ROUTES[route][n.target]}));
    assert.ok(n.trips>=1,`${route}: must complete without traffic`);
  }
});
test('10 mixed NPCs: 120s physical safety; report congestion honestly',()=>{
  for(const fps of [60]){
    const run=createSmoke(map);assert.equal(run.npcs.length,10);
    for(let i=0;i<120*fps;i++){
      const before=run.npcs.map(n=>({x:n.x,y:n.y}));
      stepSmoke(run,map,1/fps);
      for(const [j,n] of run.npcs.entries()){
        const f=footprint(n.x,n.y,SMOKE_SIZES[n.size]);
        assert.ok(!solids.some(o=>overlaps(f,o)));
        assert.ok(n.inside||!run.npcs.some(o=>o!==n&&!o.inside&&overlaps(f,footprint(o.x,o.y,SMOKE_SIZES[o.size]))));
        assert.ok(Math.hypot(n.x-before[j].x,n.y-before[j].y)<=48/fps+.0001);
      }
    }
    for(const route of Object.keys(SMOKE_ROUTES) as RouteId[]){
      const ns=run.npcs.filter(n=>n.route===route);
      console.log(JSON.stringify({mixed:route,fps,trips:ns.reduce((s,n)=>s+n.trips,0),arrivals:ns.reduce((s,n)=>s+n.arrivals,0),longestWait:Number(Math.max(...ns.map(n=>n.longestWait)).toFixed(2)),blocked:ns.map(n=>({id:n.id,by:n.blockedBy,target:SMOKE_ROUTES[n.route][n.target]}))}));
    }
  }
});
test('v2 physical Door Enter and low Fence semantics, unchanged solid bounds',()=>{
  for(const id of ['W04','W07','W17','W18','W19']){
    const p=points.find(p=>p.name===id)!;
    assert.ok(canNavigate(p.x,p.y,TIGER_FOOTPRINT,solids,world,plazaArchitecture(map,p.x,p.y),ARCHITECTURE_CLEARANCE.large));
  }
  for(const [id,dx,dy,name] of [['W16',-1,0,'Cafe'],['W06',0,-1,'Facility']] as const){
    let p={...points.find(p=>p.name===id)!},entered:string|undefined;
    for(let i=0;i<100&&!entered;i++){
      Object.assign(p,moveProbe(p,dx,dy,50,solids,world,(x,y)=>plazaArchitecture(map,x,y)));
      assert.ok(canStand(p.x,p.y,solids,world));entered=enterDoor(map,p.x,p.y);
    }
    assert.equal(entered,name);
    console.log(JSON.stringify({door:name,enteredAt:{x:p.x,y:p.y}}));
  }
  assert.ok(plazaArchitecture(map,1000,1000).length>0,'ordinary building walls retain clearance');
});
test('player blockage freezes route progress then resumes without catch-up; pause and reset stable',()=>{
  const run=createSmoke(map,'R1');run.npcs=run.npcs.slice(0,1);const n=run.npcs[0],start={x:n.x,y:n.y,target:n.target};
  const player=footprint(n.x,n.y+14,TIGER_FOOTPRINT);
  for(let i=0;i<600;i++)stepSmoke(run,map,1/60,[player]);
  assert.deepEqual({x:n.x,y:n.y,target:n.target},start);assert.equal(n.blockedBy,'Player');
  stepSmoke(run,map,1/60);assert.equal(n.blockedBy,'');assert.ok(n.y>start.y&&n.y<start.y+1);
  run.paused=true;const frozen=JSON.stringify(run.npcs);stepSmoke(run,map,1);assert.equal(JSON.stringify(run.npcs),frozen.replace('"moving":true','"moving":false'));
  assert.deepEqual(createSmoke(map),createSmoke(map));
});
