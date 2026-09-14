"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { instagramMeasure, instagramNeedsRemeasure } from "@/lib/instagram";

/**
 * Sizes Instagram embed frames to their content (DECISIONS #171).
 *
 * Without it a frame keeps the CSS fallback ratio, which is right for no post
 * in particular: a landscape reel left 40% of its frame blank. The embed page
 * reports its own height once on load; this listens for that message, matches
 * it to the frame that sent it by `event.source`, and sets the height. The
 * page never re-measures, so a frame whose width later changes for real is
 * reloaded to ask again. Delegated from the window and re-scanned on
 * navigation, the same shape as components/CodeCopy.tsx.
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
      frame.style.height = `${height}px`;
      frame.dataset.measured = "";
      measuredAt.set(frame, frame.getBoundingClientRect().width);
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
