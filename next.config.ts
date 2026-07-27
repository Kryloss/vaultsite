import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vault markdown is read from the filesystem at build time only.
  // Assets (images etc.) are copied to public/vault-assets by scripts/sync-assets.mjs
  // via the prebuild/predev hooks, so no runtime filesystem access is needed.

  // /resume is a memorable alias for the résumé block on the Now page (it's
  // not its own section — see docs/DECISIONS.md #25). Resolved from the
  // build-time routes manifest, same as everything else on this static site;
  // no server or middleware involved.
  async redirects() {
    return [{ source: "/resume", destination: "/now", permanent: true }];
  },
};

export default nextConfig;
