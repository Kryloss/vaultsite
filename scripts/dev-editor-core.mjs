import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export const EDITABLE_FRONTMATTER_KEYS = [
  "title",
  "title_uk",
  "description",
  "description_uk",
  "draft",
  "published",
  "category",
  "categories",
  "series",
  "series_uk",
  "part",
  "rating",
  "top_order",
];

export const EDITABLE_PAGE_KEYS = [
  "title",
  "title_uk",
  "description",
  "description_uk",
  "body",
  "body_uk",
];

const MAX_MARKDOWN_BODY = 512 * 1024;

export class DevEditorError extends Error {
  constructor(message, status = 400, code = "invalid_request") {
    super(message);
    this.name = "DevEditorError";
    this.status = status;
    this.code = code;
  }
}

export function revisionFor(source) {
  return createHash("sha256").update(source).digest("hex");
}

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/** Resolve an existing Markdown source while refusing every path outside vault/. */
export function resolveVaultMarkdown(repoRoot, source) {
  const segments = typeof source === "string" ? source.split("/") : [];
  if (
    typeof source !== "string" ||
    !source.startsWith("vault/") ||
    segments.some((segment) => segment === "." || segment === ".." || segment === "") ||
    source.includes("\\") ||
    source.includes("\0") ||
    !source.toLowerCase().endsWith(".md")
  ) {
    throw new DevEditorError("That is not an editable vault Markdown file.", 400, "bad_path");
  }

  const realRoot = fs.realpathSync(repoRoot);
  const vaultRoot = fs.realpathSync(path.join(realRoot, "vault"));
  const candidate = path.resolve(realRoot, source);
  if (!inside(vaultRoot, candidate)) {
    throw new DevEditorError("The requested file is outside the vault.", 403, "outside_vault");
  }

  let real;
  try {
    real = fs.realpathSync(candidate);
  } catch {
    throw new DevEditorError("The requested vault file does not exist.", 404, "not_found");
  }
  if (!inside(vaultRoot, real) || !real.toLowerCase().endsWith(".md")) {
    throw new DevEditorError("The requested file resolves outside the vault.", 403, "outside_vault");
  }
  return real;
}

function frontmatterParts(source) {
  const open = source.match(/^\uFEFF?---[ \t]*\r?\n/);
  if (!open) {
    throw new DevEditorError("The vault file has no YAML frontmatter.", 422, "missing_frontmatter");
  }
  const newline = open[0].includes("\r\n") ? "\r\n" : "\n";
  const close = /^---[ \t]*(?:\r?\n|$)/gm;
  close.lastIndex = open[0].length;
  const match = close.exec(source);
  if (!match) {
    throw new DevEditorError("The vault file has unclosed YAML frontmatter.", 422, "invalid_frontmatter");
  }
  return {
    before: source.slice(0, open[0].length),
    block: source.slice(open[0].length, match.index),
    after: source.slice(match.index),
    bodyStart: match.index + match[0].length,
    newline,
  };
}

function editorNewlines(value) {
  return value.replace(/\r\n?/g, "\n");
}

function validateMarkdownBody(value, key = "body") {
  if (typeof value !== "string") {
    throw new DevEditorError(`Page field '${key}' must be text.`, 400, "invalid_body");
  }
  if (value.includes("\0")) {
    throw new DevEditorError("Markdown body text cannot contain NUL bytes.", 422, "invalid_body");
  }
  if (Buffer.byteLength(value, "utf8") > MAX_MARKDOWN_BODY) {
    throw new DevEditorError("The Markdown body is too large for the local editor.", 413, "too_large");
  }
  return editorNewlines(value);
}

function markdownBody(source) {
  const parts = frontmatterParts(source);
  return editorNewlines(source.slice(parts.bodyStart));
}

function fileNewlines(value, newline) {
  return editorNewlines(value).replace(/\n/g, newline);
}

function newlineForBody(value, fallback) {
  if (value.includes("\r\n")) return "\r\n";
  if (value.includes("\n")) return "\n";
  return fallback;
}

/** Replace only the bytes after a primary note's closing frontmatter fence. */
export function patchMarkdownBody(source, body) {
  const parts = frontmatterParts(source);
  return source.slice(0, parts.bodyStart) + fileNewlines(validateMarkdownBody(body), parts.newline);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Exact source range occupied by one supported top-level YAML scalar. */
function fieldRange(block, key) {
  const line = new RegExp(`^${escapeRegex(key)}:[^\\r\\n]*(?:\\r?\\n|$)`, "gm");
  const matches = [...block.matchAll(line)];
  if (matches.length > 1) {
    throw new DevEditorError(
      `Frontmatter key '${key}' appears more than once.`,
      422,
      "duplicate_field"
    );
  }
  const [match] = matches;
  if (!match) return undefined;

  let end = match.index + match[0].length;
  const header = match[0].replace(/\r?\n$/, "");
  const sourceValue = header.slice(header.indexOf(":") + 1);
  const commentAt = inlineCommentIndex(sourceValue);
  const comment = commentAt === -1 ? "" : sourceValue.slice(commentAt).trimEnd();
  const value = (commentAt === -1 ? sourceValue : sourceValue.slice(0, commentAt)).trim();
  if (!/^[>|][+-]?(?:\d+)?(?:\s+#.*)?$/.test(value)) {
    return { start: match.index, end, comment };
  }

  // A block scalar owns its indented lines (and blank lines between them), but
  // never the next top-level key or comment. This is the piece a whole-object
  // YAML stringify gets wrong: it would also rewrite unrelated keys/comments.
  while (end < block.length) {
    const nextBreak = block.indexOf("\n", end);
    const lineEnd = nextBreak === -1 ? block.length : nextBreak + 1;
    const next = block.slice(end, lineEnd).replace(/\r?\n$/, "");
    if (next.trim() === "" || /^[ \t]/.test(next)) {
      end = lineEnd;
      continue;
    }
    break;
  }
  return { start: match.index, end, comment };
}

function inlineCommentIndex(value) {
  let single = false;
  let double = false;
  let escaped = false;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (double && char === "\\") {
      escaped = true;
      continue;
    }
    if (!double && char === "'") single = !single;
    else if (!single && char === '"') double = !double;
    else if (!single && !double && char === "#" && (i === 0 || /\s/.test(value[i - 1]))) {
      return i;
    }
  }
  return -1;
}

function plainYamlSafe(value) {
  return (
    value.length > 0 &&
    value.trim() === value &&
    !/[\r\n]/.test(value) &&
    !/[:#][ \t]/.test(value) &&
    !/^[\-?:,\[\]{}#&*!|>'"%@`]/.test(value) &&
    !/^(?:null|~|true|false|yes|no|on|off|[-+]?\d+(?:\.\d+)?|\d{4}-\d{2}-\d{2})$/i.test(value)
  );
}

function serializeField(key, value, newline, comment = "") {
  const suffix = comment ? ` ${comment.trimStart()}` : "";
  if (typeof value === "number" || typeof value === "boolean") {
    return `${key}: ${value}${suffix}${newline}`;
  }
  if (Array.isArray(value)) {
    return `${key}: ${JSON.stringify(value)}${suffix}${newline}`;
  }
  if (value.includes("\n") || value.includes("\r")) {
    // JSON strings are valid YAML double-quoted scalars. Keeping escaped
    // newlines on one line preserves the textarea value exactly; a folded
    // (`>`) scalar would silently turn those newlines into spaces.
    return `${key}: ${JSON.stringify(value)}${suffix}${newline}`;
  }
  const scalar = plainYamlSafe(value) ? value : JSON.stringify(value);
  return `${key}: ${scalar}${suffix}${newline}`;
}

function patchOne(block, key, value, newline) {
  const range = fieldRange(block, key);
  if (value === null) {
    return range ? block.slice(0, range.start) + block.slice(range.end) : block;
  }
  const serialized = serializeField(key, value, newline, range?.comment);
  if (range) {
    return block.slice(0, range.start) + serialized + block.slice(range.end);
  }

  const anchor = key === "title_uk" ? "title" : key === "description_uk" ? "description" : undefined;
  const anchorRange = anchor ? fieldRange(block, anchor) : undefined;
  if (anchorRange) {
    return block.slice(0, anchorRange.end) + serialized + block.slice(anchorRange.end);
  }
  const separator = block.length === 0 || block.endsWith("\n") ? "" : newline;
  return `${block}${separator}${serialized}`;
}

/** Patch only requested keys, preserving all unrelated YAML bytes and body text. */
export function patchFrontmatter(source, changes) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new DevEditorError("Changes must be an object.");
  }
  const keys = Object.keys(changes);
  if (keys.length === 0) throw new DevEditorError("There are no changes to save.");
  for (const key of keys) {
    if (!EDITABLE_FRONTMATTER_KEYS.includes(key)) {
      throw new DevEditorError(`Frontmatter key '${key}' is not editable.`, 400, "unsupported_field");
    }
    const value = changes[key];
    const valid =
      value === null ||
      (["rating", "top_order", "part"].includes(key)
        ? typeof value === "number"
        : ["draft", "published"].includes(key)
          ? typeof value === "boolean"
          : key === "categories"
            ? Array.isArray(value) && value.every((item) => typeof item === "string")
            : typeof value === "string");
    if (!valid) {
      throw new DevEditorError(
        `Frontmatter key '${key}' has the wrong value type.`,
        400,
        "invalid_field"
      );
    }
  }
  if (Object.hasOwn(changes, "title") && !changes.title?.trim()) {
    throw new DevEditorError("The English title cannot be empty.", 422, "empty_title");
  }
  for (const key of ["title", "title_uk"]) {
    if (typeof changes[key] === "string" && /[\r\n]/.test(changes[key])) {
      throw new DevEditorError("A title must stay on one line.", 422, "multiline_title");
    }
    if (typeof changes[key] === "string" && changes[key].length > 300) {
      throw new DevEditorError("A title is too long.", 422, "too_long");
    }
  }
  for (const key of ["description", "description_uk"]) {
    if (typeof changes[key] === "string" && changes[key].length > 4000) {
      throw new DevEditorError("A description is too long.", 422, "too_long");
    }
  }
  for (const key of ["category", "series", "series_uk"]) {
    if (typeof changes[key] === "string" && /[\r\n\0]/.test(changes[key])) {
      throw new DevEditorError(
        `Frontmatter key '${key}' must stay on one line.`,
        422,
        "invalid_field"
      );
    }
    if (typeof changes[key] === "string" && changes[key].length > 200) {
      throw new DevEditorError(
        `Frontmatter key '${key}' is too long.`,
        422,
        "too_long"
      );
    }
  }
  if (Array.isArray(changes.categories)) {
    if (
      changes.categories.length > 20 ||
      changes.categories.some(
        (category) =>
          !category.trim() || category.length > 80 || /[\r\n\0]/.test(category)
      )
    ) {
      throw new DevEditorError(
        "Categories must be 1–80 character single-line names (20 maximum).",
        422,
        "invalid_categories"
      );
    }
  }
  if (Object.hasOwn(changes, "rating") && changes.rating !== null) {
    if (
      !Number.isFinite(changes.rating) ||
      changes.rating < 0 ||
      changes.rating > 5 ||
      Math.round(changes.rating * 2) !== changes.rating * 2
    ) {
      throw new DevEditorError(
        "A rating must be a half-star value from 0 to 5.",
        422,
        "invalid_rating"
      );
    }
  }
  if (Object.hasOwn(changes, "top_order") && changes.top_order !== null) {
    if (!Number.isSafeInteger(changes.top_order) || changes.top_order < 0) {
      throw new DevEditorError(
        "A Top-list order must be a non-negative whole number.",
        422,
        "invalid_top_order"
      );
    }
  }
  if (Object.hasOwn(changes, "part") && changes.part !== null) {
    if (!Number.isSafeInteger(changes.part) || changes.part < 1) {
      throw new DevEditorError(
        "A series part must be a positive whole number.",
        422,
        "invalid_part"
      );
    }
  }

  const parts = frontmatterParts(source);
  let block = parts.block;
  for (const key of EDITABLE_FRONTMATTER_KEYS) {
    if (!Object.hasOwn(changes, key)) continue;
    const raw = changes[key];
    const normalizedList = Array.isArray(raw)
      ? raw.map((item) => item.trim()).filter(Boolean)
      : undefined;
    const value = normalizedList
      ? normalizedList.length
        ? normalizedList
        : null
      : key === "title" || ["rating", "top_order", "part", "draft", "published"].includes(key)
        ? raw
        : raw?.trim()
          ? raw.trim()
          : null;
    block = patchOne(block, key, value, parts.newline);
  }
  const next = `${parts.before}${block}${parts.after}`;

  let parsed;
  try {
    parsed = matter(next).data;
  } catch {
    throw new DevEditorError("The edit would produce invalid YAML.", 422, "invalid_frontmatter");
  }
  if (typeof parsed.title !== "string" || !parsed.title.trim()) {
    throw new DevEditorError("The edited file must keep an English title.", 422, "empty_title");
  }
  return next;
}

function fieldText(data, key) {
  const value = data[key];
  if (value == null) return "";
  if (typeof value !== "string") {
    throw new DevEditorError(
      `Frontmatter key '${key}' is not a text scalar.`,
      422,
      "unsupported_shape"
    );
  }
  return value;
}

function fieldRating(data) {
  const value = data.rating;
  if (value == null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 5 ||
    Math.round(value * 2) !== value * 2
  ) {
    throw new DevEditorError(
      "The rating is not a half-star value from 0 to 5.",
      422,
      "invalid_rating"
    );
  }
  return value;
}

function fieldTopOrder(data) {
  const value = data.top_order;
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DevEditorError(
      "The Top-list order is not a non-negative whole number.",
      422,
      "invalid_top_order"
    );
  }
  return value;
}

function fieldPart(data) {
  const value = data.part;
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new DevEditorError(
      "The series part is not a positive whole number.",
      422,
      "invalid_part"
    );
  }
  return value;
}

function fieldCategories(data) {
  const raw = data.categories ?? data.category;
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",")
      : [];
  const out = [];
  for (const value of values) {
    const category = String(value).trim();
    if (category && !out.includes(category)) out.push(category);
  }
  return out;
}

export function documentPayload(sourcePath, raw) {
  let data;
  try {
    data = matter(raw).data;
  } catch {
    throw new DevEditorError("The vault file contains invalid YAML.", 422, "invalid_frontmatter");
  }
  return {
    source: sourcePath,
    revision: revisionFor(raw),
    fields: {
      title: fieldText(data, "title"),
      title_uk: fieldText(data, "title_uk"),
      description: fieldText(data, "description"),
      description_uk: fieldText(data, "description_uk"),
      draft: data.draft === true || data.published === false,
      published: typeof data.published === "boolean" ? data.published : null,
      category: fieldText(data, "category"),
      categories: fieldCategories(data),
      series: fieldText(data, "series"),
      series_uk: fieldText(data, "series_uk"),
      part: fieldPart(data),
      rating: fieldRating(data),
      top_order: fieldTopOrder(data),
    },
  };
}

export function readDocument(repoRoot, source) {
  const file = resolveVaultMarkdown(repoRoot, source);
  return withOpenTargets(documentPayload(source, fs.readFileSync(file, "utf8")), file);
}

function translatedSource(source) {
  return source.replace(/\.md$/i, ".uk.md");
}

function resolvePageSources(repoRoot, source, sourceUk) {
  const file = resolveVaultMarkdown(repoRoot, source);
  if (/(?:\.uk|\.excalidraw)\.md$/i.test(file)) {
    throw new DevEditorError(
      "A page edit must start from its primary Markdown document.",
      400,
      "unsupported_source"
    );
  }

  if (sourceUk == null) return { file, source, fileUk: undefined, sourceUk: undefined };
  if (typeof sourceUk !== "string" || sourceUk !== translatedSource(source)) {
    throw new DevEditorError(
      "The translated source is not the primary file's Ukrainian sibling.",
      400,
      "bad_translation"
    );
  }
  const fileUk = resolveVaultMarkdown(repoRoot, sourceUk);
  if (!/\.uk\.md$/i.test(fileUk)) {
    throw new DevEditorError(
      "The translated source is not a Ukrainian Markdown sibling.",
      400,
      "bad_translation"
    );
  }
  return { file, source, fileUk, sourceUk };
}

function pageDocumentPayload({ source, sourceUk, file, fileUk, raw, rawUk }) {
  const document = documentPayload(source, raw);
  return {
    source,
    sourceUk,
    revision: document.revision,
    revisionUk: rawUk === undefined ? undefined : revisionFor(rawUk),
    fields: {
      title: document.fields.title,
      title_uk: document.fields.title_uk,
      description: document.fields.description,
      description_uk: document.fields.description_uk,
      body: markdownBody(raw),
      body_uk: rawUk === undefined ? "" : editorNewlines(rawUk),
    },
    obsidian: {
      en: obsidianUri(file),
      uk: obsidianUri(fileUk ?? file),
    },
  };
}

/** Read all source-owned text for one rendered page, including its UK body. */
export async function readPageDocument(repoRoot, source, sourceUk) {
  const sources = resolvePageSources(repoRoot, source, sourceUk);
  const [raw, rawUk] = await Promise.all([
    fs.promises.readFile(sources.file, "utf8"),
    sources.fileUk ? fs.promises.readFile(sources.fileUk, "utf8") : undefined,
  ]);
  return pageDocumentPayload({ ...sources, raw, rawUk });
}

function obsidianUri(file) {
  return `obsidian://open?path=${encodeURIComponent(file)}`;
}

function withOpenTargets(payload, file) {
  const ukFile = file.replace(/\.md$/i, ".uk.md");
  return {
    ...payload,
    obsidian: {
      en: obsidianUri(file),
      uk: obsidianUri(fs.existsSync(ukFile) ? ukFile : file),
    },
  };
}

export async function saveDocument(repoRoot, { source, revision, changes }) {
  const file = resolveVaultMarkdown(repoRoot, source);
  if (/(?:\.uk|\.excalidraw)\.md$/i.test(file)) {
    throw new DevEditorError(
      "Translated bodies and drawing sources are not frontmatter documents.",
      400,
      "unsupported_source"
    );
  }
  const raw = await fs.promises.readFile(file, "utf8");
  if (revisionFor(raw) !== revision) {
    throw new DevEditorError(
      "This file changed in Obsidian after the editor opened.",
      409,
      "revision_conflict"
    );
  }

  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new DevEditorError("Changes must be an object.");
  }
  for (const key of Object.keys(changes)) {
    if (!EDITABLE_FRONTMATTER_KEYS.includes(key)) {
      throw new DevEditorError(
        `Frontmatter key '${key}' is not editable.`,
        400,
        "unsupported_field"
      );
    }
  }

  const current = documentPayload(source, raw);
  const currentData = matter(raw).data;
  const effectiveChanges = Object.fromEntries(
    Object.entries(changes ?? {}).filter(([key, value]) => {
      // Compare against the key's ACTUAL YAML value, not a normalized display
      // value. `draft` folds `published: false` for the UI, and `categories`
      // folds singular `category:` for display; using either normalization
      // here could remove the old key while mistakenly skipping its replacement.
      const currentValue = currentData[key] ?? null;
      return Array.isArray(currentValue) && Array.isArray(value)
        ? JSON.stringify(currentValue) !== JSON.stringify(value)
        : currentValue !== value;
    })
  );
  if (Object.keys(effectiveChanges).length === 0) {
    return withOpenTargets(current, file);
  }

  const next = patchFrontmatter(raw, effectiveChanges);
  if (next === raw) return withOpenTargets(documentPayload(source, raw), file);
  const stat = await fs.promises.stat(file);
  const temp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`
  );
  try {
    const handle = await fs.promises.open(temp, "wx", stat.mode);
    try {
      await handle.writeFile(next, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.promises.chmod(temp, stat.mode);
    const beforeRename = await fs.promises.readFile(file, "utf8");
    if (revisionFor(beforeRename) !== revision) {
      throw new DevEditorError(
        "This file changed in Obsidian while the edit was being saved.",
        409,
        "revision_conflict"
      );
    }
    await fs.promises.rename(temp, file);
  } catch (error) {
    await fs.promises.unlink(temp).catch(() => {});
    throw error;
  }
  return withOpenTargets(documentPayload(source, next), file);
}

async function replacePageFiles(opened, changed) {
  if (changed.length === 0) return;
  const suffix = `${process.pid}.${randomBytes(6).toString("hex")}`;
  const staged = [];
  const backups = [];
  const replaced = [];
  try {
    for (const entry of changed) {
      const stat = await fs.promises.stat(entry.file);
      const temp = path.join(
        path.dirname(entry.file),
        `.${path.basename(entry.file)}.${suffix}.tmp`
      );
      const backup = path.join(
        path.dirname(entry.file),
        `.${path.basename(entry.file)}.${suffix}.bak`
      );
      const handle = await fs.promises.open(temp, "wx", stat.mode);
      try {
        await handle.writeFile(entry.next, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.promises.chmod(temp, stat.mode);
      await fs.promises.copyFile(entry.file, backup);
      await fs.promises.chmod(backup, stat.mode);
      staged.push({ ...entry, temp, backup });
      backups.push({ ...entry, backup });
    }

    // Recheck the complete page snapshot, not just whichever half happened to
    // change. A title and its translated body are one browser draft.
    for (const entry of opened) {
      const beforeRename = await fs.promises.readFile(entry.file, "utf8");
      if (revisionFor(beforeRename) !== revisionFor(entry.raw)) {
        throw new DevEditorError(
          "This page changed in Obsidian while the edit was being saved.",
          409,
          "revision_conflict"
        );
      }
    }

    for (const entry of staged) {
      await fs.promises.rename(entry.temp, entry.file);
      replaced.push(entry);
    }
  } catch (error) {
    // A two-language save can cross two files. Restore any replacement that
    // already landed so Save is all-or-nothing from the author's perspective.
    const unrestored = new Set();
    for (const entry of [...replaced].reverse()) {
      if (!fs.existsSync(entry.backup)) continue;
      try {
        await fs.promises.rename(entry.backup, entry.file);
      } catch {
        // Preserve the original error and leave the backup recoverable.
        unrestored.add(entry.backup);
      }
    }
    for (const entry of staged) await fs.promises.unlink(entry.temp).catch(() => {});
    for (const entry of backups) {
      if (!unrestored.has(entry.backup)) await fs.promises.unlink(entry.backup).catch(() => {});
    }
    throw error;
  }

  for (const entry of backups) await fs.promises.unlink(entry.backup).catch(() => {});
}

/** Save page-owned metadata and Markdown bodies as one revision-safe draft. */
export async function savePageDocument(repoRoot, args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new DevEditorError("A page save must be an object.");
  }
  const { source, sourceUk, revision, revisionUk, changes } = args;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new DevEditorError("Changes must be an object.");
  }
  const keys = Object.keys(changes);
  if (keys.length === 0) throw new DevEditorError("There are no changes to save.");
  for (const key of keys) {
    if (!EDITABLE_PAGE_KEYS.includes(key)) {
      throw new DevEditorError(
        `Page field '${key}' is not editable.`,
        400,
        "unsupported_field"
      );
    }
  }

  const sources = resolvePageSources(repoRoot, source, sourceUk);
  const [raw, rawUk] = await Promise.all([
    fs.promises.readFile(sources.file, "utf8"),
    sources.fileUk ? fs.promises.readFile(sources.fileUk, "utf8") : undefined,
  ]);
  if (revisionFor(raw) !== revision || (rawUk !== undefined && revisionFor(rawUk) !== revisionUk)) {
    throw new DevEditorError(
      "This page changed in Obsidian after the editor opened.",
      409,
      "revision_conflict"
    );
  }

  const current = pageDocumentPayload({ ...sources, raw, rawUk });
  if (!current.fields.title.trim()) {
    throw new DevEditorError("The edited file must keep an English title.", 422, "empty_title");
  }

  const normalized = { ...changes };
  for (const key of ["body", "body_uk"]) {
    if (Object.hasOwn(normalized, key)) normalized[key] = validateMarkdownBody(normalized[key], key);
  }
  const effective = Object.fromEntries(
    Object.entries(normalized).filter(([key, value]) => current.fields[key] !== value)
  );
  if (Object.keys(effective).length === 0) return current;

  if (Object.hasOwn(effective, "body_uk") && rawUk === undefined) {
    throw new DevEditorError(
      "This page has no Ukrainian body file to edit.",
      400,
      "missing_translation"
    );
  }

  const metadataChanges = Object.fromEntries(
    Object.entries(effective).filter(([key]) => key !== "body" && key !== "body_uk")
  );
  let next = raw;
  if (Object.keys(metadataChanges).length > 0) next = patchFrontmatter(next, metadataChanges);
  if (Object.hasOwn(effective, "body")) next = patchMarkdownBody(next, effective.body);

  let nextUk = rawUk;
  if (rawUk !== undefined && Object.hasOwn(effective, "body_uk")) {
    const newline = newlineForBody(rawUk, frontmatterParts(raw).newline);
    nextUk = fileNewlines(effective.body_uk, newline);
  }

  const opened = [
    { file: sources.file, raw, next },
    ...(sources.fileUk && rawUk !== undefined && nextUk !== undefined
      ? [{ file: sources.fileUk, raw: rawUk, next: nextUk }]
      : []),
  ];
  await replacePageFiles(
    opened,
    opened.filter((entry) => entry.raw !== entry.next)
  );

  return pageDocumentPayload({ ...sources, raw: next, rawUk: nextUk });
}

const CREATABLE_SECTION_TYPES = new Set(["posts", "music", "people", "shelf", "projects"]);
const SHELF_FOLDERS = {
  book: "Books",
  movie: "Movies",
  show: "Shows",
  video: "Videos",
};

/** Keep the create response's pathname identical to lib/vault.ts::slugify(). */
export function createdEntrySlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function scaffoldText(value, label, max, { required = true } = {}) {
  if (typeof value !== "string") {
    if (!required && value == null) return "";
    throw new DevEditorError(`${label} must be text.`, 400, "invalid_scaffold");
  }
  const text = value.trim();
  if (required && !text) {
    throw new DevEditorError(`${label} is required.`, 422, "missing_scaffold_field");
  }
  if (text.length > max || /[\r\n\0]/.test(text)) {
    throw new DevEditorError(
      `${label} must be a single line no longer than ${max} characters.`,
      422,
      "invalid_scaffold"
    );
  }
  return text;
}

function scaffoldCategories(value) {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : value == null
        ? []
        : null;
  if (!items) {
    throw new DevEditorError("Categories must be text names.", 400, "invalid_categories");
  }
  const out = [];
  for (const item of items) {
    if (typeof item !== "string") {
      throw new DevEditorError("Categories must be text names.", 400, "invalid_categories");
    }
    const category = item.trim();
    if (!category) continue;
    if (category.length > 80 || /[\r\n\0]/.test(category)) {
      throw new DevEditorError("A category name is invalid.", 422, "invalid_categories");
    }
    if (!out.some((existing) => existing.toLowerCase() === category.toLowerCase())) {
      out.push(category);
    }
  }
  if (out.length > 20) {
    throw new DevEditorError("A note cannot start with more than 20 categories.", 422, "invalid_categories");
  }
  return out;
}

function createdFileName(title) {
  const name = title.normalize("NFC");
  if (
    name.startsWith(".") ||
    /[. ]$/.test(name) ||
    /[<>:"/\\|?*\0]/.test(name) ||
    /(?:\.md|\.uk|\.excalidraw)$/i.test(name) ||
    /^main(?:\.[a-z]{2})?$/i.test(name) ||
    Buffer.byteLength(name, "utf8") > 180
  ) {
    throw new DevEditorError(
      "The title cannot be used safely as a vault file name.",
      422,
      "invalid_filename"
    );
  }
  return name;
}

function localIsoDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sourcePath(repoRoot, file) {
  return path.relative(fs.realpathSync(repoRoot), file).split(path.sep).join("/");
}

function sectionForCreation(repoRoot, sectionSource) {
  const file = resolveVaultMarkdown(repoRoot, sectionSource);
  const realRoot = fs.realpathSync(repoRoot);
  const vaultRoot = fs.realpathSync(path.join(realRoot, "vault"));
  const sectionDir = path.dirname(file);
  if (path.basename(file).toLowerCase() !== "main.md" || path.dirname(sectionDir) !== vaultRoot) {
    throw new DevEditorError(
      "New entries can be created only from a top-level section page.",
      400,
      "bad_section"
    );
  }
  const raw = fs.readFileSync(file, "utf8");
  let data;
  try {
    data = matter(raw).data;
  } catch {
    throw new DevEditorError("The section has invalid YAML.", 422, "invalid_frontmatter");
  }
  const type = typeof data.type === "string" ? data.type : "posts";
  if (!CREATABLE_SECTION_TYPES.has(type)) {
    throw new DevEditorError(
      "This section does not have a new-entry template.",
      422,
      "unsupported_section"
    );
  }
  const slug = createdEntrySlug(data.slug ?? path.basename(sectionDir));
  if (!slug) throw new DevEditorError("The section has no usable URL slug.", 422, "bad_section");
  return { file, sectionDir, type, slug };
}

function entryFiles(dir) {
  const out = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name.startsWith(".")) continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) {
      out.push(...entryFiles(file));
      continue;
    }
    if (
      !item.name.toLowerCase().endsWith(".md") ||
      /^main(?:\.[a-z]{2})?\.md$/i.test(item.name) ||
      /(?:\.uk|\.excalidraw)\.md$/i.test(item.name)
    )
      continue;
    out.push(file);
  }
  return out;
}

function assertUniqueEntry(sectionDir, slug, target, targetUk) {
  if (fs.existsSync(target) || fs.existsSync(targetUk)) {
    throw new DevEditorError("A note with this file name already exists.", 409, "entry_exists");
  }
  for (const file of entryFiles(sectionDir)) {
    const raw = fs.readFileSync(file, "utf8");
    let data;
    try {
      data = matter(raw).data;
    } catch {
      continue;
    }
    const fileName = path.basename(file).replace(/\.md$/i, "");
    if (createdEntrySlug(data.slug ?? fileName) === slug) {
      throw new DevEditorError(
        "Another note already uses the URL this title would create.",
        409,
        "slug_exists"
      );
    }
  }
}

function scaffoldBodies(type, { mediaUrl = "" } = {}) {
  const media = mediaUrl ? `\n${mediaUrl}\n` : "";
  if (type === "people") {
    return {
      en: "## At a glance\n\n| | |\n|---|---|\n| Known for | … |\n\n## Why this person\n\n*To be written.*\n\n## Sources\n\n*Add 2–4 verified sources.*\n",
      uk: "## Коротко\n\n| | |\n|---|---|\n| Відомий / відома завдяки | … |\n\n## Чому ця людина\n\n*Треба написати.*\n\n## Джерела\n\n*Додайте 2–4 перевірені джерела.*\n",
    };
  }
  if (type === "shelf") {
    return {
      en: `## At a glance\n\n| | |\n|---|---|\n| One-liner | … |\n${media}\n## Review\n\n*To be written.*\n`,
      uk: `## Коротко\n\n| | |\n|---|---|\n| Одним реченням | … |\n${media}\n## Відгук\n\n*Треба написати.*\n`,
    };
  }
  if (type === "music") {
    return {
      en: `## At a glance\n\n| | |\n|---|---|\n| Released | … |\n| Label | … |\n| Length | … |\n${media}\n## Notes\n\n*To be written.*\n`,
      uk: `## Коротко\n\n| | |\n|---|---|\n| Випущено | … |\n| Лейбл | … |\n| Тривалість | … |\n${media}\n## Нотатки\n\n*Треба написати.*\n`,
    };
  }
  if (type === "projects") {
    return {
      en: "## Overview\n\n*To be written.*\n",
      uk: "## Огляд\n\n*Треба написати.*\n",
    };
  }
  return {
    en: "## Draft\n\n*To be written.*\n",
    uk: "## Чернетка\n\n*Треба написати.*\n",
  };
}

function scaffoldDocument(fields, comments, body) {
  const block = fields.map(([key, value]) => serializeField(key, value, "\n")).join("");
  return `---\n${block}${comments.join("\n")}${comments.length ? "\n" : ""}---\n${body}`;
}

async function createFilePair(files) {
  const suffix = `${process.pid}.${randomBytes(6).toString("hex")}`;
  const staged = [];
  const created = [];
  try {
    for (const entry of files) {
      const temp = path.join(path.dirname(entry.file), `.${path.basename(entry.file)}.${suffix}.tmp`);
      const handle = await fs.promises.open(temp, "wx", 0o644);
      try {
        await handle.writeFile(entry.content, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      staged.push({ ...entry, temp });
    }
    for (const entry of staged) {
      await fs.promises.link(entry.temp, entry.file);
      created.push(entry.file);
    }
  } catch (error) {
    for (const file of created.reverse()) await fs.promises.unlink(file).catch(() => {});
    if (error?.code === "EEXIST") {
      throw new DevEditorError("A note with this file name already exists.", 409, "entry_exists");
    }
    throw error;
  } finally {
    for (const entry of staged) await fs.promises.unlink(entry.temp).catch(() => {});
  }
}

/** Create one bilingual, prestructured draft from a supported section page. */
export async function createEntry(repoRoot, args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new DevEditorError("A new entry must be an object.");
  }
  const section = sectionForCreation(repoRoot, args.sectionSource);
  const title = scaffoldText(args.title, "English title", 160);
  const titleUk = scaffoldText(args.titleUk, "Ukrainian title", 160);
  const description = scaffoldText(args.description, "English description", 400);
  const descriptionUk = scaffoldText(args.descriptionUk, "Ukrainian description", 400);
  const categories = scaffoldCategories(args.categories);
  const fileName = createdFileName(title);
  const slug = createdEntrySlug(fileName);
  if (!slug) throw new DevEditorError("The title has no usable URL slug.", 422, "invalid_slug");

  const medium = scaffoldText(args.medium, "Shelf medium", 20, { required: false });
  const creator = scaffoldText(args.creator, "Creator / artist", 200, { required: false });
  const creatorUk = scaffoldText(args.creatorUk, "Ukrainian creator name", 200, { required: false });
  const format = scaffoldText(args.format, "Music format", 40, { required: false });
  const musicLang = scaffoldText(args.lang, "Music language shelf", 8, { required: false });
  const genres = scaffoldCategories(args.genres);
  const mediaUrl = scaffoldText(args.mediaUrl, "Media URL", 1000, { required: false });
  if (mediaUrl && !/^https:\/\//i.test(mediaUrl)) {
    throw new DevEditorError("A media URL must use HTTPS.", 422, "invalid_media_url");
  }
  if (section.type === "shelf" && !Object.hasOwn(SHELF_FOLDERS, medium)) {
    throw new DevEditorError("Choose Book, Movie, Show, or Video.", 422, "invalid_medium");
  }
  if (section.type === "shelf" && !creator) {
    throw new DevEditorError("A shelf item needs its creator.", 422, "missing_scaffold_field");
  }
  if (section.type === "music" && !creator) {
    throw new DevEditorError("A music note needs its artist.", 422, "missing_scaffold_field");
  }
  if (section.type === "music" && format && !["album", "track", "single", "ep", "mixtape", "live", "compilation"].includes(format)) {
    throw new DevEditorError("Choose a supported music format.", 422, "invalid_format");
  }
  if (section.type === "music" && !["en", "uk", "ru"].includes(musicLang)) {
    throw new DevEditorError("Choose the English, Ukrainian, or Russian music shelf.", 422, "invalid_music_lang");
  }

  const targetDir = section.type === "shelf"
    ? fs.realpathSync(path.join(section.sectionDir, SHELF_FOLDERS[medium]))
    : section.sectionDir;
  if (!inside(section.sectionDir, targetDir)) {
    throw new DevEditorError("The template folder is outside its section.", 403, "outside_vault");
  }
  const file = path.join(targetDir, `${fileName}.md`);
  const fileUk = path.join(targetDir, `${fileName}.uk.md`);
  assertUniqueEntry(section.sectionDir, slug, file, fileUk);

  const fields = [
    ["title", title],
    ["title_uk", titleUk],
    ["date", localIsoDate()],
    ["description", description],
    ["description_uk", descriptionUk],
    ["draft", true],
  ];
  const comments = [];
  if (section.type === "posts" && categories.length === 1) fields.push(["category", categories[0]]);
  else if (["posts", "people", "shelf"].includes(section.type) && categories.length) {
    fields.push(["categories", categories]);
  }
  if (section.type === "people") {
    comments.push(`# cover: ${slug}.jpg   ← add a square licensed photo and uncomment`);
  } else if (section.type === "music") {
    fields.push(["artist", creator]);
    if (format) fields.push(["format", format]);
    fields.push(["lang", musicLang]);
    if (genres.length) fields.push(["genres", genres]);
    comments.push(`# cover: ${slug}.jpg   ← add album artwork and uncomment`);
    comments.push(`# artist_photo: ${createdEntrySlug(creator) || "artist"}.jpg   ← add a square portrait and uncomment`);
  } else if (section.type === "shelf") {
    fields.push(["author", creator]);
    if (creatorUk) fields.push(["author_uk", creatorUk]);
    fields.push(["medium", medium]);
    if (medium === "video" && mediaUrl) fields.push(["video", mediaUrl]);
    else if (medium !== "video") comments.push(`# cover: ${slug}.jpg   ← add cover art and uncomment`);
    comments.push(`# author_photo: ${createdEntrySlug(creator) || "creator"}.jpg   ← add a licensed portrait and uncomment`);
  }
  const bodies = scaffoldBodies(section.type, { mediaUrl });
  const primary = scaffoldDocument(fields, comments, bodies.en);
  await createFilePair([
    { file, content: primary },
    { file: fileUk, content: bodies.uk },
  ]);

  const source = sourcePath(repoRoot, file);
  const sourceUk = sourcePath(repoRoot, fileUk);
  return {
    ...(await readPageDocument(repoRoot, source, sourceUk)),
    pathname: `/${section.slug}/${slug}`,
  };
}

const GOAL_HEADINGS = new Set(["goals", "short term goals", "цілі", "короткострокові цілі"]);

function foldedHeading(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function plainGoalLabel(value) {
  return value
    .replace(/\s*(?:→|➔|->)\s*(?:!?\[\[[^\]]+\]\]|\[[^\]]*\]\([^)]+\)|https?:\/\/\S+)\s*$/i, "")
    .replace(/\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g, (_match, target, label) => label || target)
    .replace(/\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/(?:\*\*|__)(.+?)(?:\*\*|__)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Change one top-level checkbox under ## Goals without rewriting its text. */
export function patchNowGoalBody(body, index, done, expectedLabel) {
  if (!Number.isSafeInteger(index) || index < 0 || index > 100) {
    throw new DevEditorError("The goal index is invalid.", 400, "invalid_goal");
  }
  if (typeof done !== "boolean") {
    throw new DevEditorError("The goal state must be true or false.", 400, "invalid_goal");
  }
  const lines = editorNewlines(validateMarkdownBody(body)).split("\n");
  let inGoals = false;
  let seen = 0;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(lines[lineIndex]);
    if (heading && heading[1].length <= 2) {
      inGoals = heading[1].length === 2 && GOAL_HEADINGS.has(foldedHeading(heading[2]));
      continue;
    }
    if (!inGoals) continue;
    const task = /^([-*+]\s+\[)([ xX])(\]\s+)(.*)$/.exec(lines[lineIndex]);
    if (!task) continue;
    if (seen !== index) {
      seen += 1;
      continue;
    }
    if (
      typeof expectedLabel === "string" &&
      foldedHeading(plainGoalLabel(task[4])) !== foldedHeading(expectedLabel)
    ) {
      throw new DevEditorError(
        "The goal changed after this page rendered. Refresh and try again.",
        409,
        "revision_conflict"
      );
    }
    lines[lineIndex] = `${task[1]}${done ? "x" : " "}${task[3]}${task[4]}`;
    return lines.join("\n");
  }
  throw new DevEditorError("That goal no longer exists.", 409, "revision_conflict");
}

/** Toggle a rendered Now card in both language bodies as one atomic save. */
export async function toggleNowGoal(repoRoot, args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new DevEditorError("A goal update must be an object.");
  }
  if (typeof args.expectedLabel !== "string" || !args.expectedLabel.trim()) {
    throw new DevEditorError(
      "The rendered goal label is required for a safe update.",
      400,
      "invalid_goal"
    );
  }
  const sources = resolvePageSources(repoRoot, args.source, args.sourceUk);
  const sibling = sources.file.replace(/\.md$/i, ".uk.md");
  if (!sources.fileUk && fs.existsSync(sibling)) {
    throw new DevEditorError(
      "The translated goal source was not supplied.",
      400,
      "missing_translation_source"
    );
  }
  const [raw, rawUk] = await Promise.all([
    fs.promises.readFile(sources.file, "utf8"),
    sources.fileUk ? fs.promises.readFile(sources.fileUk, "utf8") : undefined,
  ]);
  const data = matter(raw).data;
  if (data.type !== "now" || path.basename(sources.file).toLowerCase() !== "main.md") {
    throw new DevEditorError("Only the Now page has editable goal cards.", 422, "not_now");
  }
  const body = patchNowGoalBody(markdownBody(raw), args.index, args.done, args.expectedLabel);
  const next = patchMarkdownBody(raw, body);
  const nextUk = rawUk === undefined
    ? undefined
    : fileNewlines(
        patchNowGoalBody(rawUk, args.index, args.done),
        newlineForBody(rawUk, frontmatterParts(raw).newline)
      );
  const opened = [
    { file: sources.file, raw, next },
    ...(sources.fileUk && rawUk !== undefined && nextUk !== undefined
      ? [{ file: sources.fileUk, raw: rawUk, next: nextUk }]
      : []),
  ];
  await replacePageFiles(
    opened,
    opened.filter((entry) => entry.raw !== entry.next)
  );
  return pageDocumentPayload({ ...sources, raw: next, rawUk: nextUk });
}

/**
 * Persist a complete Top-list order for one drag gesture.
 *
 * The browser sends the sources in their new visual order. We validate and
 * snapshot every file before writing any of them, then stage all replacements
 * beside their originals. A short revision re-check immediately before the
 * renames prevents an Obsidian edit made during the gesture from being
 * silently overwritten. Backups let us restore the already-renamed files if a
 * filesystem error interrupts the final pass.
 */
export async function reorderDocuments(repoRoot, args) {
  const items = args && typeof args === "object" && !Array.isArray(args) ? args.items : undefined;
  if (!Array.isArray(items) || items.length === 0 || items.length > 200) {
    throw new DevEditorError(
      "A Top-list reorder must contain between 1 and 200 items.",
      400,
      "bad_order"
    );
  }

  const seenSources = new Set();
  const seenOrders = new Set();
  const seenFiles = new Set();
  const requested = items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new DevEditorError("Each Top-list item must be an object.", 400, "bad_order");
    }
    const { source, order } = item;
    if (typeof source !== "string" || seenSources.has(source)) {
      throw new DevEditorError("A Top-list reorder contains a duplicate or invalid source.", 400, "bad_order");
    }
    if (
      !Number.isSafeInteger(order) ||
      order < 0 ||
      order >= items.length ||
      seenOrders.has(order)
    ) {
      throw new DevEditorError("A Top-list order must contain unique non-negative positions.", 400, "bad_order");
    }
    seenSources.add(source);
    seenOrders.add(order);
    return { source, order };
  });

  const opened = [];
  for (const { source, order } of requested) {
    const file = resolveVaultMarkdown(repoRoot, source);
    if (seenFiles.has(file)) {
      throw new DevEditorError("A Top-list reorder points to the same file twice.", 400, "bad_order");
    }
    seenFiles.add(file);
    if (/(?:\.uk|\.excalidraw)\.md$/i.test(file)) {
      throw new DevEditorError(
        "Translated bodies and drawing sources are not Top-list documents.",
        400,
        "unsupported_source"
      );
    }
    const raw = await fs.promises.readFile(file, "utf8");
    const current = documentPayload(source, raw);
    const next = current.fields.top_order === order
      ? raw
      : patchFrontmatter(raw, { top_order: order });
    opened.push({ source, order, file, raw, next, current });
  }

  const changed = opened.filter((entry) => entry.next !== entry.raw);
  if (changed.length === 0) {
    return {
      documents: opened.map((entry) => withOpenTargets(entry.current, entry.file)),
    };
  }

  const staged = [];
  const backups = [];
  const suffix = `${process.pid}.${randomBytes(6).toString("hex")}`;
  try {
    for (const entry of changed) {
      const stat = await fs.promises.stat(entry.file);
      const temp = path.join(path.dirname(entry.file), `.${path.basename(entry.file)}.${suffix}.tmp`);
      const backup = path.join(path.dirname(entry.file), `.${path.basename(entry.file)}.${suffix}.bak`);
      const handle = await fs.promises.open(temp, "wx", stat.mode);
      try {
        await handle.writeFile(entry.next, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.promises.chmod(temp, stat.mode);
      await fs.promises.copyFile(entry.file, backup);
      await fs.promises.chmod(backup, stat.mode);
      staged.push({ ...entry, temp });
      backups.push({ ...entry, backup });
    }

    for (const entry of opened) {
      const beforeRename = await fs.promises.readFile(entry.file, "utf8");
      if (revisionFor(beforeRename) !== entry.current.revision) {
        throw new DevEditorError(
          "A Top-list file changed in Obsidian while the order was being saved.",
          409,
          "revision_conflict"
        );
      }
    }

    for (const entry of staged) await fs.promises.rename(entry.temp, entry.file);
  } catch (error) {
    // Restore any files whose staged replacement made it into place. A failed
    // restore is still surfaced, but the remaining backup is kept recoverable
    // instead of being mistaken for a successful save.
    for (const entry of backups) {
      if (fs.existsSync(entry.backup)) {
        try {
          await fs.promises.rename(entry.backup, entry.file);
        } catch {
          // Preserve the original error and leave the backup for inspection.
        }
      }
    }
    for (const entry of staged) await fs.promises.unlink(entry.temp).catch(() => {});
    for (const entry of backups) await fs.promises.unlink(entry.backup).catch(() => {});
    throw error;
  }

  for (const entry of backups) await fs.promises.unlink(entry.backup).catch(() => {});
  return {
    documents: opened.map((entry) =>
      withOpenTargets(documentPayload(entry.source, entry.next), entry.file)
    ),
  };
}
