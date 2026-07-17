"use client";

import { useEffect, useState } from "react";

/**
 * Global image lightbox: click any content image (`.prose img`, avatars
 * excluded) to view it full size on a dimmed backdrop. Click anywhere or
 * press Escape to close. Uses event delegation — no per-image wiring.
 */
export default function Lightbox() {
  const [img, setImg] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target;
      if (
        t instanceof HTMLImageElement &&
        t.closest(".prose") &&
        !t.classList.contains("avatar")
      ) {
        e.preventDefault();
        setImg({ src: t.currentSrc || t.src, alt: t.alt });
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setImg(null);
    document.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!img) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={img.alt || "Image preview"}
      onClick={() => setImg(null)}
      className="fixed inset-0 z-[70] flex cursor-zoom-out flex-col items-center justify-center gap-3 bg-black/85 p-6 backdrop-blur-sm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.src}
        alt={img.alt}
        className="max-h-[85vh] max-w-full rounded-lg object-contain"
      />
      {img.alt && <p className="text-sm text-white/70">{img.alt}</p>}
    </div>
  );
}
