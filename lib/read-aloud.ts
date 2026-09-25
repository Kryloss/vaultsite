/**
 * The pure half of "Listen" (components/ReadAloud.tsx, page idea
 * `noteReadAloud`, DECISIONS #180, #181): which voice to use, how a fact row
 * is said, and where a note stops being worth reading aloud.
 */

export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

/**
 * Names the platforms give their better voices. Edge's "Online (Natural)"
 * neural voices, Apple's "Premium"/"Enhanced" downloads and Siri, and
 * Chrome's network "Google" voices are all a clear step above the default
 * compact voice most systems hand back first.
 */
const QUALITY: [RegExp, number][] = [
  [/\bnatural\b|\bneural\b/i, 50],
  [/\bpremium\b/i, 40],
  [/\benhanced\b/i, 30],
  [/\bsiri\b/i, 25],
  [/^google\b/i, 20],
];

/** Novelty voices macOS ships alongside the real ones — never the right pick. */
const NOVELTY =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;

/**
 * The best voice for a language ("en" or "uk"): the reader's own region
 * first when it matches (an en-CA reader gets en-CA), then the quality
 * markers above, then the system default. Undefined when the system has no
 * voice in that language at all — the utterance's `lang` still asks the
 * browser to try.
 */
export function pickVoice<V extends VoiceLike>(
  voices: V[],
  language: "en" | "uk",
  preferredLocale?: string
): V | undefined {
  const score = (v: V): number => {
    let s = 0;
    for (const [re, points] of QUALITY) if (re.test(v.name)) s = Math.max(s, points);
    if (preferredLocale && v.lang.toLowerCase() === preferredLocale.toLowerCase()) s += 10;
    if (language === "en" && /^en-(us|gb|ca)$/i.test(v.lang)) s += 3;
    if (v.default) s += 1;
    return s;
  };
  return voices
    .filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(language) && !NOVELTY.test(v.name))
    .sort((a, b) => score(b) - score(a))[0];
}

/** A fact row as a sentence: "Born: March 9, 1985." — no doubled full stop. */
export function factSentence(label: string, value: string): string {
  const v = value.trim();
  if (!v) return "";
  return `${label.trim()}: ${v}${/[.!?…]$/.test(v) ? "" : "."}`;
}

/** The Sources heading — a list of links is for reading, not for listening. */
export function isSourcesHeading(text: string): boolean {
  return /^(sources|джерела|references|посилання)$/i.test(text.replace(/#\s*$/, "").trim());
}
