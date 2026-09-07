"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/useLang";
import { useDevToolsExpanded } from "@/components/useDevToolsExpanded";
import { devEditorRequest, DevEditorRequestError, fileToBase64 } from "@/lib/dev-editor-client";
import { devUi } from "@/lib/ui-strings";

const SAVED_EVENT = "vault-dev-editor-saved";

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
  medium,
  draft: initialDraft,
  date: initialDate,
  status: initialStatus,
  rating: initialRating,
  cover: initialCover,
  categories: initialCategories,
  series: initialSeries,
  seriesUk: initialSeriesUk,
  part: initialPart,
  categoryOptions,
  seriesOptions,
}: {
  source: string;
  sectionType: string;
  medium?: string;
  draft: boolean;
  date?: string;
  status?: string;
  rating?: number;
  cover?: string;
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
  const [date, setDate] = useState(initialDate ?? "");
  const [status, setStatus] = useState(initialStatus ?? "");
  const [rating, setRating] = useState(initialRating == null ? "" : String(initialRating));
  const [coverBusy, setCoverBusy] = useState(false);
  const [categories, setCategories] = useState(initialCategories.join(", "));
  const [series, setSeries] = useState(initialSeries ?? "");
  const [seriesUk, setSeriesUk] = useState(initialSeriesUk ?? "");
  const [part, setPart] = useState(initialPart ? String(initialPart) : "");
  const [saving, setSaving] = useState(false);
  const [saveState, setStatusState] = useState<"idle" | "saved" | "conflict" | "failed">("idle");
  const [failure, setFailure] = useState<
    "dirty" | "part" | "seriesUk" | "rating" | "cover" | null
  >(null);

  useEffect(() => {
    if (saving) return;
    setDraft(initialDraft);
    setDate(initialDate ?? "");
    setStatus(initialStatus ?? "");
    setRating(initialRating == null ? "" : String(initialRating));
    setCategories(initialCategories.join(", "));
    setSeries(initialSeries ?? "");
    setSeriesUk(initialSeriesUk ?? "");
    setPart(initialPart ? String(initialPart) : "");
  }, [
    initialCategories,
    initialDate,
    initialDraft,
    initialPart,
    initialRating,
    initialSeries,
    initialSeriesUk,
    initialStatus,
    saving,
  ]);

  if (!expanded) return null;

  const supportsCategories = ["posts", "people", "shelf"].includes(sectionType);
  const supportsSeries = sectionType === "posts";
  const supportsShelf = sectionType === "shelf";
  const supportsCover = ["shelf", "people", "music"].includes(sectionType);
  const words = statusWords(medium);
  const knownStatus = ["", words.progress, words.queued].includes(status);
  const touch = () => {
    setFailure(null);
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
      if (supportsShelf) {
        changes.status = status.trim() || null;
        changes.rating = ratingNumber;
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
        new CustomEvent(SAVED_EVENT, { detail: { source, revision: saved.revision } })
      );
      setStatusState("saved");
      router.refresh();
    } catch (error) {
      setFailure(null);
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
      setFailure("cover");
      setStatusState(
        error instanceof DevEditorRequestError && error.code === "revision_conflict"
          ? "conflict"
          : "failed"
      );
    } finally {
      setCoverBusy(false);
    }
  };

  let statusText: string | null = null;
  if (saveState === "saved") {
    statusText = (failure === "cover" ? devUi.devCoverSaved : devUi.devOptionsSaved)[lang];
  }
  else if (saveState === "conflict") statusText = devUi.devConflict[lang];
  else if (saveState === "failed") {
    if (failure === "dirty") statusText = devUi.devFinishCurrentEdit[lang];
    else if (failure === "part") statusText = devUi.devInvalidPart[lang];
    else if (failure === "seriesUk") statusText = devUi.devSeriesUkRequired[lang];
    else if (failure === "rating") statusText = devUi.devInvalidRating[lang];
    else if (failure === "cover") statusText = devUi.devCoverFailed[lang];
    else statusText = devUi.devOptionsFailed[lang];
  }

  return (
    <details className="dev-entry-options">
      <summary className="press">{devUi.devPageOptions[lang]}</summary>
      <form className="dev-entry-options-form" onSubmit={save}>
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

        <div className="dev-entry-options-actions">
          {statusText && <span role={saveState === "failed" ? "alert" : "status"}>{statusText}</span>}
          <button type="submit" className="press" disabled={saving}>
            {saving ? devUi.devSaving[lang] : devUi.devSaveOptions[lang]}
          </button>
        </div>
      </form>
    </details>
  );
}
