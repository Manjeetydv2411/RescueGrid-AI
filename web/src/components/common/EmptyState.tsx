import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Shown when a query succeeds but returns no records.
 * Distinct from <ErrorState>, which covers a failed request.
 */
const EmptyState = ({
  title,
  description,
  icon,
  action,
  className = "",
}: EmptyStateProps) => {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-platinum-300 bg-platinum-50 px-6 py-12 text-center ${className}`}
    >
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-platinum-200 text-platinum-700">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-platinum-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-platinum-700">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;
