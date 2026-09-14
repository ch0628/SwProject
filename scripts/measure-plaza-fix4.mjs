import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createSmoke,stepSmoke,smokeMetrics,SMOKE_ROUTES,SMOKE_SIZES} from '../src/plazaTraffic.ts';
import {mapObjects,mapWorld} from '../src/plazaPark.ts';
import {canOccupy,footprint,overlaps} from '../src/collision.ts';
const policy=process.argv[2]??'v2';
if(!['v2','fallback'].includes(policy))throw Error('Use v2 or fallback');
const output = 'docs/plaza_park_deadlock_fix4_120s.json';
if(existsSync(output))throw Error('Measurement already exists; do not overwrite prior observations');
const map=JSON.parse(readFileSync('public/maps/plaza-park.tmj','utf8')),run=createSmoke(map);
run.policy=policy;
const solids=mapObjects(map,'Collision'),world=mapWorld(map);let collisionViolation=0;
for(let tick=0;tick<7200;tick++){
  stepSmoke(run,map,1/60);
  for(const n of run.npcs.filter(n=>!n.inside)){
    const body=footprint(n.x,n.y,SMOKE_SIZES[n.size]);
    if(!canOccupy(body,solids,world)||run.npcs.some(o=>o.id>n.id&&!o.inside&&overlaps(body,footprint(o.x,o.y,SMOKE_SIZES[o.size]))))collisionViolation++;
  }
}
const routes=Object.keys(SMOKE_ROUTES).map(route=>{const ns=run.npcs.filter(n=>n.route===route);return {route,trips:ns.reduce((s,n)=>s+n.trips,0),arrivals:ns.reduce((s,n)=>s+n.arrivals,0),maxBlock:Math.max(...ns.map(n=>n.longestWait))};});
const result={policy,seconds:run.elapsed,...smokeMetrics(run),collisionViolation,routes,npcs:run.npcs,locks:run.locks,merge:run.merge};
writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
