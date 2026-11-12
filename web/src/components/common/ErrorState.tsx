import type { ReactNode } from "react";

import Button from "./Button";

interface ErrorStateProps {
  title?: string;
  /** The underlying failure message, shown verbatim to the user. */
  message?: string;
  action?: ReactNode;
  onRetry?: () => void;
  className?: string;
}

/**
 * Shown when a request fails.
 *
 * Always renders a retry affordance when `onRetry` is provided so the user is
 * never left with a dead end.
 */
const ErrorState = ({
  title = "Unable to load data",
  message,
  action,
  onRetry,
  className = "",
}: ErrorStateProps) => {
  return (
    <div
      role="alert"
      className={`rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center sm:px-6 ${className}`}
    >
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-alert-red">
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-alert-red">{title}</h3>
      {message && <p className="mt-1 text-sm text-alert-red">{message}</p>}
      <div className="mt-4 flex justify-center gap-2">
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
        {action}
      </div>
    </div>
  );
};

export default ErrorState;
