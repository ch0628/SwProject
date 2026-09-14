import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { mapObjects, mapWorld, canStand, moveProbe, type GrayboxMap } from '../src/plazaPark.ts';
import { overlaps, footprint } from '../src/collision.ts';
import { TIGER_FOOTPRINT } from '../src/config.ts';

const map: GrayboxMap=JSON.parse(readFileSync(new URL('../public/maps/plaza-park.tmj',import.meta.url),'utf8'));
const solids=mapObjects(map,'Collision'),world=mapWorld(map);
const navigation=mapObjects(map,'Navigation');
const waypoints=navigation.filter(o=>o.type==='Waypoint');
function bounds(layer:string,name:string,tiles:number[]){
  const o=mapObjects(map,layer).find(o=>o.name===name);assert.ok(o, name);
  const [x,y,x2,y2]=tiles;
  assert.deepEqual([o.x,o.y,o.width,o.height],[x*32,y*32,(x2-x+1)*32,(y2-y+1)*32],name);
}
test('Tiled graybox dimensions, layer contract and fixed regions match latest spec',()=>{
  assert.deepEqual([map.width,map.height,map.tilewidth,map.tileheight],[96,56,32,32]);
  assert.deepEqual(world,{width:3072,height:1792});
  assert.deepEqual(map.layers.map(l=>l.name),['Ground','Ground_Detail','Object_Base','Foreground','Collision','Navigation','Interaction','Camera_Zone']);
  for(const l of map.layers.filter(l=>l.data))assert.equal(l.data!.length,96*56);
  for(const [name,xy] of Object.entries({Park:[0,0,95,21],'Park Main Walkway':[18,10,77,12],
    'Upper Narrow Path':[26,5,69,6],'Lower Narrow Path':[26,16,69,17],
    'Upper Left Connector':[25,6,26,10],'Upper Right Connector':[69,6,70,10],
    'Lower Left Connector':[25,12,26,16],'Lower Right Connector':[69,12,70,16],
    'North Entry Connector':[46,0,49,10],'Park South Connector':[46,17,49,24],
    Transition:[18,22,77,23],'Central Plaza':[20,24,75,39],'Open Core':[31,28,64,35],
    'Main Route':[0,50,95,55],'North Entry':[46,0,49,1],'West Exit':[0,52,1,53],'East Exit':[94,52,95,53],
    'Cafe Approach':[20,40,22,41],'Facility Approach':[84,17,85,18],'Facility Forecourt':[79,17,91,21]}))bounds('Navigation',name,xy);
  bounds('Object_Base','Cafe',[7,37,19,44]);bounds('Object_Base','Public Facility',[79,8,91,16]);
  bounds('Navigation','Cafe Opening',[19,40,19,41]);bounds('Navigation','Facility Opening',[84,16,85,16]);
  bounds('Interaction','Cafe Trigger',[19,40,20,41]);bounds('Interaction','Facility Trigger',[84,16,85,17]);
});
test('all fixed objects, decoration and open core retain their intended collision',()=>{
  const base=mapObjects(map,'Object_Base');
  const expected={T1:[10,4],T2:[83,4],T3:[12,18],T4:[93,18],T5:[36,8],T6:[59,15],
    B1:[16,6],B2:[33,8],B3:[62,8],B4:[79,6],B5:[38,15],B6:[57,15],B7:[19,17],B8:[76,17],
    L1:[12,8],L2:[53,8],L3:[74,8],L4:[15,15],L5:[50,15],L6:[74,15],
    PL1:[28,25],PL2:[67,25],PL3:[28,38],PL4:[67,38]};
  for(const [n,[x,y]] of Object.entries(expected))bounds('Collision',n,[x,y,x,y]);
  for(const [n,x,y] of [['Bench A',8,10],['Bench B',86,19],['Bench C',38,19],['PB1',24,26],['PB2',69,26],['PB3',24,37],['PB4',69,37]] as const)bounds('Collision',n,[x,y,x+2,y]);
  for(const [n,xy] of Object.entries({'Fence NW':[6,9,12,9],'Fence NE':[71,9,76,9],'Fence SW':[6,13,12,13],'Fence SE':[71,13,76,13]}))bounds('Collision',n,xy);
  bounds('Interaction','Manhole',[72,17,73,18]);
  for(const o of base.filter(o=>['Bench','Tree','Lamp','Bush','Fence'].includes(o.type)))assert.equal(canStand(o.x+16,o.y+16,solids,world),false,o.name);
  const detail=map.layers.find(l=>l.name==='Ground_Detail')!.data!;
  assert.ok(detail.some(Boolean));
  detail.forEach((gid,i)=>{if(gid)assert.equal(canStand((i%96)*32+16,Math.floor(i/96)*32+16,solids,world),true,'flower is walkable');});
  const core=navigation.find(o=>o.name==='Open Core')!;
  assert.ok(!solids.some(o=>overlaps(o,core)));
});
test('CCTV coverage and computed overlap match latest inclusive tile ranges',()=>{
  bounds('Camera_Zone','CCTV1',[0,0,52,30]);bounds('Camera_Zone','CCTV2',[18,16,95,55]);bounds('Camera_Zone','Overlap',[18,16,52,30]);
  const [a,b,c]=mapObjects(map,'Camera_Zone');
  assert.deepEqual([c.x,c.y,c.width,c.height],[Math.max(a.x,b.x),Math.max(a.y,b.y),Math.min(a.x+a.width,b.x+b.width)-c.x,Math.min(a.y+a.height,b.y+b.height)-c.y]);
});
test('all 22 exact waypoint centers are collision-free and connected to North Entry',()=>{
  const coords=[[47,2],[26,5],[30,11],[11,10],[48,11],[85,19],[72,11],[48,5],[48,16],[41,19],[71,18],[48,22],[24,31],[48,31],[71,31],[22,40],[20,40],[84,18],[84,16],[48,52],[1,52],[94,52]];
  assert.equal(waypoints.length,22);
  waypoints.forEach((o,i)=>{assert.equal(o.name,`W${String(i+1).padStart(2,'0')}`);assert.deepEqual([o.x,o.y],coords[i].map(n=>n*32+16));assert.ok(canStand(o.x,o.y,solids,world),o.name);});
  // Test-only flood fill, not runtime pathfinding. Check 4px samples along every traversed edge.
  const queue=[[47,0]],seen=new Set(['47,0']);
  for(let i=0;i<queue.length;i++){
    const [x,y]=queue[i];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;
      if(nx<0||ny<0||nx>=96||ny>=56||seen.has(key))continue;
      if(!Array.from({length:8},(_,j)=>canStand(x*32+16+dx*(j+1)*4,y*32+16+dy*(j+1)*4,solids,world)).every(Boolean))continue;
      seen.add(key);queue.push([nx,ny]);
    }
  }
  coords.forEach(([x,y],i)=>assert.ok(seen.has(`${x},${y}`),`W${i+1} reachable`));
  for(const p of navigation.filter(o=>o.type==='Path'))assert.ok(seen.has(`${p.x/32},${p.y/32}`),p.name);
});
test('runtime probe passes both door openings, stops at solid interior and never tunnels',()=>{
  for(const [start,dx,dy,openingName] of [[{x:720,y:1296},-1,0,'Cafe Opening'],[{x:2704,y:592},0,-1,'Facility Opening']] as const){
    let p={...start};let reached=false;
    const opening=navigation.find(o=>o.name===openingName)!;
    for(let i=0;i<100;i++){
      const next=moveProbe(p,dx,dy,1000,solids,world);
      assert.ok(Math.hypot(next.x-p.x,next.y-p.y)<=9.001);
      assert.ok(canStand(next.x,next.y,solids,world));
      p=next;
      if(p.x>=opening.x&&p.x<opening.x+opening.width&&p.y>=opening.y&&p.y<opening.y+opening.height)reached=true;
    }
    assert.ok(reached,openingName);
    assert.deepEqual(moveProbe(p,dx,dy,50,solids,world),p,'solid interior stops further travel');
    assert.ok(!solids.some(o=>overlaps(footprint(p.x,p.y,TIGER_FOOTPRINT),o)));
  }
});
