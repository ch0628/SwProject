import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PNG_HEIGHT,
  PNG_WIDTH,
  floors,
  outputDir,
  pngForShapes,
  svgForShapes,
} from "./generateNavigationBlockoutV2.mjs";

export const WALL_THICKNESS = 20;

export const archPalette = {
  exterior: "#171c21",
  solidWall: "#59636b",
  blocked: "#657078",
  floor: "#e5e9eb",
  roomFloor: "#f2f3f3",
  doorFloor: "#eef0f1",
  landing: "#d8dfe3",
  stair: "#cbd3d8",
  stairTread: "#465159",
  gate: "#59636b",
};

const cloneRect = (shape, role) => ({ ...shape, role });
const isRoom = ({ semantic }) => ["room", "search_room", "control_room"].includes(semantic);
const isOpening = ({ semantic }) => semantic === "door" || ["guard_vestibule", "choke"].includes(semantic);
const wallBand = (shape) => ({
  kind: "rect",
  x: shape.x - WALL_THICKNESS,
  y: shape.y - WALL_THICKNESS,
  width: shape.width + WALL_THICKNESS * 2,
  height: shape.height + WALL_THICKNESS * 2,
  role: "solidWall",
});

function floorRole(shape) {
  if (shape.semantic === "door") return "doorFloor";
  if (shape.semantic === "landing") return "landing";
  if (shape.semantic === "stair") return "stair";
  if (isRoom(shape)) return "roomFloor";
  return "floor";
}

export function architecturalShapes(floor) {
  const shell = floor.shapes.find(({ tag }) => tag === "building_envelope");
  const walkables = floor.shapes.filter(({ kind, walkable }) => kind === "rect" && walkable);
  const rooms = walkables.filter(isRoom);
  const nonRooms = walkables.filter((shape) => !isRoom(shape));
  const openings = nonRooms.filter(isOpening);
  const circulation = nonRooms.filter((shape) => !isOpening(shape));
  const masses = floor.shapes.filter(({ kind, semantic, tag }) => kind === "rect" && semantic === "mass" && tag !== "building_envelope");
  const details = floor.shapes
    .filter(({ kind, architectural, role }) => kind === "line" && (architectural === "stair_tread" || role === "gate"))
    .map((shape) => ({ ...shape, role: shape.architectural === "stair_tread" ? "stairTread" : "gate" }));
  const stairDetails = details.filter(({ role }) => role === "stairTread");
  const gateDetails = details.filter(({ role }) => role === "gate");
  const derivedLandings = floor.floor === 5
    ? [{ kind: "rect", x: 650, y: 700, width: 300, height: 105, role: "landing", walkable: true, semantic: "landing" }]
    : [];

  return [
    cloneRect(shell, "solidWall"),
    ...nonRooms.map(wallBand),
    ...circulation.map((shape) => cloneRect(shape, floorRole(shape))),
    ...stairDetails,
    ...rooms.map(wallBand),
    ...rooms.map((shape) => cloneRect(shape, "roomFloor")),
    ...derivedLandings,
    ...openings.map((shape) => cloneRect(shape, "doorFloor")),
    ...masses.map((shape) => cloneRect(shape, shape.role === "wall" ? "solidWall" : "blocked")),
    ...gateDetails,
  ];
}

export function generate() {
  for (const floor of floors) {
    const shapes = architecturalShapes(floor);
    const stem = `floor_${floor.floor}_structure_arch_v3`;
    writeFileSync(resolve(outputDir, `${stem}.svg`), svgForShapes(shapes, archPalette));
    writeFileSync(resolve(outputDir, `${stem}.png`), pngForShapes(shapes, archPalette));
  }
  console.log(`Generated 10 navigation v3 architectural exports at ${PNG_WIDTH}x${PNG_HEIGHT} PNG resolution.`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generate();
