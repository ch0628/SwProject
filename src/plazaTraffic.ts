import { canOccupy, footprint, overlaps, sweptFootprint, type Bounds } from './collision.ts';
import { CORRIDOR, CORRIDOR_SIZES } from './corridorCapacity.ts';
import { mapObjects, mapWorld, enterDoor, type GrayboxMap } from './plazaPark.ts';

// Validation routes only. Lines connect existing anchors; no new nodes or avoidance.
export const SMOKE_ROUTES = {
  R1:['W01','W05','W12','W14','W20','W21'],
  R2:['W01','W05','W08','W05','W12','W14','W20','W22'],
  R3:['W05','W12','W13','W16','W20'],
  R4:['W05','W12','W18','W12','W14'],
  R5:['W09','W11','W12','W14'],
} as const;
export type RouteId=keyof typeof SMOKE_ROUTES;

// Candidate routes for dynamic validation only. Not approved Final Routes yet.
// Do NOT add these into SMOKE_ROUTES; createSmoke() must remain 10 NPC (R1-R5).
export const FULL_FLOW_ROUTE_CANDIDATES = {
  R6:['W03','W05','W07'],
  R7:['W13','W14','W15'],
  R8:['W21','W20','W22'],
} as const;
export type CandidateRouteId=keyof typeof FULL_FLOW_ROUTE_CANDIDATES;

// Combined lookup for stepSmoke path resolution. SMOKE_ROUTES entries are listed first.
export const TRAFFIC_ROUTE_PATHS = {...SMOKE_ROUTES,...FULL_FLOW_ROUTE_CANDIDATES} as const;
export type AllRouteId=keyof typeof TRAFFIC_ROUTE_PATHS;
export const SMOKE_SIZES={...CORRIDOR_SIZES,Max96:{...CORRIDOR_SIZES.Large,visual:96,visualWidth:64}};
export type SmokeNpc={id:number;route:AllRouteId;size:keyof typeof SMOKE_SIZES;x:number;y:number;target:number;direction:1|-1;pause:number;wait:number;longestWait:number;blockedEvents:number;blockedBy:string;moving:boolean;arrivals:number;trips:number;forwardWait?:number;recoveries?:number;doorTarget?:string;inside?:number;enters?:number;exits?:number;yieldTo?:number;yieldBackoff?:number};
type Reservation={members:number[];queue:number[];direction:number};
export type SmokeRun={npcs:SmokeNpc[];elapsed:number;paused:boolean;policy?:'v2'|'fallback';locks?:Record<string,Reservation>;merge?:{owner?:number;queue:number[]};maxSeconds?:number};
export function createSmoke(map:GrayboxMap,only?:RouteId,external:Bounds[]=[]):SmokeRun {
  const npcs:SmokeNpc[]=[],nodes=mapObjects(map,'Navigation'),solids=mapObjects(map,'Collision'),world=mapWorld(map);
  for(const route of (only?[only]:Object.keys(SMOKE_ROUTES) as RouteId[]))for(const direction of [1,-1] as const){
    const path=SMOKE_ROUTES[route],start=direction===1?0:path.length-1,target=start+direction;
    const a=nodes.find(n=>n.name===path[start])!,b=nodes.find(n=>n.name===path[target])!;
    const size=(['Small','Large','Medium','Max96'] as const)[npcs.length%4],shape=SMOKE_SIZES[size];
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    let spawn:{x:number;y:number}|undefined;
    // Stagger on the first existing edge, never spawn inside another footprint.
    for(let offset=0;offset<Math.min(length,512);offset+=64){
      const x=a.x+(b.x-a.x)*offset/length,y=a.y+(b.y-a.y)*offset/length;
      if(canOccupy(footprint(x,y,shape),[...solids,...external,...npcs.map(n=>footprint(n.x,n.y,SMOKE_SIZES[n.size]))],world)){spawn={x,y};break;}
    }
    if(!spawn)throw new Error(`No safe smoke spawn: ${route}`);
    npcs.push({id:npcs.length+1,route,size,...spawn,target,direction,pause:0,wait:0,longestWait:0,blockedEvents:0,blockedBy:'',moving:false,arrivals:0,trips:0});
  }
  return {npcs,elapsed:0,paused:false,policy:'fallback',locks:{},merge:{queue:[]}};
}
// Local traffic control only. No new graph nodes or path search.
// Narrow-path reservations apply only to traffic travelling ALONG the long
// axis of that narrow path. A connector that merely crosses the rectangle
// must not become a member of the directional narrow-path lock.
function reservation(
  run:SmokeRun,
  map:GrayboxMap,
  n:SmokeNpc,
  next:{x:number;y:number},
  edgeDx:number,
  edgeDy:number
){
  const nodes=mapObjects(map,'Navigation'),body=footprint(next.x,next.y,SMOKE_SIZES[n.size]);
  const edgeAxis=Math.abs(edgeDx)>=Math.abs(edgeDy)?'x':'y';
  const heading=edgeAxis==='x'?Math.sign(edgeDx):Math.sign(edgeDy);

  for(const zone of nodes.filter(o=>o.name==='Upper Narrow Path'||o.name==='Lower Narrow Path')){
    const lock=(run.locks??={})[zone.name]??= {members:[],queue:[],direction:0};
    lock.members=lock.members.filter(id=>run.npcs.some(o=>o.id===id&&!o.inside&&overlaps(footprint(o.x,o.y,SMOKE_SIZES[o.size]),zone)));

    if(!overlaps(body,zone)){
      lock.queue=lock.queue.filter(id=>id!==n.id);
      continue;
    }

    // Existing members keep ownership until their physical footprint leaves
    // the zone, even if their next segment has already turned at the exit.
    if(lock.members.includes(n.id))continue;

    const zoneAxis=zone.width>=zone.height?'x':'y';
    if(edgeAxis!==zoneAxis){
      // Perpendicular connector traffic is crossing the narrow-path polygon,
      // not travelling along the 2-tile narrow path.
      lock.queue=lock.queue.filter(id=>id!==n.id);
      continue;
    }

    if(!lock.queue.includes(n.id))lock.queue.push(n.id);
    if(!lock.members.length&&lock.queue[0]===n.id)lock.direction=heading;
    if(lock.direction===heading&&(!lock.members.length?lock.queue[0]===n.id:true)){
      lock.members.push(n.id);
      lock.queue=lock.queue.filter(id=>id!==n.id);
    }else return zone.name+' reservation';
  }

  const merge=run.merge??={queue:[]},center=nodes.find(o=>o.name==='W12')!;
  if(merge.owner&&!run.npcs.some(o=>o.id===merge.owner&&Math.hypot(o.x-center.x,o.y-center.y)<128))merge.owner=undefined;
  if(Math.hypot(next.x-center.x,next.y-center.y)<112){
    if(!merge.queue.includes(n.id)&&merge.owner!==n.id)merge.queue.push(n.id);
    if(!merge.owner)merge.owner=merge.queue.shift();
    if(merge.owner!==n.id)return 'W12 FIFO';
  }else merge.queue=merge.queue.filter(id=>id!==n.id);
  return '';
}
export function stepSmoke(run:SmokeRun,map:GrayboxMap,seconds:number,external:Bounds[]=[]){
  const maxSeconds=run.maxSeconds??120;
  const dt=Math.max(0,Math.min(seconds,.05,maxSeconds-run.elapsed));
  if(run.paused||!dt){run.npcs.forEach(n=>n.moving=false);return;}
  run.elapsed+=dt;
  const nodes=mapObjects(map,'Navigation'),solids=mapObjects(map,'Collision'),world=mapWorld(map);
  for(const n of run.npcs){
    n.moving=false;
    if(n.inside){
      n.inside=Math.max(0,n.inside-dt);
      if(!n.inside){
        const body=footprint(n.x,n.y,SMOKE_SIZES[n.size]);
        if(external.some(o=>overlaps(body,o))||run.npcs.some(o=>o!==n&&!o.inside&&overlaps(body,footprint(o.x,o.y,SMOKE_SIZES[o.size]))))n.inside=dt;
        else n.exits=(n.exits??0)+1;
      }
      continue;
    }
    if(n.pause>0){n.pause=Math.max(0,n.pause-dt);continue;}
    const path=TRAFFIC_ROUTE_PATHS[n.route],target=nodes.find(o=>o.name===(n.doorTarget??path[n.target]))!;
    if(n.doorTarget&&enterDoor(map,n.x,n.y,SMOKE_SIZES[n.size])){
      n.inside=2;n.enters=(n.enters??0)+1;n.doorTarget=undefined;n.wait=0;continue;
    }
    const dx=target.x-n.x,dy=target.y-n.y,distance=Math.hypot(dx,dy),step=Math.min(distance,CORRIDOR.speed*dt);
    const next=distance?{x:n.x+dx/distance*step,y:n.y+dy/distance*step}:{x:n.x,y:n.y};
    // Keep avoidance aligned to the route segment, not to the actor's current
    // off-center vector toward the waypoint. Once an actor has side-stepped,
    // dx/dy can flip the perceived dominant axis and make the next side-step
    // point back into the blocker.
    const edgeStart=nodes.find(o=>o.name===(path as readonly string[])[n.target-n.direction])!;
    const edgeDx=target.x-edgeStart.x,edgeDy=target.y-edgeStart.y;
    const edgeLength=Math.max(1,Math.hypot(edgeDx,edgeDy));
    // Deterministic right-of-way for nearby head-on traffic.
    // Recompute every frame instead of latching yieldTo by distance alone:
    // once the two actors are no longer on opposing route segments, the yield
    // must disappear immediately rather than freezing a follower behind traffic.
    if(run.policy==='fallback'){
      const edgeUx=edgeDx/edgeLength,edgeUy=edgeDy/edgeLength;
      n.yieldTo=run.npcs.find(o=>{
        if(o.id>=n.id||o.inside||Math.hypot(o.x-n.x,o.y-n.y)>=64)return false;
        const otherPath=TRAFFIC_ROUTE_PATHS[o.route];
        const otherTarget=nodes.find(p=>p.name===(o.doorTarget??otherPath[o.target]))!;
        const otherStart=nodes.find(p=>p.name===(otherPath as readonly string[])[o.target-o.direction])!;
        const otherDx=otherTarget.x-otherStart.x,otherDy=otherTarget.y-otherStart.y;
        const otherLength=Math.max(1,Math.hypot(otherDx,otherDy));
        return edgeUx*(otherDx/otherLength)+edgeUy*(otherDy/otherLength)<-.3;
      })?.id;
      if(!n.yieldTo)n.yieldBackoff=0;
    }
    const sweep=sweptFootprint(n,next,SMOKE_SIZES[n.size]);
    const fixed=solids.find(o=>overlaps(sweep,o)),other=run.npcs.find(o=>o!==n&&!o.inside&&overlaps(sweep,footprint(o.x,o.y,SMOKE_SIZES[o.size])));
    const reservationCause=reservation(run,map,n,next,edgeDx,edgeDy);
    // Merge reservation has stronger priority than local head-on yielding.
    // Otherwise the W12 owner can yield to an NPC that is itself waiting for
    // that owner, creating: owner -> yield to waiter -> W12 FIFO -> owner.
    if(run.merge?.owner===n.id){
      n.yieldTo=undefined;
      n.yieldBackoff=0;
    }
    const yieldCause=n.yieldTo?`Yield to ${n.yieldTo}`:'';
    const permission=reservationCause||yieldCause;
    const cause=permission|| (fixed?fixed.name:other?`NPC ${other.id}`:external.some(o=>overlaps(sweep,o))?'Player':!canOccupy(sweep,[],world)?'World':'');
    if(cause){
      n.forwardWait=(n.forwardWait??0)+dt;
      // A yielding actor is allowed to move sideways to clear the lane. Only
      // an actual narrow/merge reservation forbids bypassing the reservation.
      // The side-step uses the fixed route-segment direction so an off-center
      // actor cannot suddenly rotate its avoidance axis near a waypoint.
      // A yielding actor must actively clear the lane even before its forward
      // sweep physically touches the priority actor. Otherwise the priority
      // actor can be blocked by the yielder while the yielder freezes on
      // `Yield to N`, producing a circular wait.
      if((other||n.yieldTo)&&!reservationCause&&n.forwardWait>=CORRIDOR.sideDelay&&distance){
        const trySide=(sideSign:1|-1)=>{
          const side={
            x:n.x-edgeDy/edgeLength*CORRIDOR.sideSpeed*dt*sideSign,
            y:n.y+edgeDx/edgeLength*CORRIDOR.sideSpeed*dt*sideSign,
          };
          const deviation=Math.abs((side.x-edgeStart.x)*edgeDy-(side.y-edgeStart.y)*edgeDx)/edgeLength;
          const sideSweep=sweptFootprint(n,side,SMOKE_SIZES[n.size]);
          if(
            deviation<=48&&
            canOccupy(sideSweep,[...solids,...external,...run.npcs.filter(o=>o!==n&&!o.inside).map(o=>footprint(o.x,o.y,SMOKE_SIZES[o.size]))],world)&&
            !reservation(run,map,n,side,edgeDx,edgeDy)
          ){
            if(n.wait>=.5)n.recoveries=(n.recoveries??0)+1;
            n.x=side.x;n.y=side.y;n.moving=true;n.wait=0;n.blockedBy='';
            return true;
          }
          return false;
        };

        // Keep right-hand behaviour as the first choice, but a crowded merge
        // can have that side occupied. Trying the opposite side is still
        // deterministic and avoids freezing simply because one shoulder is busy.
        if(trySide(1)||trySide(-1))continue;

        // If the yielding actor cannot clear laterally because the merge is
        // already crowded, allow a small bounded retreat along its own edge.
        // This preserves the target and never teleports or ignores collision.
        if(n.yieldTo&&(n.yieldBackoff??0)<32){
          const amount=Math.min(CORRIDOR.sideSpeed*dt,32-(n.yieldBackoff??0));
          const back={
            x:n.x-edgeDx/edgeLength*amount,
            y:n.y-edgeDy/edgeLength*amount,
          };
          const projection=((back.x-edgeStart.x)*edgeDx+(back.y-edgeStart.y)*edgeDy)/(edgeLength*edgeLength);
          const backSweep=sweptFootprint(n,back,SMOKE_SIZES[n.size]);
          if(
            projection>=-1e-6&&
            canOccupy(backSweep,[...solids,...external,...run.npcs.filter(o=>o!==n&&!o.inside).map(o=>footprint(o.x,o.y,SMOKE_SIZES[o.size]))],world)&&
            !reservation(run,map,n,back,edgeDx,edgeDy)
          ){
            if(n.wait>=.5)n.recoveries=(n.recoveries??0)+1;
            n.x=back.x;n.y=back.y;n.moving=true;n.wait=0;n.blockedBy='';
            n.yieldBackoff=(n.yieldBackoff??0)+amount;
            continue;
          }
        }
      }
      if(!n.blockedBy)n.blockedEvents++;
      n.blockedBy=cause;n.wait+=dt;n.longestWait=Math.max(n.longestWait,n.wait);
      continue; // Preserve target/progress; no catch-up movement after the blocker leaves.
    }
    if(n.wait>=.5)n.recoveries=(n.recoveries??0)+1;
    n.blockedBy='';n.wait=0;n.forwardWait=0;n.yieldBackoff=0;n.moving=step>0;n.x=next.x;n.y=next.y;
    if(distance<=CORRIDOR.speed*dt){
      n.arrivals++;
      if(target.name==='W16')n.doorTarget='W17';
      if(target.name==='W18')n.doorTarget='W19';
      if(n.target===0||n.target===(path as readonly string[]).length-1){n.trips++;n.direction=n.direction===1?-1:1;n.pause=CORRIDOR.turnaroundPause;}
      n.target+=n.direction;
    }
  }
  const _maxSec=run.maxSeconds??120;
  if(run.elapsed>=_maxSec-1e-8){run.elapsed=_maxSec;run.paused=true;}
}

export function smokeMetrics(run:SmokeRun){
  return {active_npc:run.npcs.filter(n=>!n.inside).length,completed_routes:run.npcs.reduce((s,n)=>s+n.trips,0),waypoint_arrivals:run.npcs.reduce((s,n)=>s+n.arrivals,0),blocked_npc_count:run.npcs.filter(n=>n.wait>=.5).length,max_continuous_blocked_time:Math.max(0,...run.npcs.map(n=>n.longestWait)),severe_block_count:run.npcs.filter(n=>n.wait>=10).length,unrecovered_20sec:run.npcs.filter(n=>n.wait>=20).length,recoveries:run.npcs.reduce((s,n)=>s+(n.recoveries??0),0)};
}
