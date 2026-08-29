"use client";

import { useRef, useState } from "react";
import { useLang } from "@/components/useLang";
import { useDevToolsExpanded } from "@/components/useDevToolsExpanded";
import { devEditorRequest, DevEditorRequestError } from "@/lib/dev-editor-client";
import { devUi } from "@/lib/ui-strings";

interface CreatedEntry {
  pathname: string;
}

export default function DevCreateEntry({
  sectionSource,
  sectionType,
  sectionTitle,
  categories,
}: {
  sectionSource: string;
  sectionType: string;
  sectionTitle: string;
  categories: string[];
}) {
  const { lang } = useLang();
  const expanded = useDevToolsExpanded();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [medium, setMedium] = useState("book");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!expanded) return null;

  const open = () => {
    setError(null);
    dialogRef.current?.showModal();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (document.documentElement.hasAttribute("data-dev-dirty")) {
      setError(devUi.devFinishCurrentEdit[lang]);
      return;
    }
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    try {
      const created = await devEditorRequest<CreatedEntry>("create-entry", {
        sectionSource,
        title: data.get("title"),
        titleUk: data.get("titleUk"),
        description: data.get("description"),
        descriptionUk: data.get("descriptionUk"),
        categories: data.get("categories"),
        medium: sectionType === "shelf" ? data.get("medium") : undefined,
        creator:
          sectionType === "shelf" || sectionType === "music"
            ? data.get("creator")
            : undefined,
        creatorUk: sectionType === "shelf" ? data.get("creatorUk") : undefined,
        format: sectionType === "music" ? data.get("format") : undefined,
        lang: sectionType === "music" ? data.get("musicLang") : undefined,
        genres: sectionType === "music" ? data.get("genres") : undefined,
        mediaUrl:
          sectionType === "music" || (sectionType === "shelf" && medium === "video")
            ? data.get("mediaUrl")
            : undefined,
      });
      dialogRef.current?.close();
      // A newly created draft is also a newly generated route. A full local
      // navigation lets Next discover it before rendering the destination.
      window.location.assign(created.pathname);
    } catch (caught) {
      setError(
        caught instanceof DevEditorRequestError
          ? caught.message
          : devUi.devCreateFailed[lang]
      );
    } finally {
      setSaving(false);
    }
  };

  const needsCreator = sectionType === "shelf" || sectionType === "music";
  const supportsCategories = ["posts", "people", "shelf"].includes(sectionType);
  const showsMedia = sectionType === "music" || (sectionType === "shelf" && medium === "video");

  return (
    <>
      <button
        type="button"
        className="press dev-page-add"
        aria-label={`${devUi.devCreateEntry[lang]} — ${sectionTitle}`}
        title={devUi.devCreateEntry[lang]}
        onClick={open}
      >
        <span aria-hidden>+</span>
      </button>
      <dialog
        ref={dialogRef}
        className="dev-page-dialog"
        aria-label={devUi.devCreateEntry[lang]}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <form className="dev-page-form" onSubmit={submit}>
          <header className="dev-page-form-heading">
            <div>
              <h2>{devUi.devCreateEntry[lang]}</h2>
              <p>{devUi.devCreatesDraft[lang]}</p>
            </div>
            <button
              type="button"
              className="press dev-page-form-close"
              aria-label={devUi.devCancel[lang]}
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </header>

          <div className="dev-page-form-grid">
            <label>
              <span>{devUi.devTitleEn[lang]}</span>
              <input name="title" required maxLength={160} autoFocus />
            </label>
            <label>
              <span>{devUi.devTitleUk[lang]}</span>
              <input name="titleUk" required maxLength={160} lang="uk" />
            </label>
            <label className="dev-page-form-wide">
              <span>{devUi.devDescriptionEn[lang]}</span>
              <input name="description" required maxLength={400} />
            </label>
            <label className="dev-page-form-wide">
              <span>{devUi.devDescriptionUk[lang]}</span>
              <input name="descriptionUk" required maxLength={400} lang="uk" />
            </label>

            {sectionType === "shelf" && (
              <label>
                <span>{devUi.devMedium[lang]}</span>
                <select
                  name="medium"
                  value={medium}
                  onChange={(event) => setMedium(event.target.value)}
                >
                  <option value="book">{devUi.devBook[lang]}</option>
                  <option value="movie">{devUi.devMovie[lang]}</option>
                  <option value="show">{devUi.devShow[lang]}</option>
                  <option value="video">{devUi.devVideo[lang]}</option>
                </select>
              </label>
            )}
            {needsCreator && (
              <label className={sectionType === "music" ? "dev-page-form-wide" : undefined}>
                <span>
                  {(sectionType === "music" ? devUi.devArtist : devUi.devCreator)[lang]}
                </span>
                <input name="creator" required maxLength={200} />
              </label>
            )}
            {sectionType === "shelf" && (
              <label>
                <span>{devUi.devCreatorUk[lang]}</span>
                <input name="creatorUk" maxLength={200} lang="uk" />
              </label>
            )}
            {sectionType === "music" && (
              <>
                <label>
                  <span>{devUi.devFormat[lang]}</span>
                  <select name="format" defaultValue="album">
                    {[
                      ["album", "Album"],
                      ["track", "Track"],
                      ["single", "Single"],
                      ["ep", "EP"],
                      ["mixtape", "Mixtape"],
                      ["live", "Live"],
                      ["compilation", "Compilation"],
                    ].map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{devUi.devMusicLanguage[lang]}</span>
                  <select name="musicLang" defaultValue="en">
                    <option value="en">{devUi.devMusicEnglish[lang]}</option>
                    <option value="uk">{devUi.devMusicUkrainian[lang]}</option>
                    <option value="ru">{devUi.devMusicRussian[lang]}</option>
                  </select>
                </label>
                <label className="dev-page-form-wide">
                  <span>{devUi.devGenres[lang]}</span>
                  <input name="genres" placeholder={devUi.devGenresHint[lang]} />
                </label>
              </>
            )}
            {supportsCategories && (
              <label className="dev-page-form-wide">
                <span>{devUi.devCategories[lang]}</span>
                <input
                  name="categories"
                  list={`dev-categories-${sectionType}`}
                  placeholder={devUi.devCategoriesHint[lang]}
                />
                <datalist id={`dev-categories-${sectionType}`}>
                  {categories.map((category) => <option key={category} value={category} />)}
                </datalist>
                <small>{devUi.devCategoryTranslationNote[lang]}</small>
              </label>
            )}
            {showsMedia && (
              <label className="dev-page-form-wide">
                <span>{devUi.devMediaUrl[lang]}</span>
                <input name="mediaUrl" type="url" inputMode="url" placeholder="https://…" />
              </label>
            )}
          </div>

          {error && <p className="dev-page-form-error" role="alert">{error}</p>}
          <footer className="dev-page-form-actions">
            <button type="button" className="press" onClick={() => dialogRef.current?.close()}>
              {devUi.devCancelShort[lang]}
            </button>
            <button type="submit" className="press dev-page-primary" disabled={saving}>
              {saving ? devUi.devCreating[lang] : devUi.devCreate[lang]}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
