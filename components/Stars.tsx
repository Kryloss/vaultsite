/**
 * Monochrome 5-star rating display. Supports halves (rating: 3.5).
 * Pure component — safe in both server and client components.
 */

function Star({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 2.5l2.95 6.35 6.95.62-5.25 4.62 1.55 6.81L12 17.3l-6.2 3.6 1.55-6.81L2.1 9.47l6.95-.62L12 2.5z" />
    </svg>
  );
}

export default function Stars({
  rating,
  size = 14,
  className = "",
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  const value = Math.round(Math.min(Math.max(rating, 0), 5) * 2) / 2;

  return (
    <span
      role="img"
      aria-label={`${value} out of 5 stars`}
      className={`inline-flex items-center gap-[3px] ${className}`}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.min(Math.max(value - (i - 1), 0), 1); // 0 | 0.5 | 1
        return (
          <span
            key={i}
            className="relative inline-block"
            style={{ width: size, height: size }}
          >
            <Star className="absolute inset-0 h-full w-full text-[var(--border)]" />
            {fill > 0 && (
              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                {/* fixed-size overlay so the clip lines up with the base star */}
                <span
                  className="block text-[var(--text)]"
                  style={{ width: size, height: size }}
                >
                  <Star className="h-full w-full" />
                </span>
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
