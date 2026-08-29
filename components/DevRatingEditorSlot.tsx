import Stars from "@/components/Stars";

/**
 * Keep the Top-list rating editor out of production while retaining the
 * ordinary static stars there. The client editor is imported only for the
 * development preview, where the loopback writer exists.
 */
export default async function DevRatingEditorSlot({
  source,
  rating,
  title,
  titleUk,
}: {
  source?: string;
  rating?: number;
  title: string;
  titleUk?: string;
}) {
  if (process.env.NODE_ENV !== "development" || !source) {
    return typeof rating === "number" ? <Stars rating={rating} /> : null;
  }
  const { default: DevRatingEditor } = await import("@/components/DevRatingEditor");
  return (
    <DevRatingEditor
      source={source}
      rating={rating}
      title={title}
      titleUk={titleUk}
    />
  );
}
