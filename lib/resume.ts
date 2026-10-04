/**
 * Shared résumé types + the fixed list of its blocks (Experience, Education, …).
 *
 * One list drives three things that all need to agree on the same ids:
 *   - components/Resume.tsx     — renders each block under that id
 *   - components/lists/NowList  — feeds the ids/labels to <Toc> as headings
 *   - lib/vault.ts getSearchIndex — jump-to-anchor results in Cmd+K
 *
 * Keeping it here (rather than duplicating the list in each place) is the
 * same reasoning as lib/toc.ts collecting real markdown headings: one source
 * of truth for "what sections exist and what are they called."
 */
import type { Str } from "./ui-strings";
import { ui } from "./ui-strings";

export interface ResumeRow {
  role?: string;
  role_uk?: string;
  org?: string;
  org_uk?: string;
  meta?: string;
  meta_uk?: string;
  period?: string;
  period_uk?: string;
  note?: string;
  note_uk?: string;
  current?: boolean;
  link?: string;
  points?: string[];
  points_uk?: string[];
}

export interface ResumeData {
  summary?: string;
  summary_uk?: string;
  file?: string;
  /** "Label — detail" lines, like `skills` (the block the page calls Strengths). */
  technical?: string[];
  technical_uk?: string[];
  projects?: ResumeRow[];
  education?: ResumeRow[];
  experience?: ResumeRow[];
  participation?: ResumeRow[];
  certifications?: ResumeRow[];
  skills?: string[];
  skills_uk?: string[];
  languages?: string[];
  languages_uk?: string[];
  contact?: { email?: string; location?: string; location_uk?: string };
}

interface ResumeBlockDef {
  /** Anchor id — also the DOM id components/Resume.tsx puts on the block. */
  id: string;
  label: Str;
  has: (data: ResumeData) => boolean;
}

/**
 * Document order — Toc and the page render in this order, which is the order
 * of the owner's PDF (DECISIONS #200) plus the blocks only the page has:
 * Strengths sits right under Technical skills at his request, the rest follow.
 */
export const RESUME_BLOCKS: ResumeBlockDef[] = [
  { id: "technical", label: ui.resumeTechnical, has: (d) => !!d.technical?.length },
  { id: "strengths", label: ui.resumeSkills, has: (d) => !!d.skills?.length },
  { id: "projects", label: ui.resumeProjects, has: (d) => !!d.projects?.length },
  { id: "education", label: ui.resumeEducation, has: (d) => !!d.education?.length },
  { id: "experience", label: ui.resumeExperience, has: (d) => !!d.experience?.length },
  {
    id: "participation",
    label: ui.resumeParticipation,
    has: (d) => !!d.participation?.length,
  },
  {
    id: "certifications",
    label: ui.resumeCertifications,
    has: (d) => !!d.certifications?.length,
  },
  { id: "languages", label: ui.resumeLanguages, has: (d) => !!d.languages?.length },
  { id: "contact", label: ui.resumeContact, has: (d) => !!d.contact?.email },
];

export interface Heading {
  id: string;
  text: string;
  level: number;
}

/**
 * Headings for <Toc>, one array per language — same ids in both, since the
 * page has a single DOM tree with both languages inline (see components/T.tsx),
 * not two separate article bodies like an entry page.
 */
export function resumeHeadings(data: ResumeData): { en: Heading[]; uk: Heading[] } {
  const blocks = RESUME_BLOCKS.filter((b) => b.has(data));
  return {
    en: blocks.map((b) => ({ id: b.id, text: b.label.en, level: 2 })),
    uk: blocks.map((b) => ({ id: b.id, text: b.label.uk, level: 2 })),
  };
}

/** Flattens every string in the résumé (both languages) for full-text search. */
export function resumeSearchText(data: ResumeData): string {
  const rowText = (r: ResumeRow) =>
    [r.role, r.role_uk, r.org, r.org_uk, r.meta, r.meta_uk, r.note, r.note_uk]
      .concat(r.points ?? [])
      .concat(r.points_uk ?? [])
      .filter(Boolean)
      .join(" ");

  return [
    data.summary,
    data.summary_uk,
    ...(data.technical ?? []),
    ...(data.technical_uk ?? []),
    ...(data.projects ?? []).map(rowText),
    ...(data.education ?? []).map(rowText),
    ...(data.experience ?? []).map(rowText),
    ...(data.participation ?? []).map(rowText),
    ...(data.certifications ?? []).map(rowText),
    ...(data.skills ?? []),
    ...(data.skills_uk ?? []),
    ...(data.languages ?? []),
    ...(data.languages_uk ?? []),
    data.contact?.location,
    data.contact?.location_uk,
  ]
    .filter(Boolean)
    .join(" ");
}
