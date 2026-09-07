interface SeriesOption {
  name: string;
  nameUk?: string;
}

/** Development-only contextual options rendered beneath an entry's metadata. */
export default async function DevEntryOptionsSlot(props: {
  source: string;
  sectionType: string;
  medium?: string;
  draft: boolean;
  date?: string;
  status?: string;
  rating?: number;
  cover?: string;
  categories: string[];
  series?: string;
  seriesUk?: string;
  part?: number;
  categoryOptions: string[];
  seriesOptions: SeriesOption[];
}) {
  if (process.env.NODE_ENV !== "development") return null;
  const { default: DevEntryOptions } = await import("@/components/DevEntryOptions");
  return <DevEntryOptions {...props} />;
}
