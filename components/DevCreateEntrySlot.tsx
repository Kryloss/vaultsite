const CREATABLE = new Set(["posts", "music", "people", "shelf", "projects"]);

/** Development-only page-level + button for a section's entry template. */
export default async function DevCreateEntrySlot({
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
  if (process.env.NODE_ENV !== "development" || !CREATABLE.has(sectionType)) return null;
  const { default: DevCreateEntry } = await import("@/components/DevCreateEntry");
  return (
    <DevCreateEntry
      sectionSource={sectionSource}
      sectionType={sectionType}
      sectionTitle={sectionTitle}
      categories={categories}
    />
  );
}
