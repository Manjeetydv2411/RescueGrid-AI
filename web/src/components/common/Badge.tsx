import { ReactNode } from "react";

export type BadgeTone =
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "gray"
  | "purple"
  | "orange";

interface BadgeProps {
  children: ReactNode;
  color?: BadgeTone;
  size?: "sm" | "md" | "lg";
  /** Adds a leading dot, useful for status indicators. */
  dot?: boolean;
  title?: string;
  className?: string;
}

const COLORS: Record<BadgeTone, string> = {
  blue: "bg-cyber-cyan/10 text-cyber-cyan ring-cyber-cyan/30",
  green: "bg-safe-green/10 text-safe-green ring-safe-green/30",
  yellow: "bg-warn-amber/10 text-warn-amber ring-warn-amber/30",
  red: "bg-alert-red/10 text-alert-red ring-alert-red/30",
  gray: "bg-platinum-300/10 text-platinum-800 ring-platinum-400/30",
  purple: "bg-purple-500/10 text-purple-400 ring-purple-500/30",
  orange: "bg-orange-500/10 text-orange-400 ring-orange-500/30",
};

const DOT_COLORS: Record<BadgeTone, string> = {
  blue: "bg-cyber-cyan shadow-neon-cyan",
  green: "bg-safe-green shadow-neon-green",
  yellow: "bg-warn-amber shadow-neon-amber",
  red: "bg-alert-red shadow-neon-red",
  gray: "bg-platinum-500",
  purple: "bg-purple-400",
  orange: "bg-orange-400",
};

const SIZES = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
};

const Badge = ({
  children,
  color = "blue",
  size = "md",
  dot = false,
  title,
  className = "",
}: BadgeProps) => {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full font-mono font-medium ring-1 ring-inset ${COLORS[color]} ${SIZES[size]} ${className}`}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[color]}`}
        />
      )}
      {children}
    </span>
  );
};

export default Badge;
