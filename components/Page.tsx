import type { ComponentProps } from "react";

/**
 * The page shell: measure, gutters and vertical rhythm, in one place.
 *
 * This markup used to be `mx-auto max-w-2xl px-6 py-14 lg:py-24` written out
 * in seven route files. Nothing was wrong with any single copy — the problem
 * was that "how wide is this site" and "how much air does a page start with"
 * weren't decisions anyone could make. Changing either meant a find-and-replace
 * across `app/`, with two of the seven already quietly disagreeing (`py-20`
 * and `py-24`).
 *
 * The values live in `globals.css` as `--measure`, `--gutter` and `--page-y`,
 * so the shell can be retuned from three lines and every page follows.
 *
 * Extra props pass through to the element — the entry page hangs its
 * `data-vault-source` attributes here for the Cmd+K "open on GitHub" action.
 */
export default function Page({ className = "", ...rest }: ComponentProps<"div">) {
  return <div {...rest} className={`page ${className}`.trim()} />;
}
