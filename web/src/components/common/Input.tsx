import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  /** Rendered under the field as helper text (e.g. a format hint). */
  hint?: string;
  /** Marks the field as required for assistive technology. */
  required?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, icon, hint, className = "", required, id, ...props },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const describedBy =
      [error ? errorId : null, hint ? hintId : null]
        .filter(Boolean)
        .join(" ") || undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
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
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-platinum-600">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={[
              "block w-full rounded-lg border bg-tactical-800 px-3 py-2 text-sm text-white shadow-sm placeholder:text-platinum-600",
              "focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-offset-tactical-950",
              "disabled:cursor-not-allowed disabled:bg-tactical-700 disabled:text-platinum-600",
              icon ? "pl-10" : "",
              error
                ? "border-alert-red/60 focus:border-alert-red focus:ring-alert-red"
                : "border-cyber-cyan/20 focus:border-cyber-cyan focus:ring-cyber-cyan",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            {...props}
          />
        </div>
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

Input.displayName = "Input";

export default Input;
