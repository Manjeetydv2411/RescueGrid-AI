import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Cell renderer. */
  render: (row: T) => ReactNode;
  /** Extra classes on the cell. */
  className?: string;
  headerClassName?: string;
  /** Hide the column below the given breakpoint to keep mobile tables readable. */
  hideBelow?: "sm" | "md" | "lg";
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption?: string;
  /** Row click handler; omit to make rows non-interactive. */
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

const HIDE_CLASSES = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

/** Responsive tactical data table. */
const Table = <T,>({
  columns,
  rows,
  rowKey,
  caption,
  onRowClick,
  emptyMessage = "No records found.",
  className = "",
}: TableProps<T>) => {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm font-mono text-platinum-700">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className={`min-w-full divide-y divide-cyber-cyan/10 text-left text-sm ${className}`}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-tactical-950/70">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-platinum-700 ${column.headerClassName ?? ""} ${
                  column.hideBelow ? HIDE_CLASSES[column.hideBelow] : ""
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-cyber-cyan/10 bg-tactical-900/50">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? "cursor-pointer transition-colors hover:bg-cyber-cyan/5" : ""}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-4 py-3 text-platinum-700 ${column.className ?? ""} ${
                    column.hideBelow ? HIDE_CLASSES[column.hideBelow] : ""
                  }`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
