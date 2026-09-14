export type Bounds = { x: number; y: number; width: number; height: number };
export function sweptFootprint(from: {x:number;y:number}, to: {x:number;y:number}, size: {width:number;height:number}): Bounds {
  return {x:Math.min(from.x,to.x)-size.width/2,y:Math.min(from.y,to.y)-size.height/2,width:size.width+Math.abs(to.x-from.x),height:size.height+Math.abs(to.y-from.y)};
}
export function canNavigate(x:number,y:number,size:{width:number;height:number},obstacles:Bounds[],world:{width:number;height:number},architecture:Bounds[],clearance:{halfWidth:number;above:number;below:number}) {
  return canOccupy(footprint(x,y,size),obstacles,world) && !architecture.some(o=>overlaps(navigationBounds(x,y,clearance),o));
}
export function navigationBounds(x: number, y: number, clearance: { halfWidth: number; above: number; below: number }): Bounds {
  return { x: x - clearance.halfWidth, y: y - clearance.above, width: clearance.halfWidth * 2, height: clearance.above + clearance.below };
}
export function footprint(x: number, y: number, size: { width: number; height: number }): Bounds {
  return { x: x - size.width / 2, y: y - size.height / 2, ...size };
}
export function overlaps(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
export function canOccupy(body: Bounds, obstacles: Bounds[], world: { width: number; height: number }): boolean {
  return body.x >= 0 && body.y >= 0 && body.x + body.width <= world.width && body.y + body.height <= world.height && !obstacles.some((o) => overlaps(body, o));
}
