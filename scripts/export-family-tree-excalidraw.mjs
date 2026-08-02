/**
 * Export the bilingual family-tree Excalidraw scenes as self-theming SVGs.
 *
 * The editable scenes own the names, roles, note, and relationship count. The
 * website export normalizes both languages onto one portrait geometry so the
 * Diagram / Original switch keeps a stable stage.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VIEWBOX = { width: 750, height: 1000 };
const PEOPLE = {
  en: {
    val: "Valerii",
    svet: "Svetlana",
    pav: "Pavel",
    lub: "Lubov",
    iryna: "Iryna",
    viktoria: "Viktoria",
    vol: "Volodymyr",
    kyrylo: "Kyrylo",
    polina: "Polina",
    veronika: "Veronika",
    lesya: "Lesya",
  },
  uk: {
    val: "Валерій",
    svet: "Світлана",
    pav: "Павло",
    lub: "Любов",
    iryna: "Ірина",
    viktoria: "Вікторія",
    vol: "Володимир",
    kyrylo: "Кирило",
    polina: "Поліна",
    veronika: "Вероніка",
    lesya: "Леся",
  },
};

const BOXES = {
  val: [52, 145, 145, 82],
  svet: [208, 145, 145, 82],
  pav: [397, 137, 156, 98],
  lub: [564, 145, 135, 82],
  viktoria: [48, 395, 190, 90],
  iryna: [278, 395, 190, 90],
  vol: [512, 395, 190, 90],
  veronika: [38, 727, 172, 92],
  lesya: [224, 727, 132, 92],
  kyrylo: [382, 727, 160, 92],
  polina: [556, 727, 158, 92],
};

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function extractFamily(file, language) {
  const scene = JSON.parse(fs.readFileSync(file, "utf8"));
  if (scene.type !== "excalidraw") throw new Error(`${file}: not an Excalidraw scene`);

  const elements = scene.elements.filter((element) => !element.isDeleted);
  const connectors = elements.filter((element) => element.type === "arrow" || element.type === "line");
  const text = elements
    .filter((element) => element.type === "text")
    .map((element) => element.text.replace(/\s*\n\s*/g, " ").trim());

  if (connectors.length !== 14) {
    throw new Error(`${file}: expected 14 family connections, found ${connectors.length}`);
  }
  if (text.length !== 11) throw new Error(`${file}: expected 11 people, found ${text.length}`);

  const byName = new Map(
    text.map((label) => {
      const [name, role, note] = label.split(/\s+·\s+/).map((part) => part.trim());
      return [name, { name, role, note }];
    })
  );
  const people = Object.fromEntries(
    Object.entries(PEOPLE[language]).map(([key, sourceName]) => {
      const person = byName.get(sourceName);
      if (!person?.role) throw new Error(`${file}: missing person or role for ${sourceName}`);
      return [key, person];
    })
  );
  if (!people.pav.note) throw new Error(`${file}: Pavel's source-supported note is missing`);
  return people;
}

function center(box) {
  return [box[0] + box[2] / 2, box[1] + box[3] / 2];
}

function card(person, key, className = "person") {
  const [x, y, width, height] = BOXES[key];
  const cx = x + width / 2;
  const roleLines = person.role.length > 13 && person.role.includes(" ") ? person.role.split(/\s+/) : [person.role];
  const nameY = y + (person.note ? 29 : roleLines.length > 1 ? 29 : 34);
  const roleY = nameY + (roleLines.length > 1 ? 21 : 24);
  const noteY = roleY + (roleLines.length > 1 ? 34 : 21);
  return `<g class="card ${className}">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14"/>
      <text class="name" x="${cx}" y="${nameY}">${escapeXml(person.name)}</text>
      <text class="role" x="${cx}" y="${roleY}">${roleLines
        .map((line, index) => `<tspan x="${cx}" dy="${index ? 18 : 0}">${escapeXml(line)}</tspan>`)
        .join("")}</text>${
        person.note ? `\n      <text class="note" x="${cx}" y="${noteY}">${escapeXml(person.note)}</text>` : ""
      }
    </g>`;
}

function render(people, { language, ariaLabel }) {
  const strings =
    language === "uk"
      ? {
          title: "МОЄ РОДИННЕ ДЕРЕВО",
          maternal: "МАТЕРИНА ГІЛКА",
          paternal: "БАТЬКОВА ГІЛКА",
          parents: "БАТЬКИ Й ТІТКА",
          children: "ДІТИ",
        }
      : {
          title: "MY FAMILY TREE",
          maternal: "MATERNAL BRANCH",
          paternal: "PATERNAL BRANCH",
          parents: "PARENTS & AUNT",
          children: "CHILDREN",
        };

  const [valX] = center(BOXES.val);
  const [svetX] = center(BOXES.svet);
  const [pavX] = center(BOXES.pav);
  const [lubX] = center(BOXES.lub);
  const [viktoriaX] = center(BOXES.viktoria);
  const [irynaX] = center(BOXES.iryna);
  const [volX] = center(BOXES.vol);
  const [veronikaX] = center(BOXES.veronika);
  const [lesyaX] = center(BOXES.lesya);
  const [kyryloX] = center(BOXES.kyrylo);
  const [polinaX] = center(BOXES.polina);
  const parentPairX = (BOXES.iryna[0] + BOXES.iryna[2] + BOXES.vol[0]) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX.width} ${VIEWBOX.height}" role="img" aria-label="${escapeXml(ariaLabel)}">
  <title>${escapeXml(ariaLabel)}</title>
  <style>
    .branch { fill: none; stroke: #7b7b82; stroke-width: 1.2; stroke-dasharray: 6 7; }
    .family-line { fill: none; stroke: #55555b; stroke-width: 1.55; stroke-linecap: round; stroke-linejoin: round; }
    .junction { fill: #55555b; }
    .card rect { fill: #f3f3f2; stroke: #29292c; stroke-width: 1.35; }
    .anchor rect { fill: none; stroke-width: 1.55; }
    .uncertain rect { fill: none; stroke: #77777d; stroke-dasharray: 5 5; }
    .current rect { fill: #33373d; stroke: #33373d; stroke-width: 1.5; }
    .title, .branch-title, .generation, .name, .role, .note {
      fill: #202023;
      font-family: var(--font-prose, var(--font-source-serif, Georgia, "Times New Roman", serif));
      dominant-baseline: middle;
    }
    .title { font-size: 24px; font-weight: 600; letter-spacing: 1.25px; text-anchor: middle; }
    .branch-title { font-size: 14px; font-weight: 600; letter-spacing: .7px; text-anchor: start; }
    .generation { fill: #6a6a71; font-size: 13px; font-weight: 400; letter-spacing: .65px; text-anchor: start; }
    .name, .role, .note { text-anchor: middle; }
    .name { font-size: 20px; font-weight: 600; }
    .role { fill: #606067; font-size: 14px; font-weight: 400; }
    .cousin .role { font-size: 13.5px; }
    .note { fill: #77777e; font-size: 11.5px; font-style: italic; font-weight: 400; }
    .current .name { fill: #ffffff; }
    .current .role { fill: #d4d4d8; }
    @media (max-width: 420px) {
      .title { font-size: 30px; }
      .branch-title { font-size: 19px; }
      .generation { font-size: 19px; }
      .name { font-size: 25px; }
      .role { font-size: 20px; }
      .cousin .role { font-size: 18px; }
      .note { font-size: 17px; }
    }
    @media (prefers-color-scheme: dark) {
      .branch { stroke: #85858d; }
      .family-line { stroke: #9a9aa2; }
      .junction { fill: #c9c9ce; }
      .card rect { fill: #19191c; stroke: #e4e4e7; }
      .anchor rect { fill: none; stroke: #e4e4e7; }
      .uncertain rect { fill: none; stroke: #9999a1; }
      .current rect { fill: #e6e8eb; stroke: #e6e8eb; }
      .title, .branch-title, .name { fill: #f2f2f3; }
      .generation, .role { fill: #a6a6ae; }
      .note { fill: #8f8f98; }
      .current .name { fill: #0a0a0a; }
      .current .role { fill: #4b4b52; }
    }
  </style>
  <g aria-hidden="true">
    <text class="title" x="375" y="45">${escapeXml(strings.title)}</text>

    <rect class="branch" x="30" y="88" width="345" height="205" rx="16"/>
    <text class="branch-title" x="50" y="116">${escapeXml(strings.maternal)}</text>
    <rect class="branch" x="385" y="88" width="335" height="205" rx="16"/>
    <text class="branch-title" x="405" y="116">${escapeXml(strings.paternal)}</text>

    ${card(people.val, "val")}
    ${card(people.svet, "svet")}
    ${card(people.pav, "pav", "person uncertain")}
    ${card(people.lub, "lub")}

    <path class="family-line" d="M ${valX} 227 V 256 H 202.5 M ${svetX} 227 V 256 H 202.5 V 318 H ${viktoriaX} M 202.5 318 H ${irynaX} M ${viktoriaX} 318 V 395 M ${irynaX} 318 V 395"/>
    <circle class="junction" cx="202.5" cy="256" r="3"/>
    <path class="family-line" d="M ${pavX} 235 V 256 H 552 M ${lubX} 227 V 256 H 552 V 318 H ${volX} V 395"/>
    <circle class="junction" cx="552" cy="256" r="3"/>

    <text class="generation" x="48" y="365">${escapeXml(strings.parents)}</text>
    ${card(people.viktoria, "viktoria", "person anchor")}
    ${card(people.iryna, "iryna", "person anchor")}
    ${card(people.vol, "vol", "person anchor")}

    <path class="family-line" d="M ${BOXES.iryna[0] + BOXES.iryna[2]} 440 H ${BOXES.vol[0]} M ${parentPairX} 440 V 655 H ${kyryloX} M ${parentPairX} 655 H ${polinaX} M ${kyryloX} 655 V 727 M ${polinaX} 655 V 727"/>
    <circle class="junction" cx="${parentPairX}" cy="440" r="3"/>
    <path class="family-line" d="M ${viktoriaX} 485 V 655 H ${veronikaX} M ${viktoriaX} 655 H ${lesyaX} M ${veronikaX} 655 V 727 M ${lesyaX} 655 V 727"/>
    <circle class="junction" cx="${viktoriaX}" cy="655" r="3"/>

    <text class="generation" x="38" y="697">${escapeXml(strings.children)}</text>
    ${card(people.veronika, "veronika", "person cousin")}
    ${card(people.lesya, "lesya", "person cousin")}
    ${card(people.kyrylo, "kyrylo", "person current")}
    ${card(people.polina, "polina")}
  </g>
</svg>
`;
}

export function exportFamilyTree(basePath) {
  const variants = [
    {
      language: "en",
      source: `${basePath}.excalidraw`,
      output: `${basePath}.svg`,
      ariaLabel: "Family tree showing Kyrylo, his sister, parents, aunt, grandparents, and cousins",
    },
    {
      language: "uk",
      source: `${basePath}.uk.excalidraw`,
      output: `${basePath}.uk.svg`,
      ariaLabel: "Родинне дерево Кирила із сестрою, батьками, тіткою, дідусями, бабусями та двоюрідними сестрами",
    },
  ];
  for (const variant of variants) {
    const people = extractFamily(variant.source, variant.language);
    fs.writeFileSync(variant.output, render(people, variant));
  }
  return variants.map((variant) => variant.output);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const basePath = process.argv[2] ?? path.join(process.cwd(), "vault/Posts/attachments/image-note-family-tree");
  for (const file of exportFamilyTree(basePath)) {
    console.log(`[export-family-tree] wrote ${path.relative(process.cwd(), file)}`);
  }
}
