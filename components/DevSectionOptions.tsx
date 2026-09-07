"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/useLang";
import { useDevToolsExpanded } from "@/components/useDevToolsExpanded";
import { devEditorRequest, DevEditorRequestError, SIDECAR_OUTDATED } from "@/lib/dev-editor-client";
import { devUi } from "@/lib/ui-strings";
import type { DevArtistOption } from "@/components/DevSectionOptionsSlot";

const SAVED_EVENT = "vault-dev-editor-saved";

interface DocumentPayload {
  revision: string;
}

/**
 * The music section's own options, in the bar: the Apple Music playlists
 * embedded at the top of /music, and the texts of the artists the deck
 * introduces (`artists:` in main.md — about the ARTIST; a note's own
 * `artist_bio:` is about that record and is edited on the note).
 */
export default function DevSectionOptions({
  sectionSource,
  playlists: initialPlaylists,
  artists,
}: {
  sectionSource: string;
  playlists: string[];
  artists: DevArtistOption[];
}) {
  const { lang } = useLang();
  const router = useRouter();
  const expanded = useDevToolsExpanded();
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [playlists, setPlaylists] = useState(initialPlaylists.join("\n"));
  const [artistName, setArtistName] = useState(artists[0]?.name ?? "");
  const [edits, setEdits] = useState<Record<string, { nameUk: string; bio: string; bioUk: string }>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (saving) return;
    setPlaylists(initialPlaylists.join("\n"));
    setEdits({});
  }, [initialPlaylists, artists, saving]);

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

  if (!expanded || !mount) return null;

  const artist = artists.find((candidate) => candidate.name === artistName);
  const current = edits[artistName] ?? {
    nameUk: artist?.nameUk ?? "",
    bio: artist?.bio ?? "",
    bioUk: artist?.bioUk ?? "",
  };
  const setField = (key: "nameUk" | "bio" | "bioUk", value: string) => {
    setEdits((all) => ({ ...all, [artistName]: { ...current, [key]: value } }));
    setStatus(null);
    setFailed(false);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (document.documentElement.hasAttribute("data-dev-dirty")) {
      setStatus(devUi.devFinishCurrentEdit[lang]);
      setFailed(true);
      return;
    }
    setSaving(true);
    setStatus(null);
    setFailed(false);
    try {
      const opened = await devEditorRequest<DocumentPayload>("document", { source: sectionSource });
      // Only the fields that actually changed: rewriting an untouched folded
      // scalar as one line would be a diff about nothing.
      const changedArtists = Object.entries(edits).flatMap(([name, value]) => {
        const original = artists.find((candidate) => candidate.name === name);
        if (!original) return [];
        const change: Record<string, string | null> = {};
        if (value.nameUk.trim() !== (original.nameUk ?? "")) change.name_uk = value.nameUk.trim() || null;
        if (value.bio.trim() !== (original.bio ?? "").trim()) change.bio = value.bio.trim() || null;
        if (value.bioUk.trim() !== (original.bioUk ?? "").trim()) change.bio_uk = value.bioUk.trim() || null;
        return Object.keys(change).length ? [{ name, ...change }] : [];
      });
      const urls = playlists
        .split("\n")
        .map((url) => url.trim())
        .filter(Boolean);
      const saved = await devEditorRequest<DocumentPayload>("save-music-section", {
        source: sectionSource,
        revision: opened.revision,
        playlists: urls,
        artists: changedArtists,
      });
      window.dispatchEvent(
        new CustomEvent(SAVED_EVENT, { detail: { source: sectionSource, revision: saved.revision } })
      );
      setStatus(devUi.devOptionsSaved[lang]);
      router.refresh();
    } catch (error) {
      setFailed(true);
      if (error instanceof DevEditorRequestError && error.code === SIDECAR_OUTDATED) {
        setStatus(devUi.devSidecarOutdated[lang]);
      } else if (error instanceof DevEditorRequestError && error.code === "revision_conflict") {
        setStatus(devUi.devConflict[lang]);
      } else if (error instanceof DevEditorRequestError && error.code?.startsWith("invalid_")) {
        setStatus(error.message);
      } else {
        setStatus(devUi.devOptionsFailed[lang]);
      }
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <form className="dev-entry-options-form" onSubmit={save}>
      <label className="dev-entry-options-wide">
        <span>{devUi.devPlaylists[lang]}</span>
        <textarea
          value={playlists}
          rows={2}
          spellCheck={false}
          placeholder="https://music.apple.com/…"
          onChange={(event) => {
            setPlaylists(event.target.value);
            setStatus(null);
            setFailed(false);
          }}
        />
        <small>{devUi.devPlaylistsHint[lang]}</small>
      </label>
      {artists.length > 0 && (
        <>
          <label className="dev-entry-options-wide">
            <span>{devUi.devArtist[lang]}</span>
            <select value={artistName} onChange={(event) => setArtistName(event.target.value)}>
              {artists.map((candidate) => (
                <option key={candidate.name} value={candidate.name}>
                  {candidate.name}
                  {edits[candidate.name] ? " •" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="dev-entry-options-wide">
            <span>{devUi.devArtistUk[lang]}</span>
            <input value={current.nameUk} maxLength={200} lang="uk" onChange={(event) => setField("nameUk", event.target.value)} />
          </label>
          <label className="dev-entry-options-wide">
            <span>{devUi.devArtistSectionBio[lang]}</span>
            <textarea value={current.bio} rows={3} maxLength={4000} onChange={(event) => setField("bio", event.target.value)} />
          </label>
          <label className="dev-entry-options-wide">
            <span>{devUi.devArtistSectionBioUk[lang]}</span>
            <textarea value={current.bioUk} rows={3} maxLength={4000} lang="uk" onChange={(event) => setField("bioUk", event.target.value)} />
          </label>
        </>
      )}
      <div className="dev-entry-options-actions">
        {status && <span role={failed ? "alert" : "status"}>{status}</span>}
        <button type="submit" className="press" disabled={saving}>
          {saving ? devUi.devSaving[lang] : devUi.devSaveOptions[lang]}
        </button>
      </div>
    </form>,
    mount
  );
}
