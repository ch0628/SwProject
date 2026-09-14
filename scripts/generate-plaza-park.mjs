// Graybox only. Regeneration overwrites the two generated files; Tiled edits must be preserved first.
import { mkdirSync, writeFileSync } from 'node:fs';
const tile = 32, width = 96, height = 56;
let objectId = 1;
const layer = (name, type = 'objectgroup') => ({ id: 0, name, type, opacity: 1, visible: true, x: 0, y: 0,
  ...(type === 'tilelayer' ? { width, height, data: Array(width * height).fill(0) } : { draworder: 'topdown', objects: [] }) });
const layers = [layer('Ground', 'tilelayer'), layer('Ground_Detail', 'tilelayer'), ...['Object_Base', 'Foreground', 'Collision', 'Navigation', 'Interaction', 'Camera_Zone'].map(n => layer(n))];
layers.forEach((l, i) => l.id = i + 1);
const get = n => layers.find(l => l.name === n);
const rect = (name, type, x1, y1, x2 = x1, y2 = y1, properties = {}) => ({ id: objectId++, name, type,
  x: x1 * tile, y: y1 * tile, width: (x2 - x1 + 1) * tile, height: (y2 - y1 + 1) * tile,
  rotation: 0, visible: true, properties: Object.entries(properties).map(([name, value]) => ({ name, type: typeof value === 'number' ? 'float' : typeof value === 'boolean' ? 'bool' : 'string', value })) });
const add = (layerName, ...args) => { const o = rect(...args); get(layerName).objects.push(o); return o; };
const paint = (layerName, gid, x1, y1, x2, y2) => { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) get(layerName).data[y * width + x] = gid; };
paint('Ground', 1, 0, 0, 95, 55);
const zone = (name, x1, y1, x2, y2, gid) => { add('Navigation', name, 'Zone', x1, y1, x2, y2); if (gid) paint('Ground', gid, x1, y1, x2, y2); };
zone('Park', 0, 0, 95, 21, 2);
zone('Cafe Zone', 6, 35, 23, 46);
zone('Public Facility Zone', 74, 7, 92, 21);
zone('Transition', 18, 22, 77, 23, 4);
zone('Central Plaza', 20, 24, 75, 39, 5);
zone('Open Core', 31, 28, 64, 35);
zone('Facility Forecourt', 79, 17, 91, 21, 4);
const paths = [
  ['Park Main Walkway',18,10,77,12,'Standard',3], ['Upper Narrow Path',26,5,69,6,'Special',2],
  ['Lower Narrow Path',26,16,69,17,'Special',2], ['Upper Left Connector',25,6,26,10,'Special',2],
  ['Upper Right Connector',69,6,70,10,'Special',2], ['Lower Left Connector',25,12,26,16,'Special',2],
  ['Lower Right Connector',69,12,70,16,'Special',2], ['North Entry Connector',46,0,49,10,'Connector',4],
  ['Park South Connector',46,17,49,24,'Connector',4], ['Main Route',0,50,95,55,'Main',6],
  ['North Entry',46,0,49,1,'Entry',4], ['West Exit',0,52,1,53,'Exit',2], ['East Exit',94,52,95,53,'Exit',2],
];
for (const [n,x,y,x2,y2,kind,tiles] of paths) {
  add('Navigation', n, 'Path', x,y,x2,y2,{ kind, tiles });
  paint('Ground', kind === 'Main' || kind === 'Exit' ? 6 : kind === 'Special' ? 7 : 3,x,y,x2,y2);
}
const solid = (name,type,x,y,x2=x,y2=y) => {
  add('Object_Base',name,type,x,y,x2,y2);
  add('Collision',name,type,x,y,x2,y2);
};
for (const [i,x,y] of [[1,10,4],[2,83,4],[3,12,18],[4,93,18],[5,36,8],[6,59,15]]) {
  solid(`T${i}`,'Tree',x,y);
  add('Foreground',`T${i} canopy`,'Canopy',x-1,y-3,x+1,y,{ footY:(y+.5)*tile });
}
[[16,6],[33,8],[62,8],[79,6],[38,15],[57,15],[19,17],[76,17]].forEach(([x,y],i)=>solid(`B${i+1}`,'Bush',x,y));
[[12,8],[53,8],[74,8],[15,15],[50,15],[74,15],[28,25],[67,25],[28,38],[67,38]].forEach(([x,y],i)=>{
  const name = i<6 ? `L${i+1}` : `PL${i-5}`;
  solid(name,'Lamp',x,y); add('Foreground',`${name} top`,'LampTop',x,y-2,x,y,{footY:(y+.5)*tile});
});
for(const [n,x,y] of [['Bench A',8,10],['Bench B',86,19],['Bench C',38,19],['PB1',24,26],['PB2',69,26],['PB3',24,37],['PB4',69,37]]) {
  solid(n,'Bench',x,y,x+2,y); add('Interaction',n,'Bench',x,y,x+2,y);
}
for(const [n,x,y,x2] of [['Fence NW',6,9,12],['Fence NE',71,9,76],['Fence SW',6,13,12],['Fence SE',71,13,76]]) solid(n,'Fence',x,y,x2,y);
// Only flower positions are unspecified in the spec: small decoration samples in empty grass.
paint('Ground_Detail',8,20,3,22,4); paint('Ground_Detail',8,54,20,56,21);
add('Object_Base','Manhole','Manhole',72,17,73,18);
add('Interaction','Manhole','Manhole',72,17,73,18);
add('Object_Base','Cafe','Building',7,37,19,44);
add('Object_Base','Public Facility','Building',79,8,91,16);
// Solid interiors, with exactly the specified one-tile-deep openings subtracted.
for(const [n,x,y,x2,y2] of [
  ['Cafe interior',7,37,18,44],['Cafe east upper',19,37,19,39],['Cafe east lower',19,42,19,44],
  ['Facility interior',79,8,91,15],['Facility south west',79,16,83,16],['Facility south east',86,16,91,16],
]) add('Collision',n,'Building',x,y,x2,y2);
for(const [n,x,y,x2,y2] of [['Cafe Opening',19,40,19,41],['Facility Opening',84,16,85,16]]) {
  add('Object_Base',n,'DoorOpening',x,y,x2,y2); add('Navigation',n,'DoorOpening',x,y,x2,y2);
}
add('Interaction','Cafe Trigger','DoorTrigger',19,40,20,41);
add('Interaction','Facility Trigger','DoorTrigger',84,16,85,17);
add('Navigation','Cafe Approach','Approach',20,40,22,41);
add('Navigation','Facility Approach','Approach',84,17,85,18);
const wp = [
  ['NORTH_ENTRY',47,2],['PARK_NW',26,5],['PARK_MAIN_WEST',30,11],['PARK_BENCH_A',11,10],
  ['PARK_CENTER',48,11],['PARK_BENCH_B',85,19],['PARK_MAIN_EAST',72,11],['UPPER_NARROW_MID',48,5],
  ['LOWER_NARROW_MID',48,16],['PARK_BENCH_C',41,19],['MANHOLE',71,18],['PARK_SOUTH_GATE',48,22],
  ['PLAZA_WEST',24,31],['PLAZA_CENTER',48,31],['PLAZA_EAST',71,31],['CAFE_FRONT',22,40],
  ['CAFE_DOOR',20,40],['FACILITY_FRONT',84,18],['FACILITY_DOOR',84,16],['MAIN_ROAD_CENTER',48,52],
  ['WEST_EXIT',1,52],['EAST_EXIT',94,52],
];
wp.forEach(([label,x,y],i)=>{
  const o=add('Navigation',`W${String(i+1).padStart(2,'0')}`,'Waypoint',x,y,x,y,{label,tileX:x,tileY:y});
  o.point=true; o.x+=16; o.y+=16; o.width=0; o.height=0;
});
add('Camera_Zone','CCTV1','Coverage',0,0,52,30);
add('Camera_Zone','CCTV2','Coverage',18,16,95,55);
add('Camera_Zone','Overlap','Overlap',18,16,52,30);
const colors=['#69756a','#526f59','#a3a18b','#8b9c91','#b2b4ad','#717e8e','#9b896d','#bc92af'];
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="32">${colors.map((c,i)=>`<rect x="${i*32}" width="32" height="32" fill="${c}"/><path d="M${i*32} 32V0h32" fill="none" stroke="#ffffff" stroke-opacity=".13"/>`).join('')}</svg>`;
const map={type:'map',version:'1.10',tiledversion:'1.11.2',orientation:'orthogonal',renderorder:'right-down',infinite:false,
  width,height,tilewidth:tile,tileheight:tile,nextlayerid:9,nextobjectid:objectId,layers,
  tilesets:[{firstgid:1,name:'graybox',tilewidth:32,tileheight:32,tilecount:8,columns:8,margin:0,spacing:0,image:'graybox.svg',imagewidth:256,imageheight:32}]};
const out=new URL('../public/maps/',import.meta.url); mkdirSync(out,{recursive:true});
writeFileSync(new URL('plaza-park.tmj',out),JSON.stringify(map));
writeFileSync(new URL('graybox.svg',out),svg);
console.log('Generated Plaza & Park: 96x56, 8 layers, 22 waypoints');
