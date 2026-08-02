/**
 * Export a structured, bilingual Excalidraw journey as self-theming SVGs.
 *
 * Excalidraw remains the editable source. The web export deliberately uses a
 * fixed geometry for both languages: translated text can wrap differently,
 * but boxes, paths, and arrow targets stay identical.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VIEWBOX = { width: 750, height: 1000 };
const STAGES = [
  {
    box: [40, 35, 670, 195],
    labelY: 66,
    nodes: [
      [55, 96, 205, 92],
      [300, 96, 175, 92],
      [515, 96, 180, 92],
    ],
  },
  {
    box: [40, 400, 670, 170],
    labelY: 432,
    nodes: [
      [85, 461, 300, 76],
      [455, 461, 210, 76],
    ],
  },
  {
    box: [105, 610, 540, 145],
    labelY: 641,
    nodes: [
      [150, 666, 160, 62],
      [420, 666, 180, 62],
    ],
  },
  {
    box: [40, 795, 670, 170],
    labelY: 827,
    nodes: [
      [80, 856, 300, 76],
      [450, 856, 220, 76],
    ],
  },
];
const RUPTURE = [160, 270, 430, 90];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function contains(outer, inner) {
  if (outer.width * outer.height <= inner.width * inner.height) return false;
  const centerX = inner.x + inner.width / 2;
  const centerY = inner.y + inner.height / 2;
  return (
    centerX > outer.x &&
    centerX < outer.x + outer.width &&
    centerY > outer.y &&
    centerY < outer.y + outer.height
  );
}

function extractJourney(file) {
  const scene = JSON.parse(fs.readFileSync(file, "utf8"));
  if (scene.type !== "excalidraw") throw new Error(`${file}: not an Excalidraw scene`);

  const elements = scene.elements.filter((element) => !element.isDeleted);
  const rectangles = elements.filter((element) => element.type === "rectangle");
  const arrows = elements.filter((element) => element.type === "arrow");
  const textByContainer = new Map(
    elements
      .filter((element) => element.type === "text" && element.containerId)
      .map((element) => [element.containerId, element.text.replace(/\s*\n\s*/g, " ").trim()])
  );

  const stageRects = rectangles
    .filter((rectangle) => rectangles.some((candidate) => candidate !== rectangle && contains(rectangle, candidate)))
    .sort((a, b) => a.y - b.y);
  const childIds = new Set();
  const stages = stageRects.map((stage) => {
    const children = rectangles
      .filter((rectangle) => rectangle !== stage && contains(stage, rectangle))
      .sort((a, b) => a.x - b.x);
    children.forEach((child) => childIds.add(child.id));
    return {
      label: textByContainer.get(stage.id),
      nodes: children.map((child) => textByContainer.get(child.id)),
    };
  });
  const ruptureRect = rectangles.find(
    (rectangle) => !stageRects.includes(rectangle) && !childIds.has(rectangle.id)
  );
  const rupture = ruptureRect && textByContainer.get(ruptureRect.id);

  if (stages.length !== STAGES.length || stages.some((stage, index) => stage.nodes.length !== STAGES[index].nodes.length)) {
    throw new Error(`${file}: expected four stages with 3, 2, 2, and 2 nodes`);
  }
  if (!rupture) throw new Error(`${file}: expected one standalone rupture node`);
  if (arrows.length !== 9) throw new Error(`${file}: expected nine logical arrows, found ${arrows.length}`);
  if (stages.some((stage) => !stage.label || stage.nodes.some((node) => !node))) {
    throw new Error(`${file}: every stage and node must have bound text`);
  }

  return { stages, rupture };
}

function wrapText(text, width, fontSize) {
  const max = Math.max(8, Math.floor(width / (fontSize * 0.54)));
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > max) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= 2) return lines;
  return [lines[0], lines.slice(1).join(" ")];
}

function centeredText(text, box, className, fontSize) {
  const [x, y, width, height] = box;
  const lines = wrapText(text, width - 28, fontSize);
  const lineHeight = fontSize * 1.16;
  const firstY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
  return `<text class="${className}" x="${x + width / 2}" y="${firstY.toFixed(1)}">${lines
    .map((line, index) => `<tspan x="${x + width / 2}" dy="${index ? lineHeight.toFixed(1) : 0}">${escapeXml(line)}</tspan>`)
    .join("")}</text>`;
}

function arrow(x1, y1, x2, y2, markerId) {
  return `<path class="path" d="M ${x1} ${y1} L ${x2} ${y2}" marker-end="url(#${markerId})"/>`;
}

function render(scene, { language, ariaLabel }) {
  const markerId = `image-note-arrow-${language}`;
  const shapes = [];
  const labels = [];
  const paths = [];

  scene.stages.forEach((stage, stageIndex) => {
    const geometry = STAGES[stageIndex];
    const [x, y, width, height] = geometry.box;
    shapes.push(`<rect class="stage" x="${x}" y="${y}" width="${width}" height="${height}" rx="22"/>`);
    labels.push(
      `<text class="stage-label" x="${x + width / 2}" y="${geometry.labelY}">${escapeXml(stage.label)}</text>`
    );
    stage.nodes.forEach((node, nodeIndex) => {
      const nodeBox = geometry.nodes[nodeIndex];
      const [nodeX, nodeY, nodeWidth, nodeHeight] = nodeBox;
      shapes.push(
        `<rect class="node" x="${nodeX}" y="${nodeY}" width="${nodeWidth}" height="${nodeHeight}" rx="${Math.min(30, nodeHeight / 2)}"/>`
      );
      labels.push(centeredText(node, nodeBox, "node-label", 25));
      if (nodeIndex) {
        const previous = geometry.nodes[nodeIndex - 1];
        paths.push(
          arrow(previous[0] + previous[2] + 8, previous[1] + previous[3] / 2, nodeX - 10, nodeY + nodeHeight / 2, markerId)
        );
      }
    });
  });

  const [ruptureX, ruptureY, ruptureWidth, ruptureHeight] = RUPTURE;
  shapes.push(
    `<rect class="node rupture" x="${ruptureX}" y="${ruptureY}" width="${ruptureWidth}" height="${ruptureHeight}" rx="${ruptureHeight / 2}"/>`
  );
  labels.push(centeredText(scene.rupture, RUPTURE, "rupture-label", 27));

  paths.push(arrow(375, 238, 375, 262, markerId));
  paths.push(arrow(375, 368, 375, 392, markerId));
  paths.push(arrow(375, 578, 375, 602, markerId));
  paths.push(arrow(375, 763, 375, 787, markerId));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX.width} ${VIEWBOX.height}" role="img" aria-label="${escapeXml(ariaLabel)}">
  <style>
    .stage { fill: none; stroke: #77777d; stroke-width: 1.6; stroke-dasharray: 7 8; }
    .node { fill: #f3f3f2; stroke: #29292c; stroke-width: 1.8; }
    .rupture { stroke-width: 3; }
    .path { fill: none; stroke: #29292c; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .stage-label, .node-label, .rupture-label {
      fill: #202023;
      font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
      text-anchor: middle;
      dominant-baseline: middle;
    }
    .stage-label { font-size: 20px; font-weight: 700; letter-spacing: 1.1px; }
    .node-label { font-size: 25px; font-weight: 600; }
    .rupture-label { font-size: 27px; font-weight: 700; }
    @media (prefers-color-scheme: dark) {
      .stage { stroke: #88888f; }
      .node { fill: #19191c; stroke: #e7e7e9; }
      .path { stroke: #e7e7e9; }
      .stage-label, .node-label, .rupture-label { fill: #f2f2f3; }
    }
  </style>
  <defs>
    <marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path class="path" d="M 1 1 L 9 5 L 1 9"/>
    </marker>
  </defs>
  <g aria-hidden="true">
    ${shapes.join("\n    ")}
    ${paths.join("\n    ")}
    ${labels.join("\n    ")}
  </g>
</svg>
`;
}

export function exportImageNote(basePath) {
  const variants = [
    {
      language: "en",
      source: `${basePath}.excalidraw`,
      output: `${basePath}.svg`,
      ariaLabel: "Life journey from Kramatorsk through wartime relocation to education in Canada",
    },
    {
      language: "uk",
      source: `${basePath}.uk.excalidraw`,
      output: `${basePath}.uk.svg`,
      ariaLabel: "Життєвий шлях із Краматорська через переїзд під час війни до навчання в Канаді",
    },
  ];
  for (const variant of variants) {
    const scene = extractJourney(variant.source);
    fs.writeFileSync(variant.output, render(scene, variant));
  }
  return variants.map((variant) => variant.output);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const basePath = process.argv[2] ?? path.join(process.cwd(), "vault/Posts/attachments/image-note-life-timeline");
  for (const file of exportImageNote(basePath)) console.log(`[export-image-note] wrote ${path.relative(process.cwd(), file)}`);
}
