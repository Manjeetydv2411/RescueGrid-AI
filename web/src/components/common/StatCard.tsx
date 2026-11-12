import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: number | string;
  /** Short explanation of what the number represents. */
  hint?: ReactNode;
  /** Accent colour for the left edge and the value. */
  accent?: "blue" | "red" | "emerald" | "amber" | "slate" | "violet";
  icon?: ReactNode;
  /** Rendered in the top-right, typically a link to the filtered list. */
  action?: ReactNode;
  className?: string;
}

const ACCENT_STYLES = {
  blue: {
    border: "border-cyber-cyan/40 hover:border-cyber-cyan/80",
    text: "text-cyber-cyan drop-shadow-[0_0_8px_rgba(0,243,255,0.4)]",
    bg: "bg-cyber-cyan/10",
    dot: "bg-cyber-cyan shadow-neon-cyan",
    topLine: "from-cyber-cyan/60",
  },
  red: {
    border: "border-alert-red/40 hover:border-alert-red/80",
    text: "text-alert-red drop-shadow-[0_0_8px_rgba(255,0,85,0.4)]",
    bg: "bg-alert-red/10",
    dot: "bg-alert-red shadow-neon-red",
    topLine: "from-alert-red/60",
  },
  emerald: {
    border: "border-safe-green/40 hover:border-safe-green/80",
    text: "text-safe-green drop-shadow-[0_0_8px_rgba(0,255,136,0.4)]",
    bg: "bg-safe-green/10",
    dot: "bg-safe-green shadow-neon-green",
    topLine: "from-safe-green/60",
  },
  amber: {
    border: "border-warn-amber/40 hover:border-warn-amber/80",
    text: "text-warn-amber drop-shadow-[0_0_8px_rgba(255,153,0,0.4)]",
    bg: "bg-warn-amber/10",
    dot: "bg-warn-amber shadow-neon-amber",
    topLine: "from-warn-amber/60",
  },
  slate: {
    border: "border-platinum-700 hover:border-platinum-500",
    text: "text-platinum-700",
    bg: "bg-platinum-800/20",
    dot: "bg-platinum-400",
    topLine: "from-platinum-600",
  },
  violet: {
    border: "border-purple-500/40 hover:border-purple-500/80",
    text: "text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]",
    bg: "bg-purple-500/10",
    dot: "bg-purple-400",
    topLine: "from-purple-500/60",
  },
};

/**
 * A single headline metric / telemetry module.
 */
const StatCard = ({
  label,
  value,
  hint,
  accent = "blue",
  icon,
  action,
  className = "",
}: StatCardProps) => {
  const styles = ACCENT_STYLES[accent];

  return (
    <div
      className={`group relative rounded-xl border bg-tactical-900/80 backdrop-blur-md p-4 sm:p-5 shadow-glass transition-all duration-200 hover:scale-[1.01] ${styles.border} ${className}`}
    >
      {/* Top neon hairline indicator */}
      <div
        className={`absolute top-0 left-0 h-[2px] w-16 bg-gradient-to-r ${styles.topLine} to-transparent rounded-tl-xl`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-platinum-700">
              {label}
            </p>
          </div>
          <p className={`mt-2 font-mono text-3xl font-black tracking-tight ${styles.text}`}>
            {value}
          </p>
        </div>
        {icon && (
          <div className={`shrink-0 rounded-lg p-2.5 ${styles.bg} ${styles.text}`}>
            {icon}
          </div>
        )}
      </div>

      {hint && (
        <p className="mt-2.5 text-xs font-mono text-platinum-700 border-t border-platinum-800/60 pt-2">
          {hint}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
};

export default StatCard;
