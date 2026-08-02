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
const STAGE_COUNTS = [3, 2, 2, 2];
const GEOMETRY = {
  kramatorsk: {
    box: [55, 35, 640, 190],
    nodes: [
      [75, 100, 190, 76],
      [300, 100, 190, 76],
      [525, 100, 145, 76],
    ],
  },
  rupture: [200, 270, 350, 88],
  relocation: {
    box: [55, 405, 640, 185],
    nodes: [
      [90, 472, 260, 78],
      [430, 472, 230, 78],
    ],
  },
  canada: {
    box: [55, 650, 640, 305],
    places: [
      [90, 715, 180, 70],
      [480, 715, 170, 70],
    ],
    education: [
      [80, 850, 285, 78],
      [445, 850, 210, 78],
    ],
  },
};

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

  if (stages.length !== STAGE_COUNTS.length || stages.some((stage, index) => stage.nodes.length !== STAGE_COUNTS[index])) {
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

function splitParts(text) {
  return text.split(/\s+·\s+/).map((part) => part.trim());
}

function model(scene, language) {
  const [kramatorskIndex, kramatorsk, kramatorskYears] = splitParts(scene.stages[0].label);
  const [relocationIndex, relocation, relocationYear] = splitParts(scene.stages[1].label);
  const [warDate, war] = splitParts(scene.rupture);
  const [romaniaDate, romania, romaniaDuration] = splitParts(scene.stages[1].nodes[0]);
  const [canadaDate, canada] = splitParts(scene.stages[1].nodes[1]);
  const schoolMatch = scene.stages[0].nodes[2].match(/^(.*?)\s*\((.*?)\)$/);
  const [sacredYears, sacred] = splitParts(scene.stages[3].nodes[0]);
  const [now, tmu, program] = splitParts(scene.stages[3].nodes[1]);

  return {
    kramatorsk: {
      title: `${kramatorskIndex} · ${kramatorsk}`,
      meta: kramatorskYears,
      nodes: [
        { primary: scene.stages[0].nodes[0] },
        { primary: scene.stages[0].nodes[1] },
        { primary: schoolMatch?.[1] ?? scene.stages[0].nodes[2], secondary: schoolMatch?.[2] },
      ],
    },
    rupture: { primary: war, secondary: warDate },
    relocation: {
      title: `${relocationIndex} · ${relocation}`,
      meta: relocationYear,
      nodes: [
        { primary: romania, secondary: `${romaniaDate} · ${romaniaDuration}` },
        { primary: canada, secondary: canadaDate },
      ],
    },
    canada: {
      title: language === "uk" ? "3 · КАНАДА" : "3 · CANADA",
      places: scene.stages[2].nodes.map((primary) => ({ primary })),
      education: [
        { primary: sacred, secondary: sacredYears },
        { primary: tmu, secondary: `${now} · ${program}` },
      ],
    },
  };
}

function multilineText(lines, x, centerY, className, lineHeight = 21) {
  const firstY = centerY - ((lines.length - 1) * lineHeight) / 2;
  return `<text class="${className}" x="${x}" y="${firstY.toFixed(1)}">${lines
    .map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${escapeXml(line)}</tspan>`)
    .join("")}</text>`;
}

function nodeText(node, box, className = "primary") {
  const [x, y, width, height] = box;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const primaryLines = wrapText(node.primary, width - 32, 20);
  if (!node.secondary) return multilineText(primaryLines, centerX, centerY, className);

  const primaryCenter = centerY - (primaryLines.length > 1 ? 12 : 10);
  const secondaryY = centerY + (primaryLines.length > 1 ? 23 : 16);
  return `${multilineText(primaryLines, centerX, primaryCenter, className)}
    <text class="secondary" x="${centerX}" y="${secondaryY}">${escapeXml(node.secondary)}</text>`;
}

function arrow(x1, y1, x2, y2, markerId) {
  return `<path class="path" d="M ${x1} ${y1} L ${x2} ${y2}" marker-end="url(#${markerId})"/>`;
}

function render(scene, { language, ariaLabel }) {
  const markerId = `image-note-arrow-${language}`;
  const content = model(scene, language);
  const shapes = [];
  const labels = [];
  const paths = [];

  const addStage = (stage, geometry, nodes) => {
    const [x, y, width, height] = geometry.box;
    shapes.push(`<rect class="stage" x="${x}" y="${y}" width="${width}" height="${height}" rx="16"/>`);
    labels.push(`<text class="stage-title" x="${x + 22}" y="${y + 30}">${escapeXml(stage.title)}</text>`);
    if (stage.meta) {
      labels.push(`<text class="stage-meta" x="${x + width - 22}" y="${y + 30}">${escapeXml(stage.meta)}</text>`);
    }
    nodes.forEach((node, index) => {
      const box = geometry.nodes[index];
      const [nodeX, nodeY, nodeWidth, nodeHeight] = box;
      shapes.push(`<rect class="node" x="${nodeX}" y="${nodeY}" width="${nodeWidth}" height="${nodeHeight}" rx="13"/>`);
      labels.push(nodeText(node, box));
      if (index) {
        const previous = geometry.nodes[index - 1];
        paths.push(arrow(previous[0] + previous[2] + 8, previous[1] + previous[3] / 2, nodeX - 10, nodeY + nodeHeight / 2, markerId));
      }
    });
  };

  addStage(content.kramatorsk, GEOMETRY.kramatorsk, content.kramatorsk.nodes);

  const [ruptureX, ruptureY, ruptureWidth, ruptureHeight] = GEOMETRY.rupture;
  shapes.push(`<rect class="node rupture" x="${ruptureX}" y="${ruptureY}" width="${ruptureWidth}" height="${ruptureHeight}" rx="18"/>`);
  labels.push(nodeText(content.rupture, GEOMETRY.rupture, "rupture-primary"));

  addStage(content.relocation, GEOMETRY.relocation, content.relocation.nodes);

  const [canadaX, canadaY, canadaWidth, canadaHeight] = GEOMETRY.canada.box;
  shapes.push(`<rect class="stage" x="${canadaX}" y="${canadaY}" width="${canadaWidth}" height="${canadaHeight}" rx="16"/>`);
  labels.push(`<text class="stage-title" x="${canadaX + 22}" y="${canadaY + 30}">${escapeXml(content.canada.title)}</text>`);
  for (const [nodes, boxes] of [
    [content.canada.places, GEOMETRY.canada.places],
    [content.canada.education, GEOMETRY.canada.education],
  ]) {
    nodes.forEach((node, index) => {
      const [x, y, width, height] = boxes[index];
      shapes.push(`<rect class="node" x="${x}" y="${y}" width="${width}" height="${height}" rx="13"/>`);
      labels.push(nodeText(node, boxes[index]));
      if (index) {
        const previous = boxes[index - 1];
        paths.push(arrow(previous[0] + previous[2] + 8, previous[1] + previous[3] / 2, x - 10, y + height / 2, markerId));
      }
    });
  }

  paths.push(arrow(375, 233, 375, 262, markerId));
  paths.push(arrow(375, 366, 375, 397, markerId));
  paths.push(arrow(375, 598, 375, 642, markerId));
  paths.push(`<path class="path" d="M 565 793 L 565 817 L 222.5 817 L 222.5 842" marker-end="url(#${markerId})"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX.width} ${VIEWBOX.height}" role="img" aria-label="${escapeXml(ariaLabel)}">
  <style>
    .stage { fill: none; stroke: #77777d; stroke-width: 1.2; stroke-dasharray: 6 7; }
    .node { fill: #f3f3f2; stroke: #29292c; stroke-width: 1.35; }
    .rupture { stroke-width: 2; }
    .path { fill: none; stroke: #55555b; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .arrowhead { fill: #29292c; stroke: none; }
    .stage-title, .stage-meta, .primary, .secondary, .rupture-primary {
      fill: #202023;
      font-family: var(--font-prose, var(--font-source-serif, Georgia, "Times New Roman", serif));
      dominant-baseline: middle;
    }
    .stage-title { font-size: 15px; font-weight: 600; letter-spacing: .65px; text-anchor: start; }
    .stage-meta { fill: #65656c; font-size: 14px; font-weight: 400; text-anchor: end; }
    .primary, .secondary, .rupture-primary { text-anchor: middle; }
    .primary { font-size: 20px; font-weight: 500; }
    .secondary { fill: #65656c; font-size: 14px; font-weight: 400; }
    .rupture-primary { font-size: 22px; font-weight: 600; }
    @media (max-width: 420px) {
      .stage-title { font-size: 17px; }
      .stage-meta, .secondary { font-size: 16px; }
      .primary { font-size: 23px; }
      .rupture-primary { font-size: 24px; }
    }
    @media (prefers-color-scheme: dark) {
      .stage { stroke: #88888f; }
      .node { fill: #19191c; stroke: #e7e7e9; }
      .path { stroke: #a0a0a8; }
      .arrowhead { fill: #e7e7e9; }
      .stage-title, .primary, .rupture-primary { fill: #f2f2f3; }
      .stage-meta, .secondary { fill: #a6a6ae; }
    }
  </style>
  <defs>
    <marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path class="arrowhead" d="M 1 1 L 9 5 L 1 9 Z"/>
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
