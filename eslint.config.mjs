// ESLint flat config for `npm run lint` (`eslint .`). `next lint` is deprecated
// in Next 15.5 and removed in 16, so the ESLint CLI is used directly with
// Next's own shareable configs. Advisory until the baseline is clean — see
// docs/VERIFY.md.
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "node_modules/**", "public/**", "vault/**", "_to_delete/**", "next-env.d.ts"] },
];

export default config;
