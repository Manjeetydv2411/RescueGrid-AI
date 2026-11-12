import {
  forwardRef,
  useId,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Option elements. */
  children: ReactNode;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, required, className = "", id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const errorId = `${selectId}-error`;
    const hintId = `${selectId}-hint`;

    const describedBy =
      [error ? errorId : null, hint ? hintId : null]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1 block text-xs font-mono font-bold uppercase tracking-wider text-platinum-700"
          >
            {label}
            {required && (
              <span className="ml-0.5 text-alert-red" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          style={{ colorScheme: "dark" }}
          className={[
            "block w-full rounded-lg border bg-tactical-800 px-3 py-2 text-sm text-white shadow-sm",
            "focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-offset-tactical-950",
            "disabled:cursor-not-allowed disabled:bg-tactical-700 disabled:text-platinum-600",
            error
              ? "border-alert-red/60 focus:border-alert-red focus:ring-alert-red"
              : "border-cyber-cyan/20 focus:border-cyber-cyan focus:ring-cyber-cyan",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        >
          {children}
        </select>
        {hint && !error && (
          <p id={hintId} className="mt-1 text-xs text-platinum-700">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-alert-red">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export default Select;
