import "react";

/**
 * Adds the `credentialless` iframe attribute to React's JSX types (not yet in
 * @types/react as of React 19). A credentialless iframe loads its document in a
 * fresh, ephemeral storage partition on every load — so a cross-origin embed
 * (e.g. Apple Music) can't read cookies/localStorage from earlier visits.
 * Chromium-only; harmlessly ignored elsewhere. See docs/DECISIONS.md #10.
 */
declare module "react" {
  interface IframeHTMLAttributes<T> {
    credentialless?: boolean;
  }
}
