import Link from "next/link";
import T from "@/components/T";
import type { BookQuotes } from "@/lib/quotes";

/**
 * The Quotes category on the books medium page.
 *
 * A cover grid would be wrong here — the passage is the content, not the book,
 * so this is a reading column: quotes at prose size, grouped under the book
 * they came from, with the book title linking back to its note.
 */
export default function QuotesView({
  sectionSlug,
  books,
}: {
  sectionSlug: string;
  books: BookQuotes[];
}) {
  /* No message when there are none (#206): it was an instruction to the
     author, shown to readers. */
  if (books.length === 0) return null;

  return (
    <div className="mt-8 flex flex-col gap-10">
      {books.map((book) => (
        <section key={book.slug}>
          <h2 className="quote-source">
            <Link href={`/${sectionSlug}/${book.slug}`}>
              <T en={book.title} uk={book.titleUk} />
            </Link>
            {book.author && (
              <span className="quote-author">
                <T en={book.author} uk={book.authorUk} />
              </span>
            )}
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {book.quotes.map((q, i) => (
              <blockquote key={i} className="pull-quote">
                <T en={q.en} uk={q.uk} />
              </blockquote>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
