"use client";

import { useEffect, useLayoutEffect } from "react";

import { fitNoteThumb } from "@/lib/note-thumb";

/* Hydration runs on the client only; on the server this component renders
   nothing, and React warns about `useLayoutEffect` there. Same shape as
   components/Coverflow.tsx. */
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Closes the gap between a note's artwork and its title (DECISIONS #134).
 *
 * The maths and the reasoning are in lib/note-thumb.ts. This is the mount:
 * it measures once — before paint, so a soft navigation never shows the wide
 * reserve the inline script covers on a hard load — and again whenever the
 * header changes size.
 *
 * ONE OBSERVER, on the header, covers everything that can change the answer:
 * the window resizing, the language toggle swapping a Ukrainian title in for
 * an English one, and the web font arriving. Each of those re-wraps the
 * title, changes the header's height, and so changes the width the artwork is
 * drawn at. The observer fires before paint, and `fitNoteThumb` settles
 * synchronously inside the callback, so it never leaves a frame's worth of
 * work for the next one — which is what a ResizeObserver loop is.
 */
export default function NoteThumbFit() {
  useIsoLayoutEffect(() => {
    const header = document.querySelector<HTMLElement>(".note-header");
    if (!header) return;

    fitNoteThumb(header);

    const observer = new ResizeObserver(() => fitNoteThumb(header));
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return null;
}
