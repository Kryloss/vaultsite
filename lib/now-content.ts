/**
 * The "now" section, written as markdown instead of YAML.
 *
 * The Now page is pure structured data (goals + résumé), which used to live in
 * `vault/Now/main.md` frontmatter. Obsidian's Properties panel can't edit
 * nested YAML, so a 116-line frontmatter block meant editing raw YAML in source
 * mode. This module reads the same data out of the note BODY, where Obsidian
 * gives you real checkboxes, headings, and bullets:
 *
 *   ## Goals
 *
 *   - [ ] Pass the CompTIA Security+ exam → [[My Security+ journey]]
 *       - Requires at least a 3.0 GPA        ← indented bullet = sub-label
 *   - [x] Find a tech-related job            ← [x] = done, box fills in
 *
 *   ## Résumé
 *
 *   One-paragraph summary, right under the heading.
 *
 *   ### Experience                           ← Experience | Education |
 *                                              Certifications | Strengths |
 *                                              Languages | Contact
 *   #### Barista · Starbucks                 ← "role · org", optional "→ link"
 *   *Oct 2025 — present* · Newmarket #current  ← *italic* = period, rest =
 *                                                sub-label, #current fills the dot
 *   - **Customer service** — Serves every customer…   ← bullets = points
 *
 * Ukrainian lives in the sibling `main.uk.md`, mirroring the same structure —
 * the same split the rest of the site already uses for section bodies. Values
 * merge by position (first goal ↔ first goal), so the Ukrainian file never
 * repeats structure: flags (`[x]`, `#current`), links and the PDF file name are
 * read from the English file only, and any Ukrainian string identical to its
 * English twin is dropped (components/T.tsx renders English for both anyway).
 *
 * Parsing is deliberately forgiving: an unrecognized heading is skipped with a
 * build-log warning rather than throwing, so a typo in the note can never take
 * a deploy down — it just leaves that block off the page, where it's obvious.
 */
import type { ResumeData, ResumeRow } from "./resume";
import { RESUME_BLOCKS } from "./resume";

export interface NowGoal {
  label: string;
  label_uk?: string;
  note?: string;
  note_uk?: string;
  link?: string;
  done?: boolean;
}

export interface NowContent {
  /** Markdown above the first heading — rendered as the page's intro prose. */
  intro: string;
  /** Same, from main.uk.md. */
  introUk?: string;
  goals: NowGoal[];
  resume?: ResumeData;
}

/* ------------------------------------------------------------------ vocabulary */

/** Fold a heading for matching: case, accents and punctuation don't count. */
function key(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

/** `## …` headings. Ukrainian spellings match the labels the page renders. */
const TOP_HEADINGS: Record<string, "goals" | "resume"> = {};
for (const alias of ["goals", "short-term goals", "цілі", "короткострокові цілі"])
  TOP_HEADINGS[key(alias)] = "goals";
for (const alias of ["résumé", "resume", "cv", "резюме"])
  TOP_HEADINGS[key(alias)] = "resume";

/**
 * `### …` headings inside the résumé → the ResumeData key they fill.
 * Built from lib/resume.ts so the accepted names are exactly the labels the
 * page prints (in both languages), plus a few natural synonyms.
 */
const RESUME_HEADINGS: Record<string, keyof ResumeData> = {};
{
  /** id in RESUME_BLOCKS → key in ResumeData, where the two differ. */
  const FIELD: Record<string, keyof ResumeData> = { strengths: "skills" };
  /** Extra spellings beyond the labels the page itself prints. */
  const EXTRA: Partial<Record<keyof ResumeData, string[]>> = {
    experience: ["work", "досвід роботи"],
    skills: ["skills", "strengths", "навички"],
    contact: ["contacts", "контакт"],
  };
  for (const block of RESUME_BLOCKS) {
    const field = FIELD[block.id] ?? (block.id as keyof ResumeData);
    const aliases = [block.id, block.label.en, block.label.uk, ...(EXTRA[field] ?? [])];
    for (const alias of aliases) RESUME_HEADINGS[key(alias)] = field;
  }
}

/** Blocks that are lists of timeline rows rather than plain strings. */
const ROW_FIELDS = new Set<keyof ResumeData>([
  "experience",
  "education",
  "certifications",
]);

/* ------------------------------------------------------------------ utilities */

/** Markdown inline syntax → the plain text the page renders. */
function plain(text: string): string {
  return text
    .replace(/\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g, (_m, target, label) => label || target)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(?<!\w)([*_])(?!\s)(.+?)(?<!\s)\1(?!\w)/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "Label → [[Note]]" / "Label → [text](url)" — an arrow at the end of a title
 * line points at whatever the card should link to. Anything after an arrow that
 * isn't a link is left alone (it's just prose with an arrow in it).
 */
function splitLink(text: string): { text: string; link?: string } {
  const m = /\s*(?:→|➔|->)\s*(\S.*)$/.exec(text);
  if (!m) return { text: text.trim() };
  const head = text.slice(0, m.index).trim();
  const tail = m[1].trim();

  const wiki = /^!?\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]$/.exec(tail);
  if (wiki) return { text: head, link: wiki[1].trim() };
  const link = /^\[[^\]]*\]\(([^)]+)\)$/.exec(tail);
  if (link) return { text: head, link: link[1].trim() };
  if (/^(https?:\/\/|mailto:)\S+$/i.test(tail)) return { text: head, link: tail };

  return { text: text.trim() };
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^(\s*)[-*+]\s+(?!\[[ xX]\])(.*)$/;
const TASK = /^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)$/;

/** Groups lines under their `#`×level heading; deeper headings stay inside. */
function sections(lines: string[], level: number): { heading: string; body: string[] }[] {
  const out: { heading: string; body: string[] }[] = [];
  let current: { heading: string; body: string[] } | null = null;
  for (const line of lines) {
    const m = HEADING.exec(line);
    if (m) {
      const depth = m[1].length;
      if (depth === level) {
        current = { heading: m[2], body: [] };
        out.push(current);
        continue;
      }
      if (depth < level) {
        current = null;
        continue;
      }
    }
    current?.body.push(line);
  }
  return out;
}

/** Top-level bullets (nested ones belong to the bullet above them). */
function topBullets(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const m = BULLET.exec(line);
    if (m && m[1].length === 0) out.push(plain(m[2]));
  }
  return out;
}

/* --------------------------------------------------------------------- goals */

function parseGoals(lines: string[]): NowGoal[] {
  const goals: NowGoal[] = [];
  for (const line of lines) {
    const task = TASK.exec(line);
    if (task && task[1].length === 0) {
      const { text, link } = splitLink(task[3]);
      const goal: NowGoal = { label: plain(text) };
      if (link) goal.link = link;
      if (task[2].toLowerCase() === "x") goal.done = true;
      goals.push(goal);
      continue;
    }
    // Indented bullet (or plain indented line) under a goal → its sub-label.
    const last = goals[goals.length - 1];
    if (!last || !line.trim()) continue;
    const nested = BULLET.exec(line) ?? TASK.exec(line);
    const text = nested ? nested[nested.length - 1] : line;
    if (!/^\s/.test(line)) continue;
    const note = plain(text);
    if (note) last.note = last.note ? `${last.note} ${note}` : note;
  }
  return goals;
}

/* -------------------------------------------------------------------- résumé */

/**
 * A row's second line: `*period* · sub-label #current`. Italics mark the period
 * because it's the one field short enough to read at a glance either way, and
 * marking it explicitly means a row with only a location can't be misread as a
 * row with only a date.
 */
function parseRowMeta(line: string, row: ResumeRow): void {
  let rest = line.trim();

  const flag = /(?:^|\s)#current\b/i;
  if (flag.test(rest)) {
    row.current = true;
    rest = rest.replace(flag, " ").trim();
  }

  const period = /^(?:\*([^*]+)\*|_([^_]+)_)/.exec(rest);
  if (period) {
    row.period = plain(period[1] ?? period[2]);
    rest = rest.slice(period[0].length).replace(/^\s*[·|—–-]\s*/, "");
  }

  const meta = plain(rest);
  if (meta) row.meta = meta;
}

function parseRows(lines: string[]): ResumeRow[] {
  return sections(lines, 4).map(({ heading, body }) => {
    const { text, link } = splitLink(heading);
    const [role, ...rest] = text.split(/\s+·\s+/);
    const row: ResumeRow = {};
    if (role?.trim()) row.role = plain(role);
    if (rest.length) row.org = plain(rest.join(" · "));
    if (link) row.link = link;

    const points: string[] = [];
    let sawMeta = false;
    for (const line of body) {
      if (!line.trim()) continue;
      const bullet = BULLET.exec(line);
      if (bullet) {
        points.push(plain(bullet[2]));
        continue;
      }
      if (!sawMeta && !points.length) {
        parseRowMeta(line, row);
        sawMeta = true;
      }
    }
    if (points.length) row.points = points;
    return row;
  });
}

function parseResume(lines: string[], warn: (message: string) => void): ResumeData {
  const resume: ResumeData = {};

  // Everything above the first `###` is the summary paragraph.
  const summary: string[] = [];
  for (const line of lines) {
    if (HEADING.test(line)) break;
    summary.push(line);
  }
  const text = plain(summary.join(" "));
  if (text) resume.summary = text;

  for (const { heading, body } of sections(lines, 3)) {
    const field = RESUME_HEADINGS[key(heading)];
    if (!field) {
      warn(`unknown résumé heading "### ${heading}" — block skipped`);
      continue;
    }
    if (ROW_FIELDS.has(field)) {
      const rows = parseRows(body);
      if (rows.length) (resume[field] as ResumeRow[]) = rows;
      continue;
    }
    const items = topBullets(body);
    if (field === "contact") {
      const email = items.find((i) => /\S+@\S+\.\S+/.test(i));
      const location = items.find((i) => i !== email);
      resume.contact = {};
      if (email) resume.contact.email = /\S+@\S+\.\S+/.exec(email)![0];
      if (location) resume.contact.location = location;
      continue;
    }
    if (items.length) (resume[field] as string[]) = items;
  }

  return resume;
}

/* ------------------------------------------------------------------- one file */

/** Parses one language's body. Ukrainian merges into English in parseNow(). */
export function parseNowBody(
  markdown: string,
  warn: (message: string) => void = () => {}
): NowContent {
  // `%% … %%` is Obsidian's comment syntax — the format cheatsheet at the top
  // of main.md is written that way, so it never reaches the page or this parser.
  const lines = markdown.replace(/%%[\s\S]*?%%/g, "").split(/\r?\n/);

  const intro: string[] = [];
  for (const line of lines) {
    if (/^#{1,2}\s/.test(line)) break;
    intro.push(line);
  }

  const content: NowContent = { intro: intro.join("\n").trim(), goals: [] };
  for (const { heading, body } of sections(lines, 2)) {
    const kind = TOP_HEADINGS[key(heading)];
    if (kind === "goals") content.goals.push(...parseGoals(body));
    else if (kind === "resume") content.resume = parseResume(body, warn);
    else warn(`unknown heading "## ${heading}" — section skipped`);
  }
  return content;
}

/* ---------------------------------------------------------------- uk merging */

/** Ukrainian value, dropped when it just repeats the English one. */
function uk(en: string | undefined, value: string | undefined): string | undefined {
  const text = value?.trim();
  return text && text !== en?.trim() ? text : undefined;
}

function ukList(en: string[] | undefined, value: string[] | undefined): string[] | undefined {
  if (!value?.length) return undefined;
  return value.some((v, i) => v.trim() !== en?.[i]?.trim()) ? value : undefined;
}

function mergeRows(rows: ResumeRow[] | undefined, ukRows: ResumeRow[] | undefined): void {
  if (!rows || !ukRows) return;
  rows.forEach((row, i) => {
    const t = ukRows[i];
    if (!t) return;
    row.role_uk = uk(row.role, t.role);
    row.org_uk = uk(row.org, t.org);
    row.meta_uk = uk(row.meta, t.meta);
    row.period_uk = uk(row.period, t.period);
    row.points_uk = ukList(row.points, t.points);
  });
}

/**
 * Parses `main.md` (+ optional `main.uk.md`) into the shape the Now page and
 * the résumé PDF script already consume — see components/lists/NowList.tsx.
 */
export function parseNow(
  en: string,
  ukSource?: string,
  warn: (message: string) => void = (m) => console.warn(`[now] ${m}`)
): NowContent {
  const content = parseNowBody(en, warn);
  if (!ukSource) return content;
  const t = parseNowBody(ukSource, (m) => warn(`main.uk.md: ${m}`));
  content.introUk = t.intro || undefined;

  content.goals.forEach((goal, i) => {
    const other = t.goals[i];
    if (!other) return;
    goal.label_uk = uk(goal.label, other.label);
    goal.note_uk = uk(goal.note, other.note);
  });
  if (t.goals.length !== content.goals.length)
    warn(`main.uk.md has ${t.goals.length} goal(s) against ${content.goals.length} in main.md`);

  const r = content.resume;
  const ukResume = t.resume;
  if (r && ukResume) {
    r.summary_uk = uk(r.summary, ukResume.summary);
    mergeRows(r.experience, ukResume.experience);
    mergeRows(r.education, ukResume.education);
    mergeRows(r.certifications, ukResume.certifications);
    r.skills_uk = ukList(r.skills, ukResume.skills);
    r.languages_uk = ukList(r.languages, ukResume.languages);
    if (r.contact) r.contact.location_uk = uk(r.contact.location, ukResume.contact?.location);
  }

  return content;
}
