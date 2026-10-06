import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const navigationDir = resolve(
  scriptDir,
  "../../docs/modules/machine_learning/reinforcement/navigation",
);
const graphPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(navigationDir, "navigation_graph_v1.json");

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const duplicates = (values) =>
  [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];

const graph = JSON.parse(readFileSync(graphPath, "utf8"));
const floors = graph.floors ?? [];
const nodes = floors.flatMap((floor) => floor.nodes ?? []);
const edges = floors.flatMap((floor) => floor.edges ?? []);
const vertical = graph.verticalConnections ?? [];
const nodeById = new Map(nodes.map((node) => [node.id, node]));
const edgeById = new Map(edges.map((edge) => [edge.id, edge]));

check(graph.version === "v1", "graph version must be v1");
check(graph.missionRules?.allGeneralVillainsRequired === false, "general villain elimination must remain optional");
check(graph.missionRules?.bossNeutralizationRequired === true, "Boss neutralization must be required");
check(graph.missionRules?.villainEncounterState === "VILLAIN_ENCOUNTER", "general villain state must remain distinct");
check(graph.missionRules?.bossEncounterState === "BOSS_ENCOUNTER", "Boss encounter state must remain distinct");
check(
  JSON.stringify(floors.map(({ floor }) => floor)) === JSON.stringify([1, 2, 3, 4, 5]),
  "floors must be exactly 1 through 5",
);
check(!/elevator/i.test(JSON.stringify(graph)), "graph must not contain an elevator");
check(duplicates(nodes.map(({ id }) => id)).length === 0, "duplicate node id");
check(duplicates(edges.map(({ id }) => id)).length === 0, "duplicate edge id");
check(duplicates(vertical.map(({ id }) => id)).length === 0, "duplicate vertical id");
check(
  duplicates([...nodes, ...edges, ...vertical].map(({ id }) => id)).length === 0,
  "ids must also be unique across node, edge, and vertical connection kinds",
);

for (const node of nodes) {
  check(node.id && node.floor && node.type && node.label, `node ${node.id ?? "?"} is missing a required field`);
  check(Number.isFinite(node.x) && Number.isFinite(node.y), `node ${node.id} needs finite x/y coordinates`);
  check(floors.some(({ floor }) => floor === node.floor), `node ${node.id} refers to an unknown floor`);
  if (node.type === "DECISION") {
    check(Boolean(node.routeContextId), `decision node ${node.id} is missing routeContextId`);
  }
}

const routeContexts = nodes
  .filter(({ type }) => type === "DECISION")
  .map(({ routeContextId }) => routeContextId);
check(duplicates(routeContexts).length === 0, "decision routeContextId values must be unique templates");

for (const edge of edges) {
  check(nodeById.has(edge.from), `edge ${edge.id} has unknown from node ${edge.from}`);
  check(nodeById.has(edge.to), `edge ${edge.id} has unknown to node ${edge.to}`);
  check(typeof edge.bidirectional === "boolean", `edge ${edge.id} is missing bidirectional`);
  check(Boolean(edge.visualRouteId), `edge ${edge.id} is missing visualRouteId`);
  check(Array.isArray(edge.encounterCandidates), `edge ${edge.id} is missing encounterCandidates`);
  check(edge.traits && typeof edge.traits === "object", `edge ${edge.id} is missing traits`);
  for (const [trait, value] of Object.entries(edge.traits ?? {})) {
    check(graph.designLevels.includes(value), `edge ${edge.id} has invalid ${trait} level ${value}`);
  }
}

const expectedVerticalPairs = [
  "F1_LEFT_STAIR>F2_LEFT_ARRIVAL",
  "F1_RIGHT_STAIR>F2_RIGHT_ARRIVAL",
  "F2_CENTER_STAIR>F3_CENTER_ARRIVAL",
  "F3_LEFT_STAIR>F4_LEFT_ARRIVAL",
  "F3_RIGHT_STAIR>F4_RIGHT_ARRIVAL",
  "F4_CENTER_STAIR>F5_SEARCH_HUB",
];
const actualVerticalPairs = vertical.map(({ from, to }) => `${from}>${to}`).sort();
check(
  JSON.stringify(actualVerticalPairs) === JSON.stringify(expectedVerticalPairs.sort()),
  "vertical stair connections do not match the approved floor structure",
);
for (const connection of vertical) {
  check(connection.type === "STAIR", `${connection.id} must be a stair connection`);
  check(nodeById.has(connection.from) && nodeById.has(connection.to), `${connection.id} refers to an unknown node`);
}

const expectedVillains = new Map([
  ["F2_CENTER_GUARD", 2],
  ["F3_LEFT_GUARD", 2],
  ["F3_RIGHT_GUARD", 2],
  ["F4_CENTER_GUARD", 2],
  ["F5_L1_GUARD", 1],
  ["F5_L2_GUARD", 1],
  ["F5_R1_GUARD", 1],
  ["F5_R2_GUARD", 1],
]);
for (const [nodeId, count] of expectedVillains) {
  check(nodeById.get(nodeId)?.encounter?.villainCount === count, `${nodeId} must contain Villain ×${count}`);
}
const villainTotal = nodes.reduce((sum, node) => sum + (node.encounter?.villainCount ?? 0), 0);
check(villainTotal === 12, `general villain total must be 12, found ${villainTotal}`);
check(
  floors.find(({ floor }) => floor === 1)?.nodes.every((node) => !node.encounter?.villainCount),
  "1F must not contain a stair guard",
);

const roomIds = graph.bossSearch?.roomIds ?? [];
const expectedRoomIds = ["L1", "L2", "R1", "R2"];
check(JSON.stringify(roomIds) === JSON.stringify(expectedRoomIds), "Boss search rooms must be L1/L2/R1/R2");
check(graph.bossSearch?.locationSelection === "SEEDED_RANDOM_PER_EPISODE", "Boss location must be seeded random per Episode");
check(graph.bossSearch?.locationPolicyVisibility === false, "Boss location must be hidden from the Policy");
check(graph.bossSearch?.repeatSelectionAllowed === false, "searched rooms must not be selectable again");
check(graph.bossSearch?.contextKey?.includesHiddenLocation === false, "search context must exclude hidden Boss location");
check(nodeById.get("F5_CONTROL_ROOM")?.type === "CONTROL_ROOM", "fixed 5F Control Room is missing");
for (const roomId of expectedRoomIds) {
  const nodeId = graph.bossSearch?.roomNodeIds?.[roomId];
  check(nodeById.get(nodeId)?.type === "SEARCH_ROOM", `search room ${roomId} is missing`);
}

const canonicalRooms = graph.bossSearch?.contextKey?.canonicalRoomOrder ?? [];
export function makeSearchContextKey(remainingRooms) {
  check(duplicates(remainingRooms).length === 0, "remaining-room input contains a duplicate");
  const unknown = remainingRooms.filter((room) => !canonicalRooms.includes(room));
  check(unknown.length === 0, `remaining-room input contains unknown rooms: ${unknown.join(",")}`);
  const canonical = canonicalRooms.filter((room) => remainingRooms.includes(room));
  return `${graph.bossSearch.contextKey.prefix}[${canonical.join(",")}]`;
}

check(
  makeSearchContextKey(["R2", "L1", "R1", "L2"]) === "F5_ROOM_SEARCH[L1,L2,R1,R2]",
  "full search context key is not canonical",
);
check(
  makeSearchContextKey(["R2", "L2"]) === "F5_ROOM_SEARCH[L2,R2]",
  "subset search context key is not canonical",
);
check(
  nodeById.get("F5_SEARCH_HUB")?.routeContextId === "F5_ROOM_SEARCH[{CANONICAL_REMAINING_ROOMS}]",
  "5F search hub must use the canonical remaining-room context template",
);

const allConnections = [
  ...edges.map(({ from, to }) => ({ from, to })),
  ...vertical.map(({ from, to }) => ({ from, to })),
];
const outgoing = new Map(nodes.map(({ id }) => [id, []]));
for (const { from, to } of allConnections) outgoing.get(from)?.push(to);

const start = graph.goal?.startNodeId;
const goal = graph.goal?.goalNodeId;
const reachable = new Set([start]);
const queue = [start];
while (queue.length) {
  for (const next of outgoing.get(queue.shift()) ?? []) {
    if (!reachable.has(next)) {
      reachable.add(next);
      queue.push(next);
    }
  }
}
const unreachable = nodes.map(({ id }) => id).filter((id) => !reachable.has(id));
check(unreachable.length === 0, `unreachable nodes: ${unreachable.join(", ")}`);
const deadEnds = nodes
  .map(({ id }) => id)
  .filter((id) => id !== goal && (outgoing.get(id)?.length ?? 0) === 0);
check(deadEnds.length === 0, `accidental dead ends: ${deadEnds.join(", ")}`);

// Count only monotonic progression. NO_BOSS_RETURN edges intentionally loop to the
// search hub and are validated separately as Episode search-state transitions.
const progressionConnections = [
  ...edges
    .filter(({ availability }) => availability !== "NO_BOSS_RETURN")
    .map(({ from, to }) => ({ from, to })),
  ...vertical.map(({ from, to }) => ({ from, to })),
];
const progression = new Map(nodes.map(({ id }) => [id, []]));
for (const { from, to } of progressionConnections) progression.get(from)?.push(to);

const visiting = new Set();
const memo = new Map();
function countPaths(from, to) {
  if (from === to) return 1;
  if (memo.has(`${from}>${to}`)) return memo.get(`${from}>${to}`);
  check(!visiting.has(from), `progression graph contains a cycle at ${from}`);
  if (visiting.has(from)) return 0;
  visiting.add(from);
  const count = (progression.get(from) ?? []).reduce(
    (sum, next) => sum + countPaths(next, to),
    0,
  );
  visiting.delete(from);
  memo.set(`${from}>${to}`, count);
  return count;
}

const ingressPathCount = countPaths(start, "F5_SEARCH_HUB");
memo.clear();
const bossRoomBranchCount = countPaths("F5_SEARCH_HUB", goal);
memo.clear();
const structuralCompletePathCount = countPaths(start, goal);
check(ingressPathCount === 16, `expected 16 ingress paths, found ${ingressPathCount}`);
check(bossRoomBranchCount === 4, `expected 4 final Boss-room branches, found ${bossRoomBranchCount}`);
check(structuralCompletePathCount === 64, `expected 64 structural complete paths, found ${structuralCompletePathCount}`);
check(structuralCompletePathCount >= 25, `need at least 25 structural complete paths, found ${structuralCompletePathCount}`);

function permutations(items) {
  if (items.length === 0) return [[]];
  return items.flatMap((item, index) =>
    permutations(items.filter((_, candidateIndex) => candidateIndex !== index)).map((tail) => [item, ...tail]),
  );
}
const searchOrders = permutations(canonicalRooms);
check(searchOrders.length === 24, `expected 24 full search orders, found ${searchOrders.length}`);
check(
  searchOrders.every((order) => new Set(order).size === canonicalRooms.length),
  "search-order generation revisits a room",
);
const ingressSearchCombinations = ingressPathCount * searchOrders.length;
const fixedRouteContextCount = routeContexts.filter((context) => !context.includes("{")).length;
const concreteSearchContextCount = (2 ** canonicalRooms.length) - 1;
const concreteRouteContextCount = fixedRouteContextCount + concreteSearchContextCount;

const expectedViewBox = graph.coordinateSystem?.viewBox;
for (const floor of floors) {
  const filename = `floor_${floor.floor}_blockout.svg`;
  const svgPath = resolve(navigationDir, filename);
  check(existsSync(svgPath), `${filename} is missing`);
  if (!existsSync(svgPath)) continue;
  const svg = readFileSync(svgPath, "utf8");
  check(svg.includes(`viewBox="${expectedViewBox}"`), `${filename} has a mismatched viewBox`);
  check(svg.trimEnd().endsWith("</svg>"), `${filename} is not closed with </svg>`);
  for (const node of floor.nodes) {
    check(svg.includes(`data-node-id="${node.id}"`), `${filename} does not render node ${node.id}`);
  }
  for (const edge of floor.edges) {
    check(svg.includes(`data-edge-id="${edge.id}"`), `${filename} does not render edge ${edge.id}`);
  }
}

if (failures.length) {
  console.error(`FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("PASS navigation_graph_v1");
  console.log(`nodes=${nodes.length} edges=${edges.length} verticalConnections=${vertical.length}`);
  console.log(`routeContextTemplates=${routeContexts.length} concreteRouteContexts=${concreteRouteContextCount}`);
  console.log(`generalVillains=${villainTotal}`);
  console.log(`ingressNavigationPaths=${ingressPathCount}`);
  console.log(`bossRoomFinalBranches=${bossRoomBranchCount}`);
  console.log(`structuralStartToGoalPaths=${structuralCompletePathCount}`);
  console.log(`fullNoRepeatSearchOrders=${searchOrders.length}`);
  console.log(`ingressXSearchOrderCombinations=${ingressSearchCombinations}`);
  console.log("searchOrderMeaning=Episode executes each order only through the hidden Boss room");
}
