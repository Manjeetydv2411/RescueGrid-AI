import { useEffect, useRef, useState } from "react";

import type { Pagination } from "../types/api";

type PageInfo = Pick<Pagination, "page" | "totalPages">;

/**
 * Keep the current page inside the range the result set actually has.
 *
 * A page number can outlive its results: a filter narrows the list, another
 * coordinator resolves incidents, or a record is deleted. The request for
 * page 5 then returns nothing, and the page would report "no records match"
 * — a false statement about the data rather than the truth, which is that
 * the user is past the end of a shorter list.
 *
 * When the page is out of range, the last available page is requested
 * instead. The correction is applied once per out-of-range page so that
 * repeated refetches do not keep pushing the URL around.
 *
 * The hook returns true while the correction is outstanding, so the caller
 * can show a loading state rather than briefly claiming that nothing
 * matches.
 *
 * The `pagination` passed in must describe the page that was actually
 * fetched — `pagination.page` is the page the server served, not the page
 * that was asked for. A list using `placeholderData` therefore keeps serving
 * the previous page's rows until the new page arrives, and the correction
 * waits for the real answer rather than acting on stale data.
 */
export const useClampPage = (
  pagination: PageInfo | undefined,
  onClamp: (page: number) => void
): boolean => {
  // The callback is usually an inline arrow function, so its identity changes
  // on every render. Holding it in a ref keeps the effect from re-running
  // each time for a new closure.
  const onClampRef = useRef(onClamp);
  onClampRef.current = onClamp;

  // The page that was already corrected, so the same correction is not
  // requested again on the next refetch.
  const clampedRef = useRef<number | null>(null);

  // The page the correction is waiting for, once it has been requested.
  const [awaitingPage, setAwaitingPage] = useState<number | null>(null);

  const servedPage = pagination?.page;
  const totalPages = pagination?.totalPages;

  // The server served a page beyond the end of the result set.
  const isOutOfRange =
    servedPage !== undefined &&
    totalPages !== undefined &&
    servedPage > Math.max(totalPages, 1);

  useEffect(() => {
    if (servedPage === undefined || totalPages === undefined) return;

    if (!isOutOfRange) {
      clampedRef.current = null;
      setAwaitingPage(null);
      return;
    }

    // An empty result set has no pages at all, so the correction is to go
    // back to the first page rather than to page 0.
    const target = totalPages === 0 ? 1 : totalPages;
    if (clampedRef.current === target) return;

    clampedRef.current = target;
    setAwaitingPage(target);
    onClampRef.current(target);
  }, [servedPage, totalPages, isOutOfRange]);

  // The corrected page has arrived: the correction is complete.
  useEffect(() => {
    if (awaitingPage === null) return;
    if (servedPage === awaitingPage) setAwaitingPage(null);
  }, [awaitingPage, servedPage]);

  return isOutOfRange || awaitingPage !== null;
};

export default useClampPage;
