import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vault markdown is read from the filesystem at build time only.
  // Assets (images etc.) are copied to public/vault-assets by scripts/sync-assets.mjs
  // via the prebuild/predev hooks, so no runtime filesystem access is needed.
};

export default nextConfig;
