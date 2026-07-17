/**
 * Shared Open Graph image renderer — dark theme card matching the site.
 * Used by app/opengraph-image.tsx and the per-section/per-entry variants.
 */
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

export function ogImage(title: string, subtitle?: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 88,
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              width: 72,
              height: 8,
              background: "#3b82f6",
              borderRadius: 4,
            }}
          />
          <div
            style={{
              fontSize: title.length > 40 ? 56 : 72,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 32, color: "#a1a1aa" }}>{subtitle}</div>
          )}
        </div>
      </div>
    ),
    OG_SIZE
  );
}
