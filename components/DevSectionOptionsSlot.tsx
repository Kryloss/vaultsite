export interface DevArtistOption {
  name: string;
  nameUk?: string;
  bio?: string;
  bioUk?: string;
}

/** Development-only section options: playlists and artist texts on /music. */
export default async function DevSectionOptionsSlot(props: {
  sectionSource: string;
  playlists: string[];
  artists: DevArtistOption[];
}) {
  if (process.env.NODE_ENV !== "development") return null;
  const { default: DevSectionOptions } = await import("@/components/DevSectionOptions");
  return <DevSectionOptions {...props} />;
}
