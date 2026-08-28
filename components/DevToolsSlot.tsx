/**
 * Server-side development gate for the local editor.
 *
 * The dynamic import matters: a production layout renders `null` without
 * pulling the editor request code into the public client layout chunk. The
 * client component still performs its own exact-hostname check because a
 * development server can also be reached through 127.0.0.1 or the LAN.
 */
export default async function DevToolsSlot() {
  if (process.env.NODE_ENV !== "development") return null;
  const { default: DevTools } = await import("@/components/DevTools");
  return <DevTools />;
}
