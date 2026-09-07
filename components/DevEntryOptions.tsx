"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/useLang";
import { useDevToolsExpanded } from "@/components/useDevToolsExpanded";
import { devEditorRequest, DevEditorRequestError, fileToBase64, SIDECAR_OUTDATED } from "@/lib/dev-editor-client";
import { devUi } from "@/lib/ui-strings";
import { DEV_EXTRA_FIELDS, type DevExtraField } from "@/lib/dev-tools";

const SAVED_EVENT = "vault-dev-editor-saved";
const LIST_FIELDS = new Set<DevExtraField>(["aliases", "genres", "lang"]);

interface DeletedEntry {
  pathname: string;
}

function listValue(value: string) {
  const out: string[] = [];
  for (const item of value.split(",")) {
    const trimmed = item.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

/**
 * The words lib/shelf.ts reads for each state, chosen by the medium's verb:
 * a book is read, a screen is watched, a game is played (#137). A note whose
 * `status:` is some other word the shelf accepts keeps it as its own option,
 * so saving unrelated fields never rewrites a spelling the author chose.
 */
function statusWords(medium: string | undefined) {
  if (medium === "book" || !medium) return { progress: "reading", queued: "to-read" };
  if (medium === "game") return { progress: "playing", queued: "to-play" };
  return { progress: "watching", queued: "to-watch" };
}

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

interface SeriesOption {
  name: string;
  nameUk?: string;
}

interface DocumentPayload {
  revision: string;
}

interface AttachedCover {
  name: string;
  document: DocumentPayload;
}

function categoryList(value: string) {
  const out: string[] = [];
  for (const item of value.split(",")) {
    const category = item.trim();
    if (category && !out.some((existing) => existing.toLowerCase() === category.toLowerCase())) {
      out.push(category);
    }
  }
  return out;
}

export default function DevEntryOptions({
  source,
  sectionType,
  title: initialTitle,
  titleUk: initialTitleUk,
  description: initialDescription,
  descriptionUk: initialDescriptionUk,
  medium,
  draft: initialDraft,
  date: initialDate,
  status: initialStatus,
  rating: initialRating,
  cover: initialCover,
  fields: initialFields,
  categories: initialCategories,
  series: initialSeries,
  seriesUk: initialSeriesUk,
  part: initialPart,
  categoryOptions,
  seriesOptions,
}: {
  source: string;
  sectionType: string;
  title: string;
  titleUk?: string;
  description?: string;
  descriptionUk?: string;
  medium?: string;
  draft: boolean;
  date?: string;
  status?: string;
  rating?: number;
  cover?: string;
  fields: Record<string, string>;
  categories: string[];
  series?: string;
  seriesUk?: string;
  part?: number;
  categoryOptions: string[];
  seriesOptions: SeriesOption[];
}) {
  const { lang } = useLang();
  const router = useRouter();
  const expanded = useDevToolsExpanded();
  const id = useId().replace(/:/g, "");
  const [draft, setDraft] = useState(initialDraft);
  const [title, setTitle] = useState(initialTitle);
  const [titleUk, setTitleUk] = useState(initialTitleUk ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [descriptionUk, setDescriptionUk] = useState(initialDescriptionUk ?? "");
  const [date, setDate] = useState(initialDate ?? "");
  const [status, setStatus] = useState(initialStatus ?? "");
  const [rating, setRating] = useState(initialRating == null ? "" : String(initialRating));
  const [coverBusy, setCoverBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(initialFields);
  const [mount, setMount] = useState<HTMLElement | null>(null);

  // The form renders inside the dock's bottom bar, through a mount the bar
  // provides while it is open; found by watching for it, since the bar is a
  // sibling island that mounts on its own schedule.
  useEffect(() => {
    if (!expanded) return;
    const find = () => {
      const next = document.querySelector<HTMLElement>("[data-dev-options-mount]");
      setMount((current) => (current === next ? current : next));
    };
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [expanded]);
  const [deleting, setDeleting] = useState(false);
  const [categories, setCategories] = useState(initialCategories.join(", "));
  const [series, setSeries] = useState(initialSeries ?? "");
  const [seriesUk, setSeriesUk] = useState(initialSeriesUk ?? "");
  const [part, setPart] = useState(initialPart ? String(initialPart) : "");
  const [saving, setSaving] = useState(false);
  const [saveState, setStatusState] = useState<"idle" | "saved" | "conflict" | "failed">("idle");
  const [failure, setFailure] = useState<
    "dirty" | "part" | "seriesUk" | "rating" | "cover" | "outdated" | "delete" | "title" | null
  >(null);
  const [failureText, setFailureText] = useState<string | null>(null);

  useEffect(() => {
    if (saving) return;
    setDraft(initialDraft);
    setTitle(initialTitle);
    setTitleUk(initialTitleUk ?? "");
    setDescription(initialDescription ?? "");
    setDescriptionUk(initialDescriptionUk ?? "");
    setDate(initialDate ?? "");
    setStatus(initialStatus ?? "");
    setRating(initialRating == null ? "" : String(initialRating));
    setFields(initialFields);
    setCategories(initialCategories.join(", "));
    setSeries(initialSeries ?? "");
    setSeriesUk(initialSeriesUk ?? "");
    setPart(initialPart ? String(initialPart) : "");
  }, [
    initialCategories,
    initialDate,
    initialDescription,
    initialDescriptionUk,
    initialDraft,
    initialFields,
    initialTitle,
    initialTitleUk,
    initialPart,
    initialRating,
    initialSeries,
    initialSeriesUk,
    initialStatus,
    saving,
  ]);

  if (!expanded || !mount) return null;

  const supportsCategories = ["posts", "people", "shelf"].includes(sectionType);
  const supportsSeries = sectionType === "posts";
  const supportsShelf = sectionType === "shelf";
  const supportsCover = ["shelf", "people", "music"].includes(sectionType);
  const words = statusWords(medium);
  const knownStatus = ["", words.progress, words.queued].includes(status);
  const touch = () => {
    setFailure(null);
    setFailureText(null);
    setStatusState("idle");
  };
  const existingSeries = seriesOptions.find(
    (option) => option.name.toLowerCase() === series.trim().toLowerCase()
  );
  const ownsSeriesTranslation = Boolean(
    initialSeriesUk &&
      initialSeries &&
      initialSeries.trim().toLowerCase() === series.trim().toLowerCase()
  );
  const seriesUkLocked = Boolean(existingSeries?.nameUk && !ownsSeriesTranslation);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (document.documentElement.hasAttribute("data-dev-dirty")) {
      setFailure("dirty");
      setStatusState("failed");
      return;
    }
    const names = categoryList(categories);
    const partNumber = part.trim() ? Number(part) : null;
    if (
      supportsSeries &&
      partNumber !== null &&
      (!Number.isSafeInteger(partNumber) || partNumber < 1)
    ) {
      setFailure("part");
      setStatusState("failed");
      return;
    }
    if (supportsSeries && series.trim() && !existingSeries?.nameUk && !seriesUk.trim()) {
      setFailure("seriesUk");
      setStatusState("failed");
      return;
    }
    if (!title.trim()) {
      setFailure("title");
      setStatusState("failed");
      return;
    }
    const ratingNumber = rating.trim() ? Number(rating) : null;
    if (
      supportsShelf &&
      ratingNumber !== null &&
      (!Number.isFinite(ratingNumber) ||
        ratingNumber < 0 ||
        ratingNumber > 5 ||
        Math.round(ratingNumber * 2) !== ratingNumber * 2)
    ) {
      setFailure("rating");
      setStatusState("failed");
      return;
    }
    setSaving(true);
    setFailure(null);
    setStatusState("idle");
    try {
      const opened = await devEditorRequest<DocumentPayload>("document", { source });
      const changes: Record<string, unknown> = {
        draft: draft ? true : null,
        published: null,
        date: date.trim() || null,
      };
      // The header fields are also the dock's inline fields; changed here,
      // the dock is told to re-read the page (`reload`) once the save lands.
      const headerChanged =
        title !== initialTitle ||
        titleUk !== (initialTitleUk ?? "") ||
        description !== (initialDescription ?? "") ||
        descriptionUk !== (initialDescriptionUk ?? "");
      if (headerChanged) {
        changes.title = title.trim();
        changes.title_uk = titleUk.trim() || null;
        changes.description = description.trim() || null;
        changes.description_uk = descriptionUk.trim() || null;
      }
      if (supportsShelf) {
        changes.status = status.trim() || null;
        changes.rating = ratingNumber;
      }
      for (const key of DEV_EXTRA_FIELDS) {
        if (!(key in fields) || fields[key] === initialFields[key]) continue;
        const value = fields[key].trim();
        changes[key] = LIST_FIELDS.has(key)
          ? listValue(value).length
            ? listValue(value)
            : null
          : value || null;
      }
      if (supportsSeries) {
        changes.series = series.trim() || null;
        // An established series stores its Ukrainian name on one part only.
        // Joining it here must not duplicate that value onto every new part.
        changes.series_uk =
          series.trim() && (!existingSeries?.nameUk || ownsSeriesTranslation) && seriesUk.trim()
            ? seriesUk.trim()
            : null;
        changes.part = series.trim() ? partNumber : null;
      }
      if (supportsCategories) {
        if (sectionType === "posts" && names.length <= 1) {
          changes.category = names[0] ?? null;
          changes.categories = null;
        } else {
          changes.category = null;
          changes.categories = names.length ? names : null;
        }
      }
      const saved = await devEditorRequest<DocumentPayload>("save", {
        source,
        revision: opened.revision,
        changes,
      });
      window.dispatchEvent(
        new CustomEvent(SAVED_EVENT, {
          detail: { source, revision: saved.revision, reload: headerChanged },
        })
      );
      setStatusState("saved");
      router.refresh();
    } catch (error) {
      const outdated = error instanceof DevEditorRequestError && error.code === SIDECAR_OUTDATED;
      setFailure(outdated ? "outdated" : null);
      // The sidecar's own words for a field it refused ("A slug is
      // lowercase…"), since the form cannot know every rule.
      setFailureText(
        error instanceof DevEditorRequestError && error.code?.startsWith("invalid_")
          ? error.message
          : null
      );
      setStatusState(
        error instanceof DevEditorRequestError && error.code === "revision_conflict"
          ? "conflict"
          : "failed"
      );
    } finally {
      setSaving(false);
    }
  };

  // A cover is one request: the image lands in the vault, the mirror, and
  // the note's `cover:` together, or not at all. Uses the same dirty guard as
  // the form so it never races the page editor's own save.
  const replaceCover = async (file: File | undefined) => {
    if (!file || coverBusy) return;
    if (document.documentElement.hasAttribute("data-dev-dirty")) {
      setFailure("dirty");
      setStatusState("failed");
      return;
    }
    setCoverBusy(true);
    setFailure(null);
    setStatusState("idle");
    try {
      const opened = await devEditorRequest<DocumentPayload>("document", { source });
      const attached = await devEditorRequest<AttachedCover>("attach-asset", {
        source,
        name: file.name,
        data: await fileToBase64(file),
        purpose: "cover",
        revision: opened.revision,
      });
      window.dispatchEvent(
        new CustomEvent(SAVED_EVENT, {
          detail: { source, revision: attached.document.revision },
        })
      );
      setFailure("cover");
      setStatusState("saved");
      router.refresh();
    } catch (error) {
      const outdated = error instanceof DevEditorRequestError && error.code === SIDECAR_OUTDATED;
      setFailure(outdated ? "outdated" : "cover");
      setStatusState(
        error instanceof DevEditorRequestError && error.code === "revision_conflict"
          ? "conflict"
          : "failed"
      );
    } finally {
      setCoverBusy(false);
    }
  };

  const remove = async () => {
    if (deleting) return;
    if (document.documentElement.hasAttribute("data-dev-dirty")) {
      setFailure("dirty");
      setStatusState("failed");
      return;
    }
    if (!window.confirm(devUi.devDeleteConfirm[lang])) return;
    setDeleting(true);
    setFailure(null);
    setFailureText(null);
    setStatusState("idle");
    try {
      const opened = await devEditorRequest<DocumentPayload>("document", { source });
      const deleted = await devEditorRequest<DeletedEntry>("delete-entry", {
        source,
        revision: opened.revision,
      });
      // The route is gone; a full navigation lets Next forget it.
      window.location.assign(deleted.pathname);
    } catch (error) {
      const outdated = error instanceof DevEditorRequestError && error.code === SIDECAR_OUTDATED;
      setFailure(outdated ? "outdated" : "delete");
      setStatusState("failed");
      setDeleting(false);
    }
  };

  const field = (key: DevExtraField) => ({
    value: fields[key] ?? "",
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setFields((current) => ({ ...current, [key]: value }));
      touch();
    },
  });
  const isVideo = medium === "video";
  const isScreen = medium === "movie" || medium === "show";
  const supportsMusic = sectionType === "music";

  let statusText: string | null = null;
  if (saveState === "saved") {
    statusText = (failure === "cover" ? devUi.devCoverSaved : devUi.devOptionsSaved)[lang];
  }
  else if (saveState === "conflict") statusText = devUi.devConflict[lang];
  else if (saveState === "failed") {
    if (failure === "dirty") statusText = devUi.devFinishCurrentEdit[lang];
    else if (failure === "title") statusText = devUi.devTitleRequired[lang];
    else if (failure === "outdated") statusText = devUi.devSidecarOutdated[lang];
    else if (failure === "part") statusText = devUi.devInvalidPart[lang];
    else if (failure === "seriesUk") statusText = devUi.devSeriesUkRequired[lang];
    else if (failure === "rating") statusText = devUi.devInvalidRating[lang];
    else if (failure === "cover") statusText = devUi.devCoverFailed[lang];
    else if (failure === "delete") statusText = devUi.devDeleteFailed[lang];
    else statusText = failureText ?? devUi.devOptionsFailed[lang];
  }

  return createPortal(
      <form className="dev-entry-options-form" onSubmit={save}>
        <label>
          <span>{devUi.devTitleEn[lang]}</span>
          <input value={title} maxLength={300} onChange={(event) => { setTitle(event.target.value); touch(); }} />
        </label>
        <label>
          <span>{devUi.devTitleUk[lang]}</span>
          <input value={titleUk} maxLength={300} lang="uk" onChange={(event) => { setTitleUk(event.target.value); touch(); }} />
        </label>
        <label className="dev-entry-options-wide">
          <span>{devUi.devDescriptionEn[lang]}</span>
          <textarea value={description} rows={2} maxLength={4000} onChange={(event) => { setDescription(event.target.value); touch(); }} />
        </label>
        <label className="dev-entry-options-wide">
          <span>{devUi.devDescriptionUk[lang]}</span>
          <textarea value={descriptionUk} rows={2} maxLength={4000} lang="uk" onChange={(event) => { setDescriptionUk(event.target.value); touch(); }} />
        </label>
        <label className="dev-entry-draft">
          <input
            type="checkbox"
            checked={draft}
            onChange={(event) => {
              setDraft(event.target.checked);
              setFailure(null);
              setStatusState("idle");
            }}
          />
          <span>{devUi.devDraft[lang]}</span>
        </label>

        <label>
          <span>{devUi.devDate[lang]}</span>
          <span className="dev-entry-options-inline">
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                touch();
              }}
            />
            <button
              type="button"
              className="press dev-entry-options-minor"
              onClick={() => {
                setDate(todayIso());
                touch();
              }}
            >
              {devUi.devToday[lang]}
            </button>
          </span>
        </label>

        {supportsShelf && (
          <>
            <label>
              <span>{devUi.devStatus[lang]}</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  touch();
                }}
              >
                <option value="">{devUi.devStatusFinished[lang]}</option>
                <option value={words.progress}>{devUi.devStatusProgress[lang]}</option>
                <option value={words.queued}>{devUi.devStatusQueued[lang]}</option>
                {!knownStatus && <option value={status}>{status}</option>}
              </select>
            </label>
            <label>
              <span>{devUi.devRating[lang]}</span>
              <input
                type="number"
                min={0}
                max={5}
                step={0.5}
                value={rating}
                placeholder={devUi.devUnrated[lang]}
                onChange={(event) => {
                  setRating(event.target.value);
                  touch();
                }}
              />
            </label>
          </>
        )}

        {supportsCover && (
          <label className="dev-entry-options-wide">
            <span>{devUi.devCover[lang]}</span>
            <span className="dev-entry-options-inline">
              <code className="dev-entry-cover-name">
                {initialCover ?? devUi.devNoCover[lang]}
              </code>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={coverBusy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  void replaceCover(file);
                }}
              />
              <span className="press dev-entry-options-minor" aria-hidden>
                {coverBusy ? devUi.devSaving[lang] : devUi.devChooseImage[lang]}
              </span>
            </span>
          </label>
        )}

        {supportsCategories && (
          <label className="dev-entry-options-wide">
            <span>{devUi.devCategories[lang]}</span>
            <input
              value={categories}
              maxLength={1600}
              list={`dev-entry-categories-${id}`}
              placeholder={devUi.devCategoriesHint[lang]}
              onChange={(event) => {
                setCategories(event.target.value);
                setFailure(null);
                setStatusState("idle");
              }}
            />
            <datalist id={`dev-entry-categories-${id}`}>
              {categoryOptions.map((category) => <option key={category} value={category} />)}
            </datalist>
            <small>{devUi.devCategoryTranslationNote[lang]}</small>
          </label>
        )}

        {supportsSeries && (
          <>
            <label className="dev-entry-options-wide">
              <span>{devUi.devSeries[lang]}</span>
              <input
                value={series}
                maxLength={200}
                list={`dev-entry-series-${id}`}
                placeholder={devUi.devSeriesHint[lang]}
                onChange={(event) => {
                  const next = event.target.value;
                  setSeries(next);
                  if (next.trim().toLowerCase() !== (initialSeries ?? "").trim().toLowerCase()) {
                    setSeriesUk("");
                  }
                  setFailure(null);
                  setStatusState("idle");
                }}
              />
              <datalist id={`dev-entry-series-${id}`}>
                {seriesOptions.map((option) => <option key={option.name} value={option.name} />)}
              </datalist>
            </label>
            <label>
              <span>{devUi.devSeriesUk[lang]}</span>
              <input
                value={seriesUk}
                maxLength={200}
                lang="uk"
                disabled={!series.trim() || seriesUkLocked}
                placeholder={existingSeries?.nameUk ?? undefined}
                onChange={(event) => {
                  setSeriesUk(event.target.value);
                  setFailure(null);
                  setStatusState("idle");
                }}
              />
            </label>
            <label>
              <span>{devUi.devSeriesPart[lang]}</span>
              <input
                type="number"
                min={1}
                step={1}
                value={part}
                disabled={!series.trim()}
                placeholder={devUi.devAutomatic[lang]}
                onChange={(event) => {
                  setPart(event.target.value);
                  setFailure(null);
                  setStatusState("idle");
                }}
              />
            </label>
          </>
        )}

        <details className="dev-entry-more dev-entry-options-wide">
          <summary className="press">{devUi.devMoreFields[lang]}</summary>
          <div className="dev-entry-more-grid">
            <label className="dev-entry-options-wide">
              <span>{devUi.devAliases[lang]}</span>
              <input {...field("aliases")} placeholder={devUi.devAliasesHint[lang]} maxLength={2000} />
            </label>
            <label>
              <span>{devUi.devSlug[lang]}</span>
              <input {...field("slug")} maxLength={120} spellCheck={false} />
              <small>{devUi.devSlugHint[lang]}</small>
            </label>
            {sectionType === "posts" && (
              <label>
                <span>{devUi.devMaturity[lang]}</span>
                <select {...field("maturity")}>
                  <option value="">{devUi.devAutomatic[lang]}</option>
                  <option value="seedling">seedling</option>
                  <option value="budding">budding</option>
                  <option value="evergreen">evergreen</option>
                </select>
              </label>
            )}
            {supportsShelf && (
              <>
                <label>
                  <span>{devUi.devMediumField[lang]}</span>
                  <select {...field("medium")}>
                    <option value="">{devUi.devAutomatic[lang]}</option>
                    <option value="book">{devUi.devBook[lang]}</option>
                    <option value="movie">{devUi.devMovie[lang]}</option>
                    <option value="show">{devUi.devShow[lang]}</option>
                    <option value="video">{devUi.devVideo[lang]}</option>
                    <option value="game">{devUi.devGame[lang]}</option>
                  </select>
                </label>
                <label>
                  <span>{devUi.devCreator[lang]}</span>
                  <input {...field("author")} maxLength={200} />
                </label>
                <label>
                  <span>{devUi.devCreatorUk[lang]}</span>
                  <input {...field("author_uk")} maxLength={200} lang="uk" />
                </label>
                <label className="dev-entry-options-wide">
                  <span>{devUi.devCreatorBio[lang]}</span>
                  <textarea {...field("author_bio")} rows={2} maxLength={4000} />
                </label>
                <label className="dev-entry-options-wide">
                  <span>{devUi.devCreatorBioUk[lang]}</span>
                  <textarea {...field("author_bio_uk")} rows={2} maxLength={4000} lang="uk" />
                </label>
                {isScreen && (
                  <label>
                    <span>{devUi.devImdbId[lang]}</span>
                    <input {...field("imdb_id")} maxLength={20} placeholder="tt0137523" spellCheck={false} />
                    <small>{devUi.devImdbIdHint[lang]}</small>
                  </label>
                )}
                {isVideo && (
                  <>
                    <label className="dev-entry-options-wide">
                      <span>{devUi.devVideoUrl[lang]}</span>
                      <input {...field("video")} type="url" inputMode="url" maxLength={400} placeholder="https://…" />
                    </label>
                    <label>
                      <span>{devUi.devUploaded[lang]}</span>
                      <input {...field("uploaded")} type="date" />
                    </label>
                  </>
                )}
              </>
            )}
            {supportsMusic && (
              <>
                <label>
                  <span>{devUi.devArtist[lang]}</span>
                  <input {...field("artist")} maxLength={200} />
                </label>
                <label>
                  <span>{devUi.devArtistUk[lang]}</span>
                  <input {...field("artist_uk")} maxLength={200} lang="uk" />
                </label>
                <label className="dev-entry-options-wide">
                  <span>{devUi.devArtistBio[lang]}</span>
                  <textarea {...field("artist_bio")} rows={2} maxLength={4000} />
                </label>
                <label className="dev-entry-options-wide">
                  <span>{devUi.devArtistBioUk[lang]}</span>
                  <textarea {...field("artist_bio_uk")} rows={2} maxLength={4000} lang="uk" />
                </label>
                <label>
                  <span>{devUi.devFormat[lang]}</span>
                  <select {...field("format")}>
                    <option value="">{devUi.devAutomatic[lang]}</option>
                    {["album", "track", "single", "ep", "mixtape", "live", "compilation"].map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{devUi.devMusicLanguage[lang]}</span>
                  <input {...field("lang")} maxLength={20} placeholder="en, uk" spellCheck={false} />
                </label>
                <label className="dev-entry-options-wide">
                  <span>{devUi.devGenres[lang]}</span>
                  <input {...field("genres")} maxLength={400} placeholder={devUi.devGenresHint[lang]} />
                </label>
              </>
            )}
          </div>
        </details>

        <div className="dev-entry-options-actions">
          <button
            type="button"
            className="press dev-entry-delete"
            data-tip={devUi.devTipDelete[lang]}
            disabled={deleting || saving}
            onClick={() => void remove()}
          >
            {deleting ? devUi.devDeleting[lang] : devUi.devDeleteNote[lang]}
          </button>
          {statusText && <span role={saveState === "failed" ? "alert" : "status"}>{statusText}</span>}
          <button type="submit" className="press" disabled={saving}>
            {saving ? devUi.devSaving[lang] : devUi.devSaveOptions[lang]}
          </button>
        </div>
      </form>,
    mount
  );
}
