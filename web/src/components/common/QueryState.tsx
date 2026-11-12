import type { ReactNode } from "react";

import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import Loading from "./Loading";
import { getErrorMessage } from "../../services/api";

interface QueryStateProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  /** True when the request succeeded but returned no records. */
  isEmpty?: boolean;
  onRetry?: () => void;
  loadingMessage?: string;
  errorTitle?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  children: ReactNode;
}

/**
 * Renders the correct state for a data query.
 *
 * Keeps loading, empty, and error handling consistent across every page and
 * removes the duplicated branching from each screen.
 */
const QueryState = ({
  isLoading,
  isError,
  error,
  isEmpty = false,
  onRetry,
  loadingMessage = "Loading…",
  errorTitle = "Unable to load data",
  emptyTitle = "No records found",
  emptyDescription,
  emptyIcon,
  emptyAction,
  children,
}: QueryStateProps) => {
  if (isLoading) {
    return <Loading message={loadingMessage} />;
  }

  if (isError) {
    return (
      <ErrorState
        title={errorTitle}
        message={getErrorMessage(error)}
        onRetry={onRetry}
      />
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={emptyIcon}
        action={emptyAction}
      />
    );
  }

  return <>{children}</>;
};

export default QueryState;
