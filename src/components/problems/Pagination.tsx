import Link from 'next/link';
import type { Page } from '@/lib/problem-query';

/**
 * Numbered pagination as links, so a page is a URL and the crawler can reach every problem.
 * `rel="prev"`/`rel="next"` are set because that is what tells a browser and a crawler these
 * are one sequence rather than five unrelated pages.
 */
export function Pagination({
  page,
  href,
  label = 'Problems',
}: {
  page: Page<unknown>;
  href: (page: number) => string;
  label?: string;
}) {
  if (page.pageCount <= 1) return null;

  const numbers = Array.from({ length: page.pageCount }, (_, index) => index + 1).filter(
    (number) => number === 1 || number === page.pageCount || Math.abs(number - page.page) <= 1,
  );

  const item =
    'inline-flex min-w-9 items-center justify-center rounded-sm border px-2.5 py-1.5 text-sm no-underline';

  return (
    <nav aria-label={`${label} pagination`} className="mt-8 flex flex-wrap items-center gap-2">
      {page.page > 1 ? (
        <Link href={href(page.page - 1)} rel="prev" className={`${item} border-rule text-ink-2`}>
          Previous
        </Link>
      ) : null}

      <ul className="m-0 flex list-none items-center gap-1 p-0">
        {numbers.map((number, index) => {
          const previous = numbers[index - 1];
          const gap = previous !== undefined && number - previous > 1;
          return (
            <li key={number} className="flex items-center gap-1">
              {gap ? (
                <span aria-hidden="true" className="px-1 text-ink-3">
                  …
                </span>
              ) : null}
              <Link
                href={href(number)}
                aria-current={number === page.page ? 'page' : undefined}
                aria-label={`Page ${number}`}
                className={[
                  item,
                  number === page.page
                    ? 'border-accent bg-accent-soft font-medium text-ink'
                    : 'border-rule text-ink-2 hover:border-rule-2',
                ].join(' ')}
              >
                {number}
              </Link>
            </li>
          );
        })}
      </ul>

      {page.page < page.pageCount ? (
        <Link href={href(page.page + 1)} rel="next" className={`${item} border-rule text-ink-2`}>
          Next
        </Link>
      ) : null}

      <p className="m-0 ml-auto text-xs text-ink-3">
        Showing {page.from}–{page.to} of {page.total}
      </p>
    </nav>
  );
}
