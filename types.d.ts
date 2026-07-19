import "react";

// `credentialless` (iframe fresh-storage attribute) isn't in React's built-in
// DOM types yet — declare it so the Apple Music embed type-checks.
declare module "react" {
  interface IframeHTMLAttributes<T> extends HTMLAttributes<T> {
    credentialless?: boolean | "";
  }
}
