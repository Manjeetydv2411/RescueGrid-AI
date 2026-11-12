interface LoadingProps {
  size?: "sm" | "md" | "lg";
  message?: string;
  fullScreen?: boolean;
  /** Renders a skeleton block instead of a spinner. */
  className?: string;
}

const SIZES = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-2",
};

/** Busy indicator for tactical data loads. */
const Loading = ({
  size = "md",
  message,
  fullScreen = false,
  className = "",
}: LoadingProps) => {
  const spinner = (
    <div
      aria-hidden="true"
      className={`animate-spin rounded-full border-cyber-cyan border-t-transparent shadow-neon-cyan ${SIZES[size]}`}
    />
  );

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-tactical-950/90 backdrop-blur-md"
        role="status"
        aria-live="polite"
        aria-label={message || "Loading"}
      >
        {spinner}
        {message && <p className="mt-4 text-sm font-mono text-cyber-cyan">{message}</p>}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center gap-3 py-10 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={message || "Loading"}
    >
      {spinner}
      {message && <span className="text-sm font-mono text-platinum-700">{message}</span>}
    </div>
  );
};

export default Loading;
