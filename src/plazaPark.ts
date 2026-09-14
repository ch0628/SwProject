import { canOccupy, canNavigate, footprint, overlaps, sweptFootprint, type Bounds } from './collision.ts';
import { SPEED, TIGER_FOOTPRINT, ARCHITECTURE_CLEARANCE } from './config.ts';

export type MapObject = Bounds & {
  name: string;
  type: string;
  point?: boolean;
  polyline?: { x: number; y: number }[];
  properties?: { name: string; value: string | number | boolean }[];
};
export type GrayboxMap = { width: number; height: number; tilewidth: number; tileheight: number;
  layers: { name: string; objects?: MapObject[]; data?: number[] }[] };
export const mapObjects = (map: GrayboxMap, layer: string) => map.layers.find(l => l.name === layer)?.objects ?? [];
export const mapWorld = (map: GrayboxMap) => ({ width: map.width * map.tilewidth, height: map.height * map.tileheight });
export const canStand = (x: number, y: number, solids: Bounds[], world: { width: number; height: number }) =>
  canOccupy(footprint(x, y, TIGER_FOOTPRINT), solids, world);

// Door approach is a physical-only lane aligned with the unchanged opening.
// This exception never removes physical building collision.
export function doorLane(map:GrayboxMap,x:number,y:number,size=TIGER_FOOTPRINT){
  const body=footprint(x,y,size),nodes=mapObjects(map,'Navigation');
  return ['Cafe','Facility'].find(name=>{
    const opening=nodes.find(o=>o.name===`${name} Opening`)!,approach=nodes.find(o=>o.name===`${name} Approach`)!;
    const trigger=mapObjects(map,'Interaction').find(o=>o.name===`${name} Trigger`)!;
    const aligned=name==='Cafe'?body.y>=opening.y&&body.y+body.height<=opening.y+opening.height:body.x>=opening.x&&body.x+body.width<=opening.x+opening.width;
    return aligned&&(overlaps(body,approach)||overlaps(body,trigger));
  });
}
export function plazaArchitecture(map:GrayboxMap,x:number,y:number){
  const lane=doorLane(map,x,y);
  return mapObjects(map,'Collision').filter(o=>o.type==='Building'&&!(lane&&o.name.startsWith(lane)));
}
export function enterDoor(map:GrayboxMap,x:number,y:number,size=TIGER_FOOTPRINT){
  const name=doorLane(map,x,y,size);if(!name)return;
  const trigger=mapObjects(map,'Interaction').find(o=>o.name===`${name} Trigger`)!;
  if(!overlaps(footprint(x,y,size),trigger))return;
  const opening=mapObjects(map,'Navigation').find(o=>o.name===`${name} Opening`)!;
  const threshold=name==='Cafe'?{x:opening.x+opening.width/2,y}:{x,y:opening.y+opening.height/2};
  if(canOccupy(sweptFootprint({x,y},threshold,size),mapObjects(map,'Collision'),mapWorld(map)))return name;
}

// Debug footprint probe, not a Large sprite: no architectural visual-clearance claim.
// Same axis sliding / <=4px substeps as the existing Scale scene, shared AABB predicates.
export function moveProbe(position: { x: number; y: number }, dx: number, dy: number, delta: number, solids: Bounds[], world: { width: number; height: number }, architecture?: Bounds[] | ((x:number,y:number)=>Bounds[])) {
  const allowed=(x:number,y:number)=>architecture ? canNavigate(x,y,TIGER_FOOTPRINT,solids,world,typeof architecture==='function'?architecture(x,y):architecture,ARCHITECTURE_CLEARANCE.large) : canStand(x,y,solids,world);
  const length = Math.hypot(dx, dy);
  if (!length) return { ...position };
  const distance = SPEED * Math.max(0, Math.min(delta, 50)) / 1000;
  const steps = Math.ceil(distance / 4);
  let { x, y } = position;
  for (let i = 0; i < steps; i++) {
    const nx = x + dx / length * distance / steps;
    if (allowed(nx, y)) x = nx;
    const ny = y + dy / length * distance / steps;
    if (allowed(x, ny)) y = ny;
  }
  return { x, y };
}
