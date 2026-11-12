import { useState, useEffect } from "react";
import { SOCKET_EVENTS, useSocket } from "../../hooks/useSocket";

interface ActivityItem {
  id: string;
  category: "INCIDENT" | "RESOURCE" | "ASSIGNMENT";
  action: string;
  title: string;
  detail?: string;
  timestamp: string;
  severity?: string;
  status?: string;
}

export const LiveActivityFeed = () => {
  const { isConnected, onEvent } = useSocket();
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const addActivity = (item: Omit<ActivityItem, "id" | "timestamp">) => {
      const newActivity: ActivityItem = {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
      setActivities((prev) => [newActivity, ...prev].slice(0, 20)); // keep last 20 events
    };

    const unsubscribers = [
      onEvent(SOCKET_EVENTS.INCIDENT_CREATED, (data: any) => {
        addActivity({
          category: "INCIDENT",
          action: "CREATED",
          title: data?.title || "New Incident",
          detail: `Severity: ${data?.severity || "HIGH"} • Category: ${data?.category || "OTHER"}`,
          severity: data?.severity,
          status: data?.status,
        });
      }),
      onEvent(SOCKET_EVENTS.INCIDENT_UPDATED, (data: any) => {
        addActivity({
          category: "INCIDENT",
          action: "UPDATED",
          title: data?.title || "Incident Updated",
          detail: `Status: ${data?.status || "ACTIVE"}`,
          severity: data?.severity,
          status: data?.status,
        });
      }),
      onEvent(SOCKET_EVENTS.INCIDENT_STATUS_CHANGED, (data: any) => {
        addActivity({
          category: "INCIDENT",
          action: "STATUS CHANGED",
          title: data?.title || "Incident Status Change",
          detail: `New Status: ${data?.status} (Was: ${data?.previousStatus || "N/A"})`,
          severity: data?.severity,
          status: data?.status,
        });
      }),
      onEvent(SOCKET_EVENTS.INCIDENT_ASSIGNED, (data: any) => {
        addActivity({
          category: "INCIDENT",
          action: "ASSIGNED",
          title: data?.title || "Incident Assigned",
          detail: `Assigned unit/responder`,
          severity: data?.severity,
        });
      }),
      onEvent(SOCKET_EVENTS.RESOURCE_CREATED, (data: any) => {
        addActivity({
          category: "RESOURCE",
          action: "CREATED",
          title: data?.name || "Resource Added",
          detail: `Type: ${data?.type || "Unit"} • Status: ${data?.status || "AVAILABLE"}`,
        });
      }),
      onEvent(SOCKET_EVENTS.RESOURCE_STATUS_CHANGED, (data: any) => {
        addActivity({
          category: "RESOURCE",
          action: "STATUS CHANGED",
          title: data?.name || "Resource Status Change",
          detail: `Status: ${data?.status} (Was: ${data?.previousStatus || "N/A"})`,
        });
      }),
      onEvent(SOCKET_EVENTS.ASSIGNMENT_CREATED, () => {
        addActivity({
          category: "ASSIGNMENT",
          action: "DISPATCHED",
          title: "New Task Assignment",
          detail: `Mission dispatch initiated`,
        });
      }),
      onEvent(SOCKET_EVENTS.ASSIGNMENT_STATUS_CHANGED, (data: any) => {
        addActivity({
          category: "ASSIGNMENT",
          action: "STATUS CHANGED",
          title: "Assignment Status Update",
          detail: `Status: ${data?.status || "ACTIVE"}`,
        });
      }),
    ];

    return () => unsubscribers.forEach((off) => off());
  }, [onEvent]);

  return (
    <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5 shadow-glass space-y-4 font-mono">
      <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-safe-green animate-pulse" : "bg-alert-red"}`} />
          <h2 className="text-xs uppercase tracking-widest text-white font-bold">
            Live Telemetry Activity Feed
          </h2>
        </div>
        <span className="text-[10px] text-[#94A3B8]">
          {isConnected ? "STREAM ACTIVE" : "DISCONNECTED"}
        </span>
      </div>

      <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar text-xs" aria-live="polite" aria-atomic="false">
        {activities.length === 0 ? (
          <div className="rounded-lg bg-[#151E2D] p-6 text-center text-[#94A3B8] border border-[#1F2937]">
            <p className="font-bold text-white mb-1">Awaiting Live Telemetry Events...</p>
            <p className="text-[11px]">Real-time operational updates (incidents, dispatches, fleet changes) will appear here instantly.</p>
          </div>
        ) : (
          activities.map((item) => (
            <div
              key={item.id}
              className="rounded-lg bg-[#151E2D] p-3 border border-[#1F2937] flex flex-col gap-1 transition-all hover:border-[#00F0FF]/30"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      item.category === "INCIDENT"
                        ? "bg-[#FF3366]"
                        : item.category === "RESOURCE"
                        ? "bg-[#10B981]"
                        : "bg-[#00F0FF]"
                    }`}
                  />
                  <span className="text-white">{item.title}</span>
                </span>
                <span className="text-[10px] text-[#94A3B8]">{item.timestamp}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                <span>{item.detail || item.action}</span>
                <span className="px-1.5 py-0.2 rounded bg-[#070D1A] text-white text-[10px] border border-[#1F2937]">
                  {item.category}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LiveActivityFeed;
