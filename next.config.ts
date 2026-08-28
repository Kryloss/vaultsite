import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The local authoring pencil owns the one viable corner in development.
  // Keep Next's own floating badge from sitting invisibly above it; compile
  // errors still use the ordinary development overlay.
  devIndicators: false,

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

  /** The vault editor is a loopback sidecar started by `npm run dev`. */
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const port = process.env.VAULT_EDITOR_PORT ?? "3211";
    const portNumber = Number(port);
    if (!/^\d+$/.test(port) || portNumber < 1 || portNumber > 65_535) {
      throw new Error("VAULT_EDITOR_PORT must be a valid TCP port");
    }
    return [
      {
        source: "/__vault-editor/:path*",
        destination: `http://127.0.0.1:${port}/:path*`,
      },
    ];
  },

  // Replace the editor module with a null component in production so its
  // request paths and client code never enter public chunks.
  webpack(config, { dev }) {
    if (!dev) {
      const disabled = path.resolve(process.cwd(), "components/DevToolsDisabled.tsx");
      config.resolve.alias = {
        ...config.resolve.alias,
        "@/components/DevTools$": disabled,
        [path.resolve(process.cwd(), "components/DevTools.tsx")]: disabled,
      };
    }
    return config;
  },
};

export default nextConfig;
