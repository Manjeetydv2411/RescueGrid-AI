import Button from "./Button";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  /** Number of items shown per page. */
  limit?: number;
  onPageChange: (page: number) => void;
  /** Changing the page size resets to page 1. */
  onLimitChange?: (limit: number) => void;
  pageSizeOptions?: number[];
  /** Noun describing the records, e.g. "incidents". */
  itemLabel?: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Pagination control with page-size selection.
 *
 * The visible range is computed from the total so the user always knows how
 * many records they are looking at.
 */
const Pagination = ({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  itemLabel = "records",
}: PaginationProps) => {
  if (total === 0) return null;

  const safeTotalPages = Math.max(totalPages, 1);
  const firstRecord = (page - 1) * (limit ?? 20) + 1;
  const lastRecord = Math.min(page * (limit ?? 20), total);

  // Build a compact page list: 1 … 4 5 [6] 7 8 … 12
  const pages: (number | "gap")[] = [];
  const window = 1;
  for (let p = 1; p <= safeTotalPages; p += 1) {
    if (
      p === 1 ||
      p === safeTotalPages ||
      (p >= page - window && p <= page + window)
    ) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "gap") {
      pages.push("gap");
    }
  }

  return (
    <nav
      className="flex flex-col gap-3 border-t border-platinum-200 pt-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Pagination"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-platinum-800">
        <p aria-live="polite">
          Showing <span className="font-medium text-platinum-900">{firstRecord}</span>–
          <span className="font-medium text-platinum-900">{lastRecord}</span> of{" "}
          <span className="font-medium text-platinum-900">{total}</span>{" "}
          {itemLabel}
        </p>
        {onLimitChange && (
          <label className="flex items-center gap-2 text-sm text-platinum-800">
            <span>Per page</span>
            <select
              value={limit ?? 20}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="rounded-md border border-platinum-300 bg-tactical-800 px-2 py-1 text-sm text-platinum-900 focus:outline-none focus:ring-2 focus:ring-mocha-500"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {safeTotalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Go to previous page"
          >
            Previous
          </Button>

          <ul className="flex items-center gap-1">
            {pages.map((entry, index) =>
              entry === "gap" ? (
                <li
                  key={`gap-${index}`}
                  className="px-1 text-sm text-platinum-700"
                  aria-hidden="true"
                >
                  …
                </li>
              ) : (
                <li key={entry}>
                  <button
                    type="button"
                    onClick={() => onPageChange(entry)}
                    aria-current={entry === page ? "page" : undefined}
                    aria-label={`Go to page ${entry}`}
                    className={`min-w-[2rem] rounded-md px-2 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mocha-500 ${
                      entry === page
                        ? "bg-blue-600 text-white"
                        : "text-platinum-700 hover:bg-platinum-100"
                    }`}
                  >
                    {entry}
                  </button>
                </li>
              )
            )}
          </ul>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= safeTotalPages}
            aria-label="Go to next page"
          >
            Next
          </Button>
        </div>
      )}
    </nav>
  );
};

export default Pagination;
