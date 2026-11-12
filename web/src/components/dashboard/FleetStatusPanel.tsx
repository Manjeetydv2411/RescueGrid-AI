import { Link } from "react-router-dom";
import { RESOURCE_STATUSES, getResourceStatusMeta } from "../../utils/domain";
import type { DashboardStats, ResourceStatus } from "../../types/api";

interface FleetStatusPanelProps {
  stats?: DashboardStats;
}

export const FleetStatusPanel = ({ stats }: FleetStatusPanelProps) => {
  const byStatus: Record<ResourceStatus, number> = stats?.resources.byStatus || ({} as Record<ResourceStatus, number>);
  const total = stats?.resources.total || 0;

  return (
    <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5 shadow-glass space-y-3 font-mono">
      <div className="flex items-center justify-between border-b border-[#1F2937] pb-3 mb-2">
        <h2 className="text-xs uppercase tracking-widest text-white font-bold">
          Fleet Operational Status
        </h2>
        <Link to="/resources" className="text-xs text-[#00F0FF] hover:underline font-semibold">
          Inventory →
        </Link>
      </div>

      <div className="space-y-2.5 text-xs">
        {RESOURCE_STATUSES.map((status) => {
          const count = byStatus[status] ?? 0;
          const meta = getResourceStatusMeta(status);
          const percent = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <div key={status} className="rounded-lg bg-[#151E2D] p-2.5 border border-[#1F2937]">
              <div className="flex items-center justify-between text-white mb-1">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {meta.label}
                </span>
                <span className="font-bold text-emerald-400">
                  {count} <span className="text-[10px] text-[#94A3B8] font-normal">({percent}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#070D1A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-[#10B981]"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FleetStatusPanel;
