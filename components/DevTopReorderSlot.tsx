/**
 * The Top-list drag controller is a localhost-only client island. Keeping the
 * dynamic import behind this server slot means the public build receives no
 * reorder code or vault source markers.
 */
export default async function DevTopReorderSlot() {
  if (process.env.NODE_ENV !== "development") return null;
  const { default: DevTopReorder } = await import("@/components/DevTopReorder");
  return <DevTopReorder />;
}
