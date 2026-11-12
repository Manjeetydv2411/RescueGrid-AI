import { Link } from "react-router-dom";
import { INCIDENT_STATUSES, getIncidentStatusMeta } from "../../utils/domain";
import type { DashboardStats, IncidentStatus } from "../../types/api";

interface IncidentStatusPanelProps {
  stats?: DashboardStats;
}

export const IncidentStatusPanel = ({ stats }: IncidentStatusPanelProps) => {
  const byStatus: Record<IncidentStatus, number> = stats?.incidents.byStatus || ({} as Record<IncidentStatus, number>);
  const total = stats?.incidents.total || 0;

  return (
    <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5 shadow-glass space-y-3 font-mono">
      <div className="flex items-center justify-between border-b border-[#1F2937] pb-3 mb-2">
        <h2 className="text-xs uppercase tracking-widest text-white font-bold">
          Incident Status Telemetry
        </h2>
        <Link to="/incidents" className="text-xs text-[#00F0FF] hover:underline font-semibold">
          View All →
        </Link>
      </div>

      <div className="space-y-2.5 text-xs">
        {INCIDENT_STATUSES.map((status) => {
          const count = byStatus[status] ?? 0;
          const meta = getIncidentStatusMeta(status);
          const percent = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <div key={status} className="rounded-lg bg-[#151E2D] p-2.5 border border-[#1F2937]">
              <div className="flex items-center justify-between text-white mb-1">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00F0FF]" />
                  {meta.label}
                </span>
                <span className="font-bold text-[#00F0FF]">
                  {count} <span className="text-[10px] text-[#94A3B8] font-normal">({percent}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#070D1A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-[#00F0FF]"
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

export default IncidentStatusPanel;
