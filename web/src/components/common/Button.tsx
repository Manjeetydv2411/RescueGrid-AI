import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  icon?: ReactNode;
  /** Renders a block-level button that fills its container. */
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/50 hover:bg-cyber-cyan/25 hover:border-cyber-cyan hover:shadow-neon-cyan focus-visible:ring-cyber-cyan",
  secondary:
    "bg-tactical-800/80 text-platinum-800 border border-cyber-cyan/20 hover:bg-tactical-700/80 hover:text-white hover:border-cyber-cyan/50 focus-visible:ring-cyber-cyan",
  danger:
    "bg-alert-red/15 text-alert-red border border-alert-red/50 hover:bg-alert-red/25 hover:border-alert-red hover:shadow-neon-red focus-visible:ring-alert-red",
  ghost:
    "text-platinum-700 hover:bg-tactical-800 hover:text-cyber-cyan focus-visible:ring-cyber-cyan",
  success:
    "bg-safe-green/15 text-safe-green border border-safe-green/50 hover:bg-safe-green/25 hover:border-safe-green hover:shadow-neon-green focus-visible:ring-safe-green",
};

const SIZES: Record<Size, string> = {
  sm: "px-2.5 py-1 text-xs font-mono gap-1.5",
  md: "px-4 py-2 text-sm font-medium gap-2",
  lg: "px-5 py-2.5 text-base font-semibold gap-2.5",
};

const Spinner = () => (
  <span
    aria-hidden="true"
    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
  />
);

/** Shared class list, so a link and a button look identical. */
const buttonClasses = (
  variant: Variant,
  size: Size,
  fullWidth: boolean,
  className: string
) =>
  `inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-tactical-950 disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? "w-full" : ""} ${className}`;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      type = "button",
      className = "",
      icon,
      fullWidth = false,
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={buttonClasses(variant, size, fullWidth, className)}
        {...rest}
      >
        {isLoading ? <Spinner /> : icon ? <span aria-hidden="true">{icon}</span> : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

interface ButtonLinkProps extends Omit<LinkProps, "className"> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
}

const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      icon,
      fullWidth = false,
      className = "",
      ...rest
    },
    ref
  ) => {
    return (
      <Link
        ref={ref}
        className={buttonClasses(variant, size, fullWidth, className)}
        {...rest}
      >
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        {children}
      </Link>
    );
  }
);

ButtonLink.displayName = "ButtonLink";

export { ButtonLink };
export default Button;
