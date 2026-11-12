import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import BroadcastAlertModal from "../BroadcastAlertModal";

export const EmergencyActionPanel = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const canManage = hasRole("ADMIN", "COORDINATOR");

  return (
    <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5 shadow-glass space-y-3 font-mono">
      <div className="border-b border-[#1F2937] pb-3 mb-2 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-white font-bold">
          Emergency Action Panel
        </h2>
        <span className="text-[10px] text-[#00F0FF] bg-[#00F0FF]/10 px-2 py-0.5 rounded border border-[#00F0FF]/30">
          ROLE: {user?.role || "USER"}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setBroadcastOpen(true)}
        className="w-full flex items-center justify-between rounded-lg border border-[#FF3366]/40 bg-[#FF3366]/15 p-3 text-left text-xs font-bold text-[#FF3366] hover:bg-[#FF3366]/25 transition-colors shadow-neon-red"
      >
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#FF3366] animate-ping" />
          Dispatch Broadcast Alert
        </span>
        <span>🚨</span>
      </button>

      {canManage && (
        <button
          type="button"
          onClick={() => navigate("/incidents/new")}
          className="w-full flex items-center justify-between rounded-lg border border-[#00F0FF]/40 bg-[#00F0FF]/15 p-3 text-left text-xs font-bold text-[#00F0FF] hover:bg-[#00F0FF]/25 transition-colors"
        >
          <span>+ Report Emergency Incident</span>
          <span>⚡</span>
        </button>
      )}

      <Link
        to="/resources"
        className="block w-full rounded-lg border border-[#1F2937] bg-[#151E2D] p-3 text-center text-xs font-bold text-white hover:border-[#00F0FF]/40 transition-colors"
      >
        Manage Fleet Inventory ↗
      </Link>

      <BroadcastAlertModal
        isOpen={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
      />
    </div>
  );
};

export default EmergencyActionPanel;
