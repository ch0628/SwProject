import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const BASE_WIDTH = 1600;
const BASE_HEIGHT = 900;
const PNG_WIDTH = 2560;
const PNG_HEIGHT = 1440;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(scriptDir, "../../docs/modules/machine_learning/reinforcement/navigation");

const palettes = {
  clean: {
    background: "#f7f7f4",
    wall: "#20262b",
    floor: "#d9dee2",
    room: "#eef1f3",
    public: "#e3e8e6",
    service: "#d5dadd",
    security: "#e1e4e7",
    maintenance: "#d4d9dc",
    perimeter: "#e5e8ea",
    search: "#eef1f3",
    control: "#f5f7f3",
    stair: "#aeb8bf",
    gate: "#30363b",
    obstacle: "#20262b",
  },
  spatial: {
    background: "#f4f5f1",
    wall: "#242a2f",
    floor: "#dbe0e3",
    room: "#eef1f3",
    public: "#dbe9df",
    service: "#e5ddd1",
    security: "#dde0eb",
    maintenance: "#ddd8cf",
    perimeter: "#dce9e8",
    search: "#dce9ef",
    control: "#dcebd9",
    stair: "#aeb8bf",
    gate: "#8b5e24",
    obstacle: "#3b4248",
    villain: "#b4232d",
    ambiguous: "#b7791f",
    text: "#172027",
    muted: "#4b5963",
  },
};

const rect = (x, y, width, height, role = "floor", options = {}) => ({
  kind: "rect", x, y, width, height, role, ...options,
});
const line = (x1, y1, x2, y2, role = "wall", width = 6, options = {}) => ({
  kind: "line", x1, y1, x2, y2, role, width, ...options,
});
const circle = (cx, cy, radius, role, options = {}) => ({
  kind: "circle", cx, cy, radius, role, ...options,
});
const label = (x, y, value, size = 20, weight = 600, options = {}) => ({
  kind: "text", x, y, value, size, weight, role: "text", clean: false, ...options,
});
const shell = () => rect(50, 50, 1500, 800, "wall");
const stair = (x, y, width, height, direction = "vertical") => {
  const shapes = [rect(x, y, width, height, "stair")];
  const count = 7;
  for (let index = 1; index < count; index += 1) {
    const ratio = index / count;
    shapes.push(
      direction === "vertical"
        ? line(x + 18, y + height * ratio, x + width - 18, y + height * ratio, "wall", 5)
        : line(x + width * ratio, y + 18, x + width * ratio, y + height - 18, "wall", 5),
    );
  }
  return shapes;
};
const floorTitle = (floor) => label(65, 32, `${floor}F · SPATIAL BLOCKOUT`, 21, 700, { anchor: "start" });
const villainPair = (x, y) => [
  circle(x - 18, y, 12, "villain", { clean: false }),
  circle(x + 18, y, 12, "villain", { clean: false }),
  label(x, y + 34, "V ×2", 15, 700),
];
const villainSingle = (x, y) => [circle(x, y, 12, "villain", { clean: false }), label(x, y + 31, "V ×1", 14, 700)];

const floors = [
  {
    floor: 1,
    shapes: [
      shell(),
      rect(100, 240, 560, 440, "public"),
      rect(220, 190, 110, 100, "public"),
      ...stair(100, 80, 260, 150),
      rect(540, 550, 180, 110, "public"),
      rect(640, 580, 320, 210, "floor"),
      rect(760, 780, 80, 70, "floor"),
      rect(900, 560, 440, 140, "service"),
      rect(1220, 190, 120, 440, "service"),
      ...stair(1130, 80, 300, 150),
      rect(1025, 570, 55, 62, "obstacle"),
      rect(1135, 628, 55, 62, "obstacle"),
      floorTitle(1),
      label(800, 690, "CENTRAL ENTRY / START", 20, 700),
      label(380, 455, "PUBLIC EVACUATION HALL", 20, 700),
      label(230, 165, "LEFT STAIR", 17, 700),
      label(1090, 540, "SERVICE CORRIDOR", 18, 700),
      label(1280, 165, "RIGHT STAIR", 17, 700),
      label(380, 488, "open · direct · citizen-heavy", 15, 500, { role: "muted" }),
      label(1100, 725, "equipment / obstacle pockets", 15, 500, { role: "muted" }),
      circle(275, 535, 9, "ambiguous", { clean: false }),
      circle(320, 560, 9, "ambiguous", { clean: false }),
      circle(365, 530, 9, "ambiguous", { clean: false }),
    ],
  },
  {
    floor: 2,
    shapes: [
      shell(),
      ...stair(80, 650, 260, 140, "horizontal"),
      ...stair(1260, 650, 260, 140, "horizontal"),
      rect(300, 590, 420, 100, "security"),
      rect(650, 490, 100, 200, "security"),
      rect(150, 210, 100, 460, "perimeter"),
      rect(150, 210, 550, 100, "perimeter"),
      rect(880, 590, 420, 100, "security"),
      rect(850, 490, 100, 200, "security"),
      rect(1350, 210, 100, 460, "service"),
      rect(900, 210, 550, 100, "service"),
      rect(650, 270, 300, 240, "floor"),
      rect(740, 190, 120, 100, "floor"),
      ...stair(680, 70, 240, 150),
      floorTitle(2),
      label(210, 730, "LEFT ARRIVAL", 17, 700),
      label(1390, 730, "RIGHT ARRIVAL", 17, 700),
      label(500, 640, "DIRECT OFFICE", 16, 700),
      label(420, 260, "OUTER CORRIDOR", 16, 700),
      label(1100, 640, "INNER HALL", 16, 700),
      label(1180, 260, "SERVICE DETOUR", 16, 700),
      label(800, 430, "CENTER CHOKE POINT", 18, 700),
      label(800, 145, "CENTER STAIR", 17, 700),
      ...villainPair(800, 345),
      circle(500, 625, 9, "ambiguous", { clean: false }),
      circle(1100, 625, 9, "ambiguous", { clean: false }),
    ],
  },
  {
    floor: 3,
    shapes: [
      shell(),
      rect(650, 640, 300, 150, "floor"),
      rect(300, 590, 400, 100, "maintenance"),
      rect(300, 320, 100, 370, "maintenance"),
      rect(160, 250, 260, 120, "maintenance"),
      rect(200, 190, 100, 80, "maintenance"),
      ...stair(80, 70, 260, 150),
      rect(900, 700, 470, 90, "perimeter"),
      rect(1270, 300, 100, 490, "perimeter"),
      rect(1180, 250, 260, 120, "perimeter"),
      rect(1300, 190, 100, 80, "perimeter"),
      ...stair(1260, 70, 260, 150),
      rect(300, 455, 65, 52, "obstacle"),
      rect(355, 525, 45, 52, "obstacle"),
      floorTitle(3),
      label(800, 725, "CENTER ARRIVAL", 18, 700),
      label(350, 635, "MAINTENANCE", 17, 700),
      label(330, 425, "tight / equipment", 14, 500, { role: "muted" }),
      label(210, 320, "GUARD BAY", 15, 700),
      label(210, 145, "LEFT STAIR", 17, 700),
      label(1110, 750, "PERIMETER CORRIDOR", 17, 700),
      label(1310, 320, "GUARD BAY", 15, 700),
      label(1390, 145, "RIGHT STAIR", 17, 700),
      ...villainPair(250, 285),
      ...villainPair(1350, 285),
    ],
  },
  {
    floor: 4,
    shapes: [
      shell(),
      ...stair(80, 650, 260, 140, "horizontal"),
      ...stair(1260, 650, 260, 140, "horizontal"),
      rect(300, 580, 420, 110, "security"),
      rect(650, 490, 100, 200, "security"),
      rect(150, 210, 100, 460, "perimeter"),
      rect(150, 210, 550, 100, "perimeter"),
      rect(880, 580, 420, 110, "security"),
      rect(850, 490, 100, 200, "security"),
      rect(1350, 210, 100, 460, "service"),
      rect(900, 210, 550, 100, "service"),
      rect(650, 270, 300, 240, "floor"),
      rect(740, 190, 120, 100, "floor"),
      ...stair(680, 70, 240, 150),
      line(700, 455, 760, 455, "gate", 9, { clean: false }),
      line(840, 455, 900, 455, "gate", 9, { clean: false }),
      floorTitle(4),
      label(210, 730, "LEFT ARRIVAL", 17, 700),
      label(1390, 730, "RIGHT ARRIVAL", 17, 700),
      label(500, 635, "SECURITY HALL", 16, 700),
      label(420, 260, "PERIMETER DETOUR", 16, 700),
      label(1100, 635, "INNER SECURITY", 16, 700),
      label(1180, 260, "SERVICE ROUTE", 16, 700),
      label(800, 430, "CONTROLLED CHOKE POINT", 18, 700),
      label(800, 145, "CENTER STAIR", 17, 700),
      ...villainPair(800, 345),
      circle(510, 620, 10, "ambiguous", { clean: false }),
      circle(1085, 620, 10, "ambiguous", { clean: false }),
    ],
  },
  {
    floor: 5,
    shapes: [
      shell(),
      rect(650, 650, 300, 150, "floor"),
      rect(760, 790, 80, 60, "floor"),
      rect(330, 600, 940, 100, "floor"),
      rect(340, 180, 120, 480, "floor"),
      rect(1140, 180, 120, 480, "floor"),
      rect(70, 100, 250, 190, "search"),
      rect(300, 170, 120, 90, "search"),
      rect(70, 390, 250, 190, "search"),
      rect(300, 460, 120, 90, "search"),
      rect(1280, 100, 250, 190, "search"),
      rect(1180, 170, 120, 90, "search"),
      rect(1280, 390, 250, 190, "search"),
      rect(1180, 460, 120, 90, "search"),
      rect(740, 390, 120, 300, "floor"),
      rect(650, 330, 300, 130, "floor"),
      rect(740, 250, 120, 100, "control"),
      rect(620, 70, 360, 200, "control"),
      line(740, 304, 785, 304, "gate", 10),
      line(815, 304, 860, 304, "gate", 10),
      ...stair(720, 690, 160, 80),
      floorTitle(5),
      label(800, 760, "CENTRAL SEARCH HUB", 19, 700),
      label(400, 625, "LEFT WING", 16, 700),
      label(1200, 625, "RIGHT WING", 16, 700),
      label(195, 200, "L1", 22, 800),
      label(195, 490, "L2", 22, 800),
      label(1405, 200, "R1", 22, 800),
      label(1405, 490, "R2", 22, 800),
      label(800, 405, "CENTRAL HALL", 17, 700),
      label(800, 175, "CONTROL ROOM", 20, 800),
      label(800, 292, "SECURITY LOCK", 14, 700, { role: "muted" }),
      ...villainSingle(355, 215),
      ...villainSingle(355, 505),
      ...villainSingle(1245, 215),
      ...villainSingle(1245, 505),
    ],
  },
];

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function svgForFloor(floor, mode) {
  const palette = palettes[mode];
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${BASE_WIDTH} ${BASE_HEIGHT}" preserveAspectRatio="xMidYMid meet"${mode === "clean" ? ' aria-hidden="true"' : ' role="img"'}>`,
  ];
  if (mode === "spatial") parts.push(`<title>Floor ${floor.floor} spatial navigation blockout</title>`);
  parts.push(`<rect width="${BASE_WIDTH}" height="${BASE_HEIGHT}" fill="${palette.background}"/>`);

  for (const shape of floor.shapes) {
    if (mode === "clean" && shape.clean === false) continue;
    if (shape.kind === "text") {
      if (mode === "clean") continue;
      const anchor = shape.anchor ?? "middle";
      parts.push(`<text x="${shape.x}" y="${shape.y}" fill="${palette[shape.role] ?? palette.text}" font-family="Arial, sans-serif" font-size="${shape.size}" font-weight="${shape.weight}" text-anchor="${anchor}">${escapeXml(shape.value)}</text>`);
      continue;
    }
    const color = palette[shape.role] ?? shape.role;
    if (shape.kind === "rect") parts.push(`<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" fill="${color}"/>`);
    if (shape.kind === "line") parts.push(`<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="${color}" stroke-width="${shape.width}" stroke-linecap="square"/>`);
    if (shape.kind === "circle") parts.push(`<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.radius}" fill="${color}"/>`);
  }
  parts.push("</svg>");
  return `${parts.join("\n")}\n`;
}

function rgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
}

function fillRect(buffer, width, height, x, y, rectWidth, rectHeight, color) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(width, Math.round(x + rectWidth));
  const y1 = Math.min(height, Math.round(y + rectHeight));
  const [red, green, blue, alpha] = color;
  for (let row = y0; row < y1; row += 1) {
    let offset = (row * width + x0) * 4;
    for (let column = x0; column < x1; column += 1) {
      buffer[offset] = red;
      buffer[offset + 1] = green;
      buffer[offset + 2] = blue;
      buffer[offset + 3] = alpha;
      offset += 4;
    }
  }
}

function drawLine(buffer, width, height, x1, y1, x2, y2, lineWidth, color) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const half = lineWidth / 2;
  for (let index = 0; index <= steps; index += 1) {
    const ratio = index / steps;
    fillRect(buffer, width, height, x1 + dx * ratio - half, y1 + dy * ratio - half, lineWidth, lineWidth, color);
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

function pngForFloor(floor) {
  const scale = PNG_WIDTH / BASE_WIDTH;
  const pixels = Buffer.alloc(PNG_WIDTH * PNG_HEIGHT * 4);
  fillRect(pixels, PNG_WIDTH, PNG_HEIGHT, 0, 0, PNG_WIDTH, PNG_HEIGHT, rgb(palettes.clean.background));
  for (const shape of floor.shapes) {
    if (shape.clean === false || shape.kind === "text" || shape.kind === "circle") continue;
    const color = rgb(palettes.clean[shape.role] ?? shape.role);
    if (shape.kind === "rect") fillRect(pixels, PNG_WIDTH, PNG_HEIGHT, shape.x * scale, shape.y * scale, shape.width * scale, shape.height * scale, color);
    if (shape.kind === "line") drawLine(pixels, PNG_WIDTH, PNG_HEIGHT, shape.x1 * scale, shape.y1 * scale, shape.x2 * scale, shape.y2 * scale, shape.width * scale, color);
  }

  const raw = Buffer.alloc((PNG_WIDTH * 4 + 1) * PNG_HEIGHT);
  for (let row = 0; row < PNG_HEIGHT; row += 1) {
    const rawOffset = row * (PNG_WIDTH * 4 + 1);
    raw[rawOffset] = 0;
    pixels.copy(raw, rawOffset + 1, row * PNG_WIDTH * 4, (row + 1) * PNG_WIDTH * 4);
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

function validateGraphWasNotRedesigned() {
  const graph = JSON.parse(readFileSync(resolve(outputDir, "navigation_graph_v1.json"), "utf8"));
  const nodeCounts = graph.floors.map(({ nodes }) => nodes.length);
  const edgeCounts = graph.floors.map(({ edges }) => edges.length);
  if (JSON.stringify(nodeCounts) !== JSON.stringify([5, 8, 7, 8, 15])) throw new Error("navigation node topology changed");
  if (JSON.stringify(edgeCounts) !== JSON.stringify([4, 9, 6, 9, 21])) throw new Error("navigation edge topology changed");
  if (graph.verticalConnections.length !== 6) throw new Error("vertical stair topology changed");
}

function validateOutputs() {
  for (const floor of floors) {
    const spatialSvg = readFileSync(resolve(outputDir, `floor_${floor.floor}_blockout_spatial.svg`), "utf8");
    if (/marker|arrow|legend|data-node|data-edge/i.test(spatialSvg)) throw new Error(`floor ${floor.floor} spatial SVG contains diagram-only annotation`);
    const spatialFontSizes = [...spatialSvg.matchAll(/font-size="(\d+)"/g)].map((match) => Number(match[1]));
    if (Math.max(...spatialFontSizes) > 22) throw new Error(`floor ${floor.floor} spatial SVG contains oversized presentation text`);
    const cleanSvg = readFileSync(resolve(outputDir, `floor_${floor.floor}_structure_clean.svg`), "utf8");
    if (/<(?:text|title|desc)\b|marker|arrow|legend|data-node|data-edge/i.test(cleanSvg)) throw new Error(`floor ${floor.floor} clean SVG contains a forbidden annotation`);
    const png = readFileSync(resolve(outputDir, `floor_${floor.floor}_structure_clean.png`));
    if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error(`floor ${floor.floor} output is not a PNG`);
    if (png.readUInt32BE(16) !== PNG_WIDTH || png.readUInt32BE(20) !== PNG_HEIGHT) throw new Error(`floor ${floor.floor} PNG dimensions are wrong`);
  }
}

validateGraphWasNotRedesigned();
for (const floor of floors) {
  writeFileSync(resolve(outputDir, `floor_${floor.floor}_blockout_spatial.svg`), svgForFloor(floor, "spatial"));
  writeFileSync(resolve(outputDir, `floor_${floor.floor}_structure_clean.svg`), svgForFloor(floor, "clean"));
  writeFileSync(resolve(outputDir, `floor_${floor.floor}_structure_clean.png`), pngForFloor(floor));
}
validateOutputs();
console.log(`Generated ${floors.length} spatial SVGs, ${floors.length} clean SVGs, and ${floors.length} ${PNG_WIDTH}x${PNG_HEIGHT} PNGs.`);
