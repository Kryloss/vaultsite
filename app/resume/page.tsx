import type { Metadata } from "next";
import { DownloadIcon } from "@/components/icons";
import { pageMeta } from "@/lib/metadata";
import { authorName } from "@/lib/site-config";
import resume from "@/lib/resume-page.json";

/**
 * /resume — the résumé as a sheet of paper, and a button to download it.
 *
 * Nothing else: `components/BareRoute.tsx` leaves the site's chrome off this
 * address, so this page carries its own <main>. The sheets are pictures of
 * the PDF's pages, made by `scripts/make-resume-page.mjs` (why pictures and
 * not the browser's PDF viewer is in that script's header); the paper keeps
 * its own colours in dark mode, as a document would.
 *
 * Plain <img>, not a content image: nothing here should open the lightbox.
 *
 * The button is a solid near-black pill rather than the translucent chip
 * material: the owner asked for it to stand out. Its colours are literals, not
 * tokens, on purpose — it floats over the paper, which is light in both
 * appearances, so a pill that inverted with the theme would turn white on
 * cream in dark mode. The faint ring keeps its edge once it is past the sheet
 * and over the dark page.
 *
 * English only, at the owner's request (DECISIONS #200): the résumé itself is
 * an English document, so its one button does not follow the language toggle.
 */
export const metadata: Metadata = {
  title: "Résumé",
  description: `${authorName}'s résumé, with a PDF to download.`,
  ...pageMeta({ path: "/resume" }),
};

export default function ResumePage() {
  return (
    <main
      id="main"
      className="page-in flex min-h-dvh flex-col items-center gap-4 bg-[var(--surface)] px-3 pt-3 pb-28 sm:gap-6 sm:px-6 sm:pt-8 sm:pb-32"
    >
      <h1 className="sr-only">Résumé</h1>

      {resume.pages.map((page, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={page.src}
          src={page.src}
          width={page.width}
          height={page.height}
          alt={`${authorName} — résumé, page ${i + 1} of ${resume.pages.length}`}
          className="h-auto w-full max-w-[54rem] rounded-sm bg-white shadow-[0_0_0_1px_var(--border),0_12px_32px_-12px_rgb(0_0_0/0.18)]"
        />
      ))}

      <a
        href={resume.pdf}
        download
        className="press fixed inset-x-0 bottom-8 z-30 mx-auto flex h-12 w-fit items-center gap-2.5 rounded-full bg-[#09090b] px-6 text-base font-semibold text-white shadow-[0_0_0_1px_rgb(255_255_255/0.14),0_10px_30px_-8px_rgb(0_0_0/0.5)] hover:opacity-90 sm:bottom-12"
      >
        <DownloadIcon className="h-[18px] w-[18px]" />
        Download PDF
      </a>
    </main>
  );
}
