import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  /** Rendered on the right of the header row. */
  action?: ReactNode;
  /** Removes the default body padding, for flush content such as tables. */
  flush?: boolean;
  /** Small explanatory text under the title. */
  description?: ReactNode;
  as?: "div" | "section" | "article";
}

const Card = ({
  children,
  className = "",
  title,
  action,
  flush = false,
  description,
  as: Tag = "div",
}: CardProps) => {
  return (
    <Tag className={`relative rounded-xl border border-cyber-cyan/15 bg-tactical-900/75 backdrop-blur-md shadow-glass text-platinum-900 overflow-hidden ${className}`}>
      {/* Corner telemetry accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyber-cyan/30 to-transparent" />

      {(title || action || description) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyber-cyan/15 px-4 py-3 sm:px-5 bg-tactical-950/40">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-bold tracking-wide uppercase text-white flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyber-cyan" />
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs font-mono text-platinum-700">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-4 sm:p-5"}>{children}</div>
    </Tag>
  );
};

export default Card;
