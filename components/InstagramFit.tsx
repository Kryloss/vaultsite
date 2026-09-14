"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { instagramCrop, instagramMeasure, instagramNeedsRemeasure } from "@/lib/instagram";

/**
 * Sizes Instagram embed frames to their content and crops them to the video
 * (DECISIONS #171).
 *
 * Without it a frame keeps the CSS fallback ratio and Instagram's whole card.
 * The embed page reports its own height once on load; this listens for that
 * message, matches it to the frame that sent it by `event.source`, sets the
 * height, and hands the block the crop from `instagramCrop` as custom
 * properties — the CSS hides the header and footer with them. A landscape
 * video is released to the column's width. The page never re-measures, so a
 * frame whose width later changes for real is reloaded to ask again.
 * Delegated from the window and re-scanned on navigation, the same shape as
 * components/CodeCopy.tsx.
 */
export default function InstagramFit() {
  const pathname = usePathname();

  useEffect(() => {
    const frames = Array.from(
      document.querySelectorAll<HTMLIFrameElement>("iframe.instagram-embed")
    );
    if (frames.length === 0) return;

    const measuredAt = new WeakMap<HTMLIFrameElement, number>();
    const timers = new Map<HTMLIFrameElement, number>();

    const onMessage = (event: MessageEvent) => {
      if (!/(^|\.)instagram\.com$/.test(safeHost(event.origin))) return;
      const height = instagramMeasure(event.data);
      if (height === undefined) return;
      const frame = frames.find((f) => f.contentWindow === event.source);
      if (!frame) return;
      const width = frame.getBoundingClientRect().width;
      frame.style.height = `${height}px`;
      frame.dataset.measured = "";
      measuredAt.set(frame, width);

      const block = frame.parentElement;
      if (!block) return;
      const crop = instagramCrop(height, width);
      if (!crop) {
        delete block.dataset.cropped;
        return;
      }
      block.style.setProperty("--ig-top", `${crop.top}px`);
      block.style.setProperty("--ig-media-h", `${crop.media}px`);
      block.dataset.cropped = crop.landscape ? "landscape" : "portrait";
    };

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const frame = entry.target as HTMLIFrameElement;
        if (!instagramNeedsRemeasure(measuredAt.get(frame) ?? 0, entry.contentRect.width)) continue;
        window.clearTimeout(timers.get(frame));
        timers.set(
          frame,
          window.setTimeout(() => {
            measuredAt.delete(frame);
            frame.src = frame.src;
          }, 400)
        );
      }
    });

    window.addEventListener("message", onMessage);
    for (const frame of frames) observer.observe(frame);
    return () => {
      window.removeEventListener("message", onMessage);
      observer.disconnect();
      for (const t of timers.values()) window.clearTimeout(t);
    };
  }, [pathname]);

  return null;
}

function safeHost(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return "";
  }
}
