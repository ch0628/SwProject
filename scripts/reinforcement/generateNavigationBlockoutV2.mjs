import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

export const BASE_WIDTH = 1600;
export const BASE_HEIGHT = 900;
export const PNG_WIDTH = 2560;
export const PNG_HEIGHT = 1440;

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const outputDir = resolve(scriptDir, "../../docs/modules/machine_learning/reinforcement/navigation_v2");
const graphPath = resolve(scriptDir, "../../docs/modules/machine_learning/reinforcement/navigation/navigation_graph_v1.json");

const palettes = {
  clean: {
    exterior: "#20262d",
    wall: "#939ba2",
    blocked: "#747e86",
    corridor: "#dde2e5",
    room: "#f1f3f4",
    public: "#e9ecec",
    office: "#eceeef",
    service: "#d7dde0",
    maintenance: "#d4dade",
    perimeter: "#e3e7e9",
    security: "#d9dfe3",
    search: "#f1f3f4",
    control: "#eef2ed",
    landing: "#d8dee1",
    stair: "#c2c9ce",
    detail: "#4d5860",
    gate: "#3f494f",
  },
  spatial: {
    exterior: "#20262d",
    wall: "#9099a1",
    blocked: "#68737c",
    corridor: "#d8dee1",
    room: "#edf0f1",
    public: "#dfe9e3",
    office: "#e9e5da",
    service: "#ddd5c9",
    maintenance: "#d8d0c4",
    perimeter: "#d8e5e4",
    security: "#dce0e9",
    search: "#dde8ed",
    control: "#dce9dc",
    landing: "#d5dce0",
    stair: "#b8c2c8",
    detail: "#4d5860",
    gate: "#795b2c",
  },
};

const rect = (tag, x, y, width, height, role, options = {}) => ({
  kind: "rect", tag, x, y, width, height, role, ...options,
});
const walk = (tag, x, y, width, height, role = "corridor", semantic = "walkable") =>
  rect(tag, x, y, width, height, role, { walkable: true, semantic });
const mass = (tag, x, y, width, height, role = "blocked") => rect(tag, x, y, width, height, role, { walkable: false, semantic: "mass" });
const line = (x1, y1, x2, y2, role = "detail", width = 5, options = {}) => ({ kind: "line", x1, y1, x2, y2, role, width, ...options });
const circle = (cx, cy, radius, role = "detail") => ({ kind: "circle", cx, cy, radius, role });
const shell = () => mass("building_envelope", 55, 45, 1490, 810, "wall");

function stair(tag, x, y, width, height, orientation = "vertical") {
  const shapes = [walk(tag, x, y, width, height, "stair", "stair")];
  const stepCount = 8;
  for (let index = 1; index < stepCount; index += 1) {
    const ratio = index / stepCount;
    shapes.push(
      orientation === "vertical"
        ? line(x + 18, y + height * ratio, x + width - 18, y + height * ratio, "detail", 5, { architectural: "stair_tread" })
        : line(x + width * ratio, y + 18, x + width * ratio, y + height - 18, "detail", 5, { architectural: "stair_tread" }),
    );
  }
  return shapes;
}

const f1 = {
  floor: 1,
  stairs: ["f1_left_stair", "f1_right_stair"],
  searchRooms: [],
  controlRooms: [],
  routes: [
    ["f1_entry", "f1_lobby", "f1_left_connector", "f1_public_spine", "f1_public_vertical", "f1_left_landing", "f1_left_stair"],
    ["f1_entry", "f1_lobby", "f1_right_connector", "f1_service_lower", "f1_service_vertical", "f1_right_landing", "f1_right_stair"],
  ],
  shapes: [
    shell(),
    walk("f1_entry", 710, 780, 180, 75, "public", "entrance"),
    walk("f1_lobby", 620, 645, 360, 150, "public", "hub"),
    walk("f1_left_connector", 500, 610, 145, 85, "public"),
    walk("f1_public_spine", 170, 535, 430, 95, "public"),
    walk("f1_public_vertical", 170, 205, 105, 425, "public"),
    walk("f1_left_landing", 95, 140, 285, 110, "landing", "landing"),
    ...stair("f1_left_stair", 120, 65, 235, 135),
    walk("f1_reception", 100, 650, 350, 130, "public", "room"),
    walk("f1_reception_door", 420, 620, 100, 55, "public", "door"),
    walk("f1_waiting", 305, 360, 260, 150, "public", "room"),
    walk("f1_waiting_door", 250, 405, 80, 60, "public", "door"),
    walk("f1_meeting", 315, 175, 275, 135, "room", "room"),
    walk("f1_meeting_door", 250, 225, 90, 55, "public", "door"),
    walk("f1_public_nook", 80, 335, 105, 130, "room", "nook"),
    walk("f1_right_connector", 955, 655, 170, 80, "service"),
    walk("f1_service_lower", 1080, 610, 310, 125, "service"),
    walk("f1_service_vertical", 1275, 200, 115, 535, "service"),
    walk("f1_right_landing", 1165, 140, 300, 110, "landing", "landing"),
    ...stair("f1_right_stair", 1200, 65, 235, 135),
    walk("f1_storage_a", 1030, 430, 210, 125, "service", "room"),
    walk("f1_storage_a_door", 1220, 465, 80, 55, "service", "door"),
    walk("f1_mechanical", 1040, 255, 200, 120, "service", "room"),
    walk("f1_mechanical_door", 1220, 285, 80, 55, "service", "door"),
    walk("f1_service_nook", 1375, 335, 125, 135, "service", "nook"),
    mass("f1_central_cluster", 625, 205, 390, 385, "blocked"),
    mass("f1_core_inner", 715, 285, 210, 205, "wall"),
    line(670, 255, 970, 255, "detail", 6),
    line(670, 535, 970, 535, "detail", 6),
    circle(705, 705, 13), circle(800, 705, 13), circle(895, 705, 13),
  ],
};

const f2 = {
  floor: 2,
  stairs: ["f2_left_arrival", "f2_right_arrival", "f2_center_stair"],
  searchRooms: [],
  controlRooms: [],
  routes: [
    ["f2_left_arrival", "f2_left_landing", "f2_left_direct", "f2_left_inner", "f2_convergence", "f2_center_neck", "f2_center_landing", "f2_center_stair"],
    ["f2_left_arrival", "f2_left_landing", "f2_left_outer_v", "f2_left_outer_t", "f2_convergence", "f2_center_neck", "f2_center_landing", "f2_center_stair"],
    ["f2_right_arrival", "f2_right_landing", "f2_right_direct", "f2_right_inner", "f2_convergence", "f2_center_neck", "f2_center_landing", "f2_center_stair"],
    ["f2_right_arrival", "f2_right_landing", "f2_right_outer_v", "f2_right_outer_t", "f2_convergence", "f2_center_neck", "f2_center_landing", "f2_center_stair"],
  ],
  shapes: [
    shell(),
    ...stair("f2_left_arrival", 70, 710, 245, 115, "horizontal"),
    walk("f2_left_landing", 70, 640, 300, 110, "landing", "landing"),
    walk("f2_left_direct", 315, 610, 345, 85, "office"),
    walk("f2_left_inner", 575, 400, 90, 295, "office"),
    walk("f2_left_outer_v", 110, 210, 90, 455, "perimeter"),
    walk("f2_left_outer_t", 110, 210, 530, 90, "perimeter"),
    ...stair("f2_right_arrival", 1285, 710, 245, 115, "horizontal"),
    walk("f2_right_landing", 1230, 640, 300, 110, "landing", "landing"),
    walk("f2_right_direct", 940, 610, 345, 85, "office"),
    walk("f2_right_inner", 935, 400, 90, 295, "office"),
    walk("f2_right_outer_v", 1400, 210, 90, 455, "service"),
    walk("f2_right_outer_t", 960, 210, 530, 90, "service"),
    walk("f2_convergence", 600, 235, 400, 185, "corridor", "convergence"),
    walk("f2_center_neck", 740, 155, 120, 100, "corridor", "choke"),
    walk("f2_center_landing", 650, 90, 300, 100, "landing", "landing"),
    ...stair("f2_center_stair", 690, 50, 220, 115),
    walk("f2_office_l1", 235, 335, 245, 145, "office", "room"),
    walk("f2_office_l1_door", 180, 370, 80, 55, "office", "door"),
    walk("f2_office_l2", 300, 500, 210, 80, "office", "room"),
    walk("f2_office_l2_door", 475, 550, 125, 45, "office", "door"),
    walk("f2_tech_r1", 1120, 335, 245, 145, "service", "room"),
    walk("f2_tech_r1_door", 1340, 370, 80, 55, "service", "door"),
    walk("f2_tech_r2", 1090, 500, 210, 80, "service", "room"),
    walk("f2_tech_r2_door", 1000, 550, 115, 45, "service", "door"),
    mass("f2_center_core", 705, 465, 190, 120, "blocked"),
    line(625, 330, 975, 330, "detail", 5),
    circle(675, 285, 11), circle(925, 285, 11),
  ],
};

const f3 = {
  floor: 3,
  stairs: ["f3_center_arrival", "f3_left_stair", "f3_right_stair"],
  searchRooms: [],
  controlRooms: [],
  routes: [
    ["f3_center_arrival", "f3_center_landing", "f3_left_lower", "f3_left_maintenance", "f3_left_guard", "f3_left_landing", "f3_left_stair"],
    ["f3_center_arrival", "f3_center_landing", "f3_right_lower", "f3_right_perimeter", "f3_right_guard", "f3_right_landing", "f3_right_stair"],
  ],
  shapes: [
    shell(),
    ...stair("f3_center_arrival", 690, 755, 220, 95),
    walk("f3_center_landing", 640, 675, 320, 130, "landing", "landing"),
    walk("f3_left_lower", 445, 635, 215, 90, "maintenance"),
    walk("f3_left_maintenance", 395, 320, 100, 405, "maintenance"),
    walk("f3_left_guard", 245, 250, 270, 130, "maintenance", "choke"),
    walk("f3_left_landing", 105, 135, 330, 150, "landing", "landing"),
    ...stair("f3_left_stair", 135, 60, 235, 135),
    walk("f3_right_lower", 930, 710, 440, 80, "perimeter"),
    walk("f3_right_perimeter", 1280, 235, 90, 555, "perimeter"),
    walk("f3_right_guard", 1120, 205, 270, 130, "perimeter", "choke"),
    walk("f3_right_landing", 1165, 125, 325, 125, "landing", "landing"),
    ...stair("f3_right_stair", 1210, 55, 235, 130),
    walk("f3_pump_room", 90, 410, 255, 160, "maintenance", "room"),
    walk("f3_pump_door", 325, 455, 90, 60, "maintenance", "door"),
    walk("f3_electrical", 520, 410, 165, 130, "service", "room"),
    walk("f3_electrical_door", 475, 445, 70, 55, "maintenance", "door"),
    walk("f3_lab_r1", 1050, 390, 185, 135, "room", "room"),
    walk("f3_lab_r1_door", 1210, 430, 90, 55, "perimeter", "door"),
    walk("f3_lab_r2", 1015, 560, 220, 110, "room", "room"),
    walk("f3_lab_r2_door", 1210, 590, 90, 55, "perimeter", "door"),
    mass("f3_central_facility_core", 700, 230, 300, 360, "blocked"),
    mass("f3_core_service_shaft", 785, 315, 130, 190, "wall"),
    mass("f3_maintenance_baffle_a", 395, 455, 55, 50, "blocked"),
    mass("f3_maintenance_baffle_b", 440, 535, 55, 50, "blocked"),
    circle(715, 705, 12), circle(885, 705, 12),
  ],
};

const f4 = {
  floor: 4,
  stairs: ["f4_left_arrival", "f4_right_arrival", "f4_center_stair"],
  searchRooms: [],
  controlRooms: [],
  routes: [
    ["f4_left_arrival", "f4_left_landing", "f4_left_security", "f4_left_inner", "f4_convergence", "f4_center_neck", "f4_center_landing", "f4_center_stair"],
    ["f4_left_arrival", "f4_left_landing", "f4_left_outer_v", "f4_left_outer_t", "f4_convergence", "f4_center_neck", "f4_center_landing", "f4_center_stair"],
    ["f4_right_arrival", "f4_right_landing", "f4_right_security", "f4_right_inner", "f4_convergence", "f4_center_neck", "f4_center_landing", "f4_center_stair"],
    ["f4_right_arrival", "f4_right_landing", "f4_right_outer_v", "f4_right_outer_t", "f4_convergence", "f4_center_neck", "f4_center_landing", "f4_center_stair"],
  ],
  shapes: [
    shell(),
    ...stair("f4_left_arrival", 70, 710, 245, 115, "horizontal"),
    walk("f4_left_landing", 70, 640, 300, 110, "landing", "landing"),
    walk("f4_left_security", 310, 600, 350, 95, "security"),
    walk("f4_left_inner", 575, 405, 90, 290, "security"),
    walk("f4_left_outer_v", 110, 195, 90, 470, "perimeter"),
    walk("f4_left_outer_t", 110, 195, 530, 90, "perimeter"),
    ...stair("f4_right_arrival", 1285, 710, 245, 115, "horizontal"),
    walk("f4_right_landing", 1230, 640, 300, 110, "landing", "landing"),
    walk("f4_right_security", 940, 600, 350, 95, "security"),
    walk("f4_right_inner", 935, 405, 90, 290, "security"),
    walk("f4_right_outer_v", 1400, 195, 90, 470, "service"),
    walk("f4_right_outer_t", 960, 195, 530, 90, "service"),
    walk("f4_convergence", 590, 225, 420, 200, "security", "convergence"),
    walk("f4_center_neck", 740, 150, 120, 95, "security", "choke"),
    walk("f4_center_landing", 650, 85, 300, 100, "landing", "landing"),
    ...stair("f4_center_stair", 690, 45, 220, 115),
    walk("f4_security_office_l", 235, 325, 255, 150, "security", "room"),
    walk("f4_security_office_l_door", 180, 365, 80, 55, "security", "door"),
    walk("f4_screening_l", 300, 505, 215, 70, "security", "room"),
    walk("f4_screening_l_door", 490, 530, 110, 45, "security", "door"),
    walk("f4_security_office_r", 1110, 325, 255, 150, "security", "room"),
    walk("f4_security_office_r_door", 1340, 365, 80, 55, "security", "door"),
    walk("f4_screening_r", 1085, 505, 215, 70, "security", "room"),
    walk("f4_screening_r_door", 1000, 530, 110, 45, "security", "door"),
    mass("f4_evidence_core", 700, 470, 200, 115, "blocked"),
    mass("f4_security_booth_l", 630, 330, 65, 75, "blocked"),
    mass("f4_security_booth_r", 905, 330, 65, 75, "blocked"),
    line(705, 315, 770, 315, "gate", 10),
    line(830, 315, 895, 315, "gate", 10),
    circle(690, 265, 10), circle(910, 265, 10),
  ],
};

const f5 = {
  floor: 5,
  stairs: ["f5_center_arrival"],
  searchRooms: ["f5_room_l1", "f5_room_l2", "f5_room_r1", "f5_room_r2"],
  controlRooms: ["f5_control_room"],
  routes: [
    ["f5_center_arrival", "f5_search_hub", "f5_cross_corridor", "f5_left_wing", "f5_l1_vestibule", "f5_room_l1"],
    ["f5_center_arrival", "f5_search_hub", "f5_cross_corridor", "f5_left_wing", "f5_l2_vestibule", "f5_room_l2"],
    ["f5_center_arrival", "f5_search_hub", "f5_cross_corridor", "f5_right_wing", "f5_r1_vestibule", "f5_room_r1"],
    ["f5_center_arrival", "f5_search_hub", "f5_cross_corridor", "f5_right_wing", "f5_r2_vestibule", "f5_room_r2"],
    ["f5_center_arrival", "f5_search_hub", "f5_control_corridor", "f5_central_hall", "f5_control_neck", "f5_control_room"],
  ],
  shapes: [
    shell(),
    ...stair("f5_center_arrival", 700, 755, 200, 95),
    walk("f5_search_hub", 620, 650, 360, 155, "corridor", "hub"),
    walk("f5_cross_corridor", 390, 600, 820, 105, "corridor"),
    walk("f5_left_wing", 390, 150, 100, 555, "corridor", "wing"),
    walk("f5_right_wing", 1110, 150, 100, 555, "corridor", "wing"),
    walk("f5_room_l1", 75, 75, 300, 210, "search", "search_room"),
    walk("f5_l1_vestibule", 350, 145, 90, 100, "search", "guard_vestibule"),
    walk("f5_room_l2", 75, 370, 300, 220, "search", "search_room"),
    walk("f5_l2_vestibule", 350, 445, 90, 100, "search", "guard_vestibule"),
    walk("f5_room_r1", 1225, 75, 300, 210, "search", "search_room"),
    walk("f5_r1_vestibule", 1160, 145, 90, 100, "search", "guard_vestibule"),
    walk("f5_room_r2", 1225, 370, 300, 220, "search", "search_room"),
    walk("f5_r2_vestibule", 1160, 445, 90, 100, "search", "guard_vestibule"),
    walk("f5_control_corridor", 750, 390, 100, 315, "corridor"),
    walk("f5_central_hall", 640, 315, 320, 145, "corridor", "convergence"),
    walk("f5_control_neck", 750, 240, 100, 100, "control", "choke"),
    walk("f5_control_room", 610, 65, 380, 205, "control", "control_room"),
    mass("f5_l1_structural_bay", 95, 95, 70, 55, "blocked"),
    mass("f5_l2_structural_bay", 95, 515, 70, 55, "blocked"),
    mass("f5_r1_structural_bay", 1435, 95, 70, 55, "blocked"),
    mass("f5_r2_structural_bay", 1435, 515, 70, 55, "blocked"),
    mass("f5_left_service_recess", 500, 470, 110, 85, "blocked"),
    mass("f5_right_service_recess", 990, 470, 110, 85, "blocked"),
    mass("f5_control_core_l", 665, 90, 60, 65, "blocked"),
    mass("f5_control_core_r", 875, 90, 60, 65, "blocked"),
    line(750, 292, 790, 292, "gate", 10),
    line(810, 292, 850, 292, "gate", 10),
    circle(690, 690, 12), circle(800, 690, 12), circle(910, 690, 12),
  ],
};

export const floors = [f1, f2, f3, f4, f5];

export function svgForShapes(shapes, palette) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${BASE_WIDTH} ${BASE_HEIGHT}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" shape-rendering="geometricPrecision">`,
    `<rect width="${BASE_WIDTH}" height="${BASE_HEIGHT}" fill="${palette.exterior}"/>`,
  ];
  for (const shape of shapes) {
    const color = palette[shape.role];
    if (!color) throw new Error(`unknown ${mode} palette role ${shape.role}`);
    if (shape.kind === "rect") parts.push(`<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" fill="${color}"/>`);
    if (shape.kind === "line") parts.push(`<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="${color}" stroke-width="${shape.width}" stroke-linecap="square"/>`);
    if (shape.kind === "circle") parts.push(`<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.radius}" fill="${color}"/>`);
  }
  parts.push("</svg>");
  return `${parts.join("\n")}\n`;
}

function svgForFloor(floor, mode) {
  return svgForShapes(floor.shapes, palettes[mode]);
}

function rgba(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
}

function fillRect(buffer, width, height, x, y, rectWidth, rectHeight, color) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(width, Math.round(x + rectWidth));
  const y1 = Math.min(height, Math.round(y + rectHeight));
  for (let row = y0; row < y1; row += 1) {
    let offset = (row * width + x0) * 4;
    for (let column = x0; column < x1; column += 1) {
      buffer[offset] = color[0];
      buffer[offset + 1] = color[1];
      buffer[offset + 2] = color[2];
      buffer[offset + 3] = color[3];
      offset += 4;
    }
  }
}

function fillCircle(buffer, width, height, cx, cy, radius, color) {
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y += 1) {
    const span = Math.sqrt(Math.max(0, radius * radius - (y - cy) ** 2));
    fillRect(buffer, width, height, cx - span, y, span * 2, 1, color);
  }
}

function drawLine(buffer, width, height, x1, y1, x2, y2, lineWidth, color) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let index = 0; index <= steps; index += 1) {
    const ratio = index / steps;
    fillCircle(buffer, width, height, x1 + dx * ratio, y1 + dy * ratio, lineWidth / 2, color);
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

export function pngForShapes(shapes, palette) {
  const scale = PNG_WIDTH / BASE_WIDTH;
  const pixels = Buffer.alloc(PNG_WIDTH * PNG_HEIGHT * 4);
  fillRect(pixels, PNG_WIDTH, PNG_HEIGHT, 0, 0, PNG_WIDTH, PNG_HEIGHT, rgba(palette.exterior));
  for (const shape of shapes) {
    const color = rgba(palette[shape.role]);
    if (shape.kind === "rect") fillRect(pixels, PNG_WIDTH, PNG_HEIGHT, shape.x * scale, shape.y * scale, shape.width * scale, shape.height * scale, color);
    if (shape.kind === "line") drawLine(pixels, PNG_WIDTH, PNG_HEIGHT, shape.x1 * scale, shape.y1 * scale, shape.x2 * scale, shape.y2 * scale, shape.width * scale, color);
    if (shape.kind === "circle") fillCircle(pixels, PNG_WIDTH, PNG_HEIGHT, shape.cx * scale, shape.cy * scale, shape.radius * scale, color);
  }
  const raw = Buffer.alloc((PNG_WIDTH * 4 + 1) * PNG_HEIGHT);
  for (let row = 0; row < PNG_HEIGHT; row += 1) {
    const offset = row * (PNG_WIDTH * 4 + 1);
    raw[offset] = 0;
    pixels.copy(raw, offset + 1, row * PNG_WIDTH * 4, (row + 1) * PNG_WIDTH * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(PNG_WIDTH, 0);
  ihdr.writeUInt32BE(PNG_HEIGHT, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngForFloor(floor, mode) {
  return pngForShapes(floor.shapes, palettes[mode]);
}

function assertGraphContract() {
  const graph = JSON.parse(readFileSync(graphPath, "utf8"));
  const nodeCounts = graph.floors.map(({ nodes }) => nodes.length);
  const edgeCounts = graph.floors.map(({ edges }) => edges.length);
  if (JSON.stringify(nodeCounts) !== JSON.stringify([5, 8, 7, 8, 15])) throw new Error("navigation_graph_v1 node topology changed");
  if (JSON.stringify(edgeCounts) !== JSON.stringify([4, 9, 6, 9, 21])) throw new Error("navigation_graph_v1 edge topology changed");
  if (graph.verticalConnections.length !== 6) throw new Error("navigation_graph_v1 stair topology changed");
  if (/elevator/i.test(JSON.stringify(graph))) throw new Error("navigation_graph_v1 unexpectedly contains an elevator");
}

export function generate() {
  assertGraphContract();
  for (const floor of floors) {
    for (const mode of ["spatial", "clean"]) {
      const stem = mode === "spatial" ? `floor_${floor.floor}_blockout_spatial_v2` : `floor_${floor.floor}_structure_clean_v2`;
      writeFileSync(resolve(outputDir, `${stem}.svg`), svgForFloor(floor, mode));
      writeFileSync(resolve(outputDir, `${stem}.png`), pngForFloor(floor, mode));
    }
  }
  console.log(`Generated 20 navigation v2 exports at ${PNG_WIDTH}x${PNG_HEIGHT} PNG resolution.`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) generate();
