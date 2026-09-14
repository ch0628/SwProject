import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const map = JSON.parse(readFileSync(new URL('../public/maps/plaza-park-v2.tmj', import.meta.url), 'utf8'));
const layer = (name) => map.layers.find((candidate) => candidate.name === name);
const nodes = new Map((layer('Navigation_v2')?.objects ?? []).map((node) => [node.name, node]));
const edgeObjects = layer('Navigation_Edges_v2')?.objects ?? [];
const collisions = layer('Collision')?.objects ?? [];
const ground = layer('Ground');
const legacyNavigation = layer('Navigation')?.objects ?? [];
const expectedNodes = Array.from({ length: 28 }, (_, index) => `N${String(index + 1).padStart(2, '0')}`);
const expectedEdges = 'N01-N04 N03-N04 N04-N05 N02-N05 N05-N06 N06-N07 N07-N08 N04-N09 N05-N10 N09-N10 N10-N11 N09-N12 N12-N19 N19-N20 N20-N21 N18-N19 N11-N14 N13-N14 N14-N22 N22-N21 N13-N15 N10-N21 N08-N15 N15-N16 N08-N28 N17-N18 N18-N24 N21-N25 N15-N26 N23-N24 N24-N25 N25-N26 N26-N27'
  .split(' ').map((pair, index) => [`E${String(index + 1).padStart(2, '0')}`, ...pair.split('-')]);
const footprints = { Small: [18, 12], Medium: [22, 14], Large: [26, 16] };
const walkableGround = new Set([3, 4, 5, 6]);
const doorOpeningByEdge = { E25: 'Facility Opening', E26: 'Cafe Opening' };
const close = (a, b) => Math.abs(a - b) < 1e-6;
const contains = (rect, point) => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const properties = (object) => Object.fromEntries((object.properties ?? []).map(({ name, value }) => [name, value]));
const points = (edge) => edge.polyline.map((point) => ({ x: edge.x + point.x, y: edge.y + point.y }));
function samples(edge) {
  const result = [];
  const path = points(edge);
  for (let segment = 0; segment < path.length - 1; segment++) {
    const [from, to] = path.slice(segment, segment + 2);
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y)));
    for (let step = segment ? 1 : 0; step <= steps; step++) {
      const ratio = step / steps;
      result.push({ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio });
    }
  }
  return result;
}

assert.equal(map.width, 96);
assert.equal(map.height, 56);
assert.deepEqual([...nodes.keys()].sort(), expectedNodes);
for (const node of nodes.values()) assert.ok(node.point && node.width === 0 && node.height === 0, `${node.name} must be a point`);
assert.equal(edgeObjects.length, 33);
assert.deepEqual(edgeObjects.map(({ name }) => name).sort(), expectedEdges.map(([name]) => name).sort());

const adjacency = new Map(expectedNodes.map((name) => [name, new Set()]));
const endpointPairs = new Set();
for (const [name, from, to] of expectedEdges) {
  const edge = edgeObjects.find((candidate) => candidate.name === name);
  const props = properties(edge);
  assert.deepEqual(props, { from, to, bidirectional: true }, `${name} properties`);
  assert.ok(Array.isArray(edge.polyline) && edge.polyline.length >= 2, `${name} polyline`);
  const path = points(edge);
  assert.ok(close(path[0].x, nodes.get(from).x) && close(path[0].y, nodes.get(from).y), `${name} start`);
  assert.ok(close(path.at(-1).x, nodes.get(to).x) && close(path.at(-1).y, nodes.get(to).y), `${name} end`);
  const pair = [from, to].sort().join('-');
  assert.ok(!endpointPairs.has(pair), `${name} duplicates ${pair}`);
  endpointPairs.add(pair);
  adjacency.get(from).add(to);
  adjacency.get(to).add(from);
}
assert.ok([...adjacency.values()].every((neighbors) => neighbors.size > 0), 'isolated node');
const reached = new Set(['N01']);
for (const queue = ['N01']; queue.length;) for (const neighbor of adjacency.get(queue.shift())) if (!reached.has(neighbor)) reached.add(neighbor), queue.push(neighbor);
assert.equal(reached.size, 28, 'graph must be connected');

const geometryFailures = [];
const footprintFailures = Object.fromEntries(Object.keys(footprints).map((name) => [name, []]));
for (const edge of edgeObjects) {
  const openingName = doorOpeningByEdge[edge.name];
  const opening = openingName && legacyNavigation.find((object) => object.name === openingName);
  for (const point of samples(edge)) {
    const tileX = Math.floor(point.x / map.tilewidth);
    const tileY = Math.floor(point.y / map.tileheight);
    const gid = ground.data[tileY * map.width + tileX];
    if (!walkableGround.has(gid) && !(opening && contains(opening, point))) geometryFailures.push(`${edge.name} leaves walkable ground at ${point.x.toFixed(1)},${point.y.toFixed(1)} (gid ${gid})`);
    for (const [sizeName, [width, height]] of Object.entries(footprints)) {
      const body = { x: point.x - width / 2, y: point.y - height / 2, width, height };
      const hit = collisions.find((collision) => overlaps(body, collision));
      const outside = body.x < 0 || body.y < 0 || body.x + width > map.width * map.tilewidth || body.y + height > map.height * map.tileheight;
      if (hit || outside) footprintFailures[sizeName].push(`${edge.name} at ${point.x.toFixed(1)},${point.y.toFixed(1)}${hit ? ` hits ${hit.name} (${hit.type})` : ' leaves world'}`);
    }
  }
}
assert.deepEqual([...new Set(geometryFailures)], []);
for (const [sizeName, failures] of Object.entries(footprintFailures)) assert.deepEqual([...new Set(failures)], [], `${sizeName} footprint`);

assert.deepEqual([...adjacency.get('N17')], ['N18']);
assert.deepEqual([...adjacency.get('N28')], ['N08']);
for (const [nodeName, openingName] of [['N17', 'Cafe Opening'], ['N28', 'Facility Opening']]) {
  const opening = legacyNavigation.find((object) => object.name === openingName);
  assert.ok(opening && contains(opening, nodes.get(nodeName)), `${nodeName} must align with ${openingName}`);
}

console.log('Structural Graph Validation: PASS (28 nodes, 33 bidirectional edges, connected, 0 isolated)');
console.log('Edge Geometry / Collision Validation: PASS (33/33 walkable; 0 Collision/Fence/Building intersections)');
for (const [name, [width, height]] of Object.entries(footprints)) console.log(`${name} ${width}x${height} Traversability: PASS (33/33)`);
console.log('Door Branch Validation: PASS (N18-N17 Cafe, N08-N28 Facility; Large footprint clear)');
