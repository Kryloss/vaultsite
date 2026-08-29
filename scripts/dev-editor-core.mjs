import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export const EDITABLE_FRONTMATTER_KEYS = [
  "title",
  "title_uk",
  "description",
  "description_uk",
  "rating",
  "top_order",
];

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
    newline,
  };
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
  if (typeof value === "number") return `${key}: ${value}${suffix}${newline}`;
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
    if (
      changes[key] !== null &&
      (["rating", "top_order"].includes(key)
        ? typeof changes[key] !== "number"
        : typeof changes[key] !== "string")
    ) {
      throw new DevEditorError(
        `Frontmatter key '${key}' must be ${["rating", "top_order"].includes(key) ? "a number" : "text"}.`
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

  const parts = frontmatterParts(source);
  let block = parts.block;
  for (const key of EDITABLE_FRONTMATTER_KEYS) {
    if (!Object.hasOwn(changes, key)) continue;
    const raw = changes[key];
    const value =
      key === "title" || ["rating", "top_order"].includes(key)
        ? raw
        : raw?.trim()
          ? raw
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
      rating: fieldRating(data),
      top_order: fieldTopOrder(data),
    },
  };
}

export function readDocument(repoRoot, source) {
  const file = resolveVaultMarkdown(repoRoot, source);
  return withOpenTargets(documentPayload(source, fs.readFileSync(file, "utf8")), file);
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
  const effectiveChanges = Object.fromEntries(
    Object.entries(changes ?? {}).filter(([key, value]) => current.fields[key] !== value)
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
