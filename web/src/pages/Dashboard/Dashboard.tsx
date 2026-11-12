import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { statsApi } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { SOCKET_EVENTS, useSocket } from "../../hooks/useSocket";
import TacticalMap from "../../components/dashboard/TacticalMap";
import EmergencyActionPanel from "../../components/dashboard/EmergencyActionPanel";
import IncidentStatusPanel from "../../components/dashboard/IncidentStatusPanel";
import FleetStatusPanel from "../../components/dashboard/FleetStatusPanel";
import LiveActivityFeed from "../../components/dashboard/LiveActivityFeed";
import QueryState from "../../components/common/QueryState";

const Dashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { onEvent } = useSocket();

  const statsQuery = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => statsApi.dashboard(),
    refetchInterval: 60_000,
    // Only fetch when the user is on the dashboard (not a responder redirect)
    enabled: user?.role !== "RESPONDER",
  });

  useEffect(() => {
    // Responders are redirected; don't register subscriptions for them.
    if (user?.role === "RESPONDER") return;

    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    };
    const unsubscribers = [
      onEvent(SOCKET_EVENTS.INCIDENT_CREATED, refresh),
      onEvent(SOCKET_EVENTS.INCIDENT_UPDATED, refresh),
      onEvent(SOCKET_EVENTS.INCIDENT_STATUS_CHANGED, refresh),
      onEvent(SOCKET_EVENTS.INCIDENT_ASSIGNED, refresh),
      onEvent(SOCKET_EVENTS.INCIDENT_UNASSIGNED, refresh),
      onEvent(SOCKET_EVENTS.RESOURCE_CREATED, refresh),
      onEvent(SOCKET_EVENTS.RESOURCE_UPDATED, refresh),
      onEvent(SOCKET_EVENTS.RESOURCE_STATUS_CHANGED, refresh),
      onEvent(SOCKET_EVENTS.ASSIGNMENT_CREATED, refresh),
      onEvent(SOCKET_EVENTS.ASSIGNMENT_UPDATED, refresh),
      onEvent(SOCKET_EVENTS.ASSIGNMENT_STATUS_CHANGED, refresh),
      onEvent(SOCKET_EVENTS.ASSIGNMENT_CANCELLED, refresh),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, [onEvent, queryClient, user?.role]);

  if (user?.role === "RESPONDER") {
    return <Navigate to="/assignments" replace />;
  }

  const stats = statsQuery.data;
  const generatedAt = stats?.generatedAt
    ? new Date(stats.generatedAt).toLocaleString()
    : null;

  return (
    <div className="space-y-6 bg-[#0B0F19] min-h-screen text-platinum-800 pb-12">
      {/* Tactical Header bar */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end border-b border-[#1F2937] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#00F0FF] animate-pulse" />
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[#00F0FF]">
              COMMAND CENTER // TACTICAL OVERVIEW
            </p>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white font-mono">
            OPERATIONS COMMAND HUD
          </h1>
          <p className="mt-0.5 text-sm text-[#94A3B8]">
            Real-time telemetry, active incident streams, and tactical unit coordination.
          </p>
        </div>
        {generatedAt && (
          <p className="font-mono text-xs text-[#94A3B8]">
            TELEMETRY SYNC:{" "}
            <span className="text-[#00F0FF] font-semibold">{generatedAt}</span>
          </p>
        )}
      </div>

      <QueryState
        isLoading={statsQuery.isLoading}
        isError={statsQuery.isError}
        error={statsQuery.error}
        onRetry={() => void statsQuery.refetch()}
        loadingMessage="Establishing tactical telemetry feed…"
        errorTitle="Unable to load operational metrics"
      >
        {stats && (
          <div className="space-y-6">
            {/* Statistics Strip */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 shadow-glass">
                <p className="font-mono text-xs uppercase tracking-wider text-[#94A3B8]">Open Incidents</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold font-mono text-[#FF3366]">{stats.incidents.openTotal}</span>
                  <span className="font-mono text-xs text-[#94A3B8]">{stats.incidents.total} total</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#1F2937] pt-2">
                  <span className="text-xs text-[#94A3B8]">Requires attention</span>
                  <Link to="/incidents" className="font-mono text-xs font-semibold text-[#00F0FF] hover:underline">
                    View →
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 shadow-glass">
                <p className="font-mono text-xs uppercase tracking-wider text-[#94A3B8]">Unassigned SOS</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold font-mono text-[#FF9900]">{stats.incidents.unassignedTotal}</span>
                  <span className="font-mono text-xs text-[#94A3B8]">Pending units</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#1F2937] pt-2">
                  <span className="text-xs text-[#94A3B8]">Needs dispatch</span>
                  <Link to="/incidents?status=ACTIVE" className="font-mono text-xs font-semibold text-[#FF9900] hover:underline">
                    Review →
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 shadow-glass">
                <p className="font-mono text-xs uppercase tracking-wider text-[#94A3B8]">Fleet Available</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold font-mono text-[#10B981]">{stats.resources.byStatus.AVAILABLE ?? 0}</span>
                  <span className="font-mono text-xs text-[#94A3B8]">{stats.resources.total} total</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#1F2937] pt-2">
                  <span className="text-xs text-[#94A3B8]">Ready for mission</span>
                  <Link to="/resources?status=AVAILABLE" className="font-mono text-xs font-semibold text-[#10B981] hover:underline">
                    Inventory →
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 shadow-glass">
                <p className="font-mono text-xs uppercase tracking-wider text-[#94A3B8]">Active Dispatches</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold font-mono text-[#00F0FF]">{stats.assignments.pendingTotal}</span>
                  <span className="font-mono text-xs text-[#94A3B8]">{stats.assignments.activeTotal} underway</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#1F2937] pt-2">
                  <span className="text-xs text-[#94A3B8]">Operational</span>
                  <Link to="/assignments?status=PENDING" className="font-mono text-xs font-semibold text-[#00F0FF] hover:underline">
                    Dispatches →
                  </Link>
                </div>
              </div>
            </div>

            {/* Responsive Two-Column Command-Center Layout (70% Main, 30% Sidebar) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
              {/* Main Operational Area (approx 70% -> lg:col-span-7) */}
              <div className="lg:col-span-7 space-y-6">
                {/* Central Tactical Map Container */}
                <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5 shadow-glass">
                  <div className="flex items-center justify-between border-b border-[#1F2937] pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#00F0FF]" />
                      <h2 className="font-mono text-xs uppercase tracking-widest text-white font-bold">
                        Central Tactical Map & Geo-Telemetry
                      </h2>
                    </div>
                    <Link
                      to="/map"
                      className="font-mono text-xs text-[#00F0FF] hover:underline font-semibold"
                    >
                      Expand Map View ↗
                    </Link>
                  </div>
                  <div className="mt-2">
                    <TacticalMap />
                  </div>
                </div>

                {/* Live Activity Feed Container */}
                <LiveActivityFeed />
              </div>

              {/* Right Operational Sidebar (approx 30% -> lg:col-span-3) */}
              <div className="lg:col-span-3 space-y-6">
                <EmergencyActionPanel />
                <IncidentStatusPanel stats={stats} />
                <FleetStatusPanel stats={stats} />
              </div>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
};

export default Dashboard;
