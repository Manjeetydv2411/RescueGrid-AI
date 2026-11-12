import { useState, useMemo, useEffect, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { assignmentApi } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useSocket, SOCKET_EVENTS } from "../../hooks/useSocket";
import {
  ASSIGNMENT_STATUS_TRANSITIONS,
  getAssignmentStatusMeta,
} from "../../utils/domain";
import type { Assignment, AssignmentStatus } from "../../types/api";
import Button from "../../components/common/Button";
import Card from "../../components/common/Card";
import QueryState from "../../components/common/QueryState";
import Textarea from "../../components/common/Textarea";
import Select from "../../components/common/Select";
import { AssignmentStatusBadge, SeverityBadge } from "../../components/common/StatusBadge";

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:28px;line-height:30px;filter:drop-shadow(0 2px 4px rgba(0,240,255,0.6))">📍</div>',
  iconSize: [28, 30],
  iconAnchor: [14, 30],
});

function MapCenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude], Math.max(map.getZoom(), 13));
  }, [map, latitude, longitude]);
  return null;
}

export const ResponderDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { onEvent } = useSocket();

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [fieldNotes, setFieldNotes] = useState("");
  const [conditions, setConditions] = useState("Stable");
  const [rescueProgress, setRescueProgress] = useState("In progress");
  const [peopleAssisted, setPeopleAssisted] = useState("0");
  const [resourceRequests, setResourceRequests] = useState("");

  const { data: assignmentsData, isLoading, isError, error } = useQuery({
    queryKey: ["responder-assignments", user?._id],
    queryFn: () => assignmentApi.list({ responderId: user?._id }),
    enabled: Boolean(user?._id),
    refetchInterval: 15_000,
  });

  const assignments: Assignment[] = assignmentsData?.data ?? [];

  // Automatically select the first active/pending assignment if none selected
  useEffect(() => {
    if (assignments.length > 0 && !selectedAssignmentId) {
      const active = assignments.find((a) => a.status !== "COMPLETED" && a.status !== "CANCELLED") || assignments[0];
      setSelectedAssignmentId(active._id);
    }
  }, [assignments, selectedAssignmentId]);

  // Real-time socket sync
  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["responder-assignments"] });
    };
    const unsubscribers = [
      onEvent(SOCKET_EVENTS.ASSIGNMENT_CREATED, refresh),
      onEvent(SOCKET_EVENTS.ASSIGNMENT_UPDATED, refresh),
      onEvent(SOCKET_EVENTS.ASSIGNMENT_STATUS_CHANGED, refresh),
      onEvent(SOCKET_EVENTS.ASSIGNMENT_CANCELLED, refresh),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, [onEvent, queryClient]);

  const selectedAssignment = useMemo(() => {
    if (!selectedAssignmentId) return assignments[0] || null;
    return assignments.find((a) => a._id === selectedAssignmentId) || assignments[0] || null;
  }, [assignments, selectedAssignmentId]);

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: AssignmentStatus }) =>
      assignmentApi.update(id, { status: nextStatus }),
    onSuccess: (updated) => {
      toast.success(`Mission status updated to ${getAssignmentStatusMeta(updated.status).label}.`);
      void queryClient.invalidateQueries({ queryKey: ["responder-assignments"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Unable to update mission status.");
    },
  });

  const reportMutation = useMutation({
    mutationFn: async ({ id, reportText }: { id: string; reportText: string }) => {
      const existingNotes = selectedAssignment?.notes ? `${selectedAssignment.notes}\n\n---\n\n` : "";
      const fullNotes = `${existingNotes}${reportText}`;
      return assignmentApi.update(id, { notes: fullNotes });
    },
    onSuccess: () => {
      toast.success("Field report submitted successfully and synchronized with Command Center.");
      setFieldNotes("");
      setResourceRequests("");
      void queryClient.invalidateQueries({ queryKey: ["responder-assignments"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to submit field report.");
    },
  });

  const handleStatusChange = (nextStatus: AssignmentStatus) => {
    if (!selectedAssignment) return;
    statusMutation.mutate({ id: selectedAssignment._id, nextStatus });
  };

  const handleReportSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    if (!fieldNotes.trim() && !resourceRequests.trim()) {
      toast.error("Please enter field observations or resource requests before submitting.");
      return;
    }

    const timestamp = new Date().toLocaleString();
    const formattedReport = `[FIELD REPORT - ${timestamp}]\nResponder: ${user?.name || "Unit"}\nConditions: ${conditions}\nProgress: ${rescueProgress}\nPeople Assisted: ${peopleAssisted}\nObservations: ${fieldNotes.trim() || "None"}${resourceRequests.trim() ? `\nResource Requests: ${resourceRequests.trim()}` : ""}`;

    reportMutation.mutate({ id: selectedAssignment._id, reportText: formattedReport });
  };

  // Extract incident location if available
  const incidentObj = typeof selectedAssignment?.incidentId === "object" ? (selectedAssignment.incidentId as any) : null;
  const locationCoords = incidentObj?.location?.coordinates ?? [77.209, 28.6139]; // [lng, lat]
  const latitude = Number(locationCoords[1]) || 28.6139;
  const longitude = Number(locationCoords[0]) || 77.209;
  const address = incidentObj?.address || "Coordinates target location";

  return (
    <div className="space-y-6 pb-12 font-sans text-platinum-800">
      {/* Tactical Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end border-b border-cyber-cyan/15 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyber-cyan animate-pulse" />
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-cyber-cyan">
              TACTICAL RESPONDER HUD // ACTIVE DEPLOYMENT
            </p>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white font-mono">
            Responder Command Center
          </h1>
          <p className="mt-0.5 text-xs text-platinum-700">
            Operator: <span className="text-white font-semibold">{user?.name}</span> ({user?.role}) | Live Mission Sync
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/map"
            className="rounded-lg bg-cyber-cyan/15 border border-cyber-cyan/30 px-3 py-1.5 font-mono text-xs font-bold text-cyber-cyan hover:bg-cyber-cyan/25 transition-colors"
          >
            🗺️ Open Tactical Map
          </Link>
        </div>
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => void queryClient.invalidateQueries({ queryKey: ["responder-assignments"] })}
        loadingMessage="Retrieving responder assignments..."
        errorTitle="Unable to load missions"
        isEmpty={assignments.length === 0}
        emptyTitle="No Assigned Missions"
        emptyDescription="You currently have no active unit dispatches or mission assignments in the network."
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: 1. MY ASSIGNMENTS */}
          <div className="lg:col-span-4 space-y-4">
            <Card>
              <div className="flex items-center justify-between border-b border-[#1F2937] pb-3 mb-4">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-cyber-cyan flex items-center gap-2">
                  <span>🎯</span> 1. My Assignments ({assignments.length})
                </h3>
                <span className="h-2 w-2 rounded-full bg-safe-green animate-ping" />
              </div>

              <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                {assignments.map((assignment) => {
                  const inc = typeof assignment.incidentId === "object" ? (assignment.incidentId as any) : null;
                  const res = typeof assignment.resourceId === "object" ? (assignment.resourceId as any) : null;
                  const isSelected = assignment._id === selectedAssignment?._id;

                  return (
                    <div
                      key={assignment._id}
                      onClick={() => setSelectedAssignmentId(assignment._id)}
                      className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                        isSelected
                          ? "border-cyber-cyan bg-cyber-cyan/10 shadow-neon-cyan"
                          : "border-[#1F2937] bg-tactical-900/80 hover:border-cyber-cyan/40 hover:bg-tactical-900"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-white line-clamp-1">
                          {inc?.title || `Incident ID: ${String(assignment.incidentId)}`}
                        </h4>
                        <AssignmentStatusBadge status={assignment.status} />
                      </div>

                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {inc?.severity && <SeverityBadge severity={inc.severity} />}
                        {inc?.category && (
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-tactical-800 text-platinum-700 border border-[#1F2937]">
                            {inc.category}
                          </span>
                        )}
                      </div>

                      {res && (
                        <p className="mt-2 text-xs text-platinum-700 font-mono">
                          Asset: <span className="text-white">{res.name}</span> ({res.type})
                        </p>
                      )}

                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#1F2937]/60 text-[11px] font-mono text-platinum-700">
                        <span>Dispatched: {new Date(assignment.assignedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {inc?._id && (
                          <Link
                            to={`/incidents/${inc._id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-cyber-cyan hover:underline font-bold"
                          >
                            Details →
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Right Column: 2. NAVIGATION, 3. STATUS UPDATE, 4. FIELD REPORT */}
          <div className="lg:col-span-8 space-y-6">
            {selectedAssignment ? (
              <>
                {/* Mission Header Card */}
                <Card>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F2937] pb-4">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-cyber-cyan font-bold">
                        ACTIVE MISSION TARGET
                      </span>
                      <h2 className="text-lg font-extrabold text-white mt-0.5">
                        {incidentObj?.title || "Assigned Incident"}
                      </h2>
                      <p className="text-xs text-platinum-700 font-mono mt-1">
                        📍 {address} | Coordinates: [{longitude.toFixed(4)}, {latitude.toFixed(4)}]
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <AssignmentStatusBadge status={selectedAssignment.status} />
                      {incidentObj?._id && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/incidents/${incidentObj._id}`)}
                        >
                          View Incident
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 3. STATUS UPDATE SECTION */}
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-cyber-cyan flex items-center gap-2">
                        <span>⚡</span> 3. Status Update & Mission Progress
                      </h3>
                      <span className="text-[11px] font-mono text-platinum-700">
                        Last Updated: {new Date(selectedAssignment.updatedAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {(() => {
                        const allowedTransitions = ASSIGNMENT_STATUS_TRANSITIONS[selectedAssignment.status] ?? [];
                        if (allowedTransitions.length === 0) {
                          return (
                            <p className="text-xs font-mono text-platinum-700 italic">
                              This mission status is finalized ({selectedAssignment.status}). No further transitions permitted.
                            </p>
                          );
                        }

                        return allowedTransitions.map((nextStatus) => {
                          const meta = getAssignmentStatusMeta(nextStatus);
                          return (
                            <Button
                              key={nextStatus}
                              size="sm"
                              isLoading={statusMutation.isPending}
                              onClick={() => handleStatusChange(nextStatus)}
                              className="font-mono text-xs font-bold"
                            >
                              Transition to {meta.label} →
                            </Button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </Card>

                {/* 2. NAVIGATION SECTION */}
                <Card>
                  <div className="flex items-center justify-between border-b border-[#1F2937] pb-3 mb-4">
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-cyber-cyan flex items-center gap-2">
                      <span>🗺️</span> 2. Mission Navigation & Geospatial Map
                    </h3>
                    <Link
                      to="/map"
                      className="font-mono text-xs text-cyber-cyan hover:underline font-bold"
                    >
                      Open Full Tactical Radar →
                    </Link>
                  </div>

                  <div className="h-64 overflow-hidden rounded-xl border border-cyber-cyan/30">
                    <MapContainer
                      center={[latitude, longitude]}
                      zoom={14}
                      className="h-full w-full"
                      scrollWheelZoom={false}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <MapCenter latitude={latitude} longitude={longitude} />
                      <Marker position={[latitude, longitude]} icon={pinIcon} />
                    </MapContainer>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs font-mono text-platinum-700">
                    <span>Target Address: <strong className="text-white">{address}</strong></span>
                    <span>Lat/Lng: <strong className="text-cyber-cyan">{latitude.toFixed(4)}, {longitude.toFixed(4)}</strong></span>
                  </div>
                </Card>

                {/* 4. FIELD REPORT SECTION */}
                <Card>
                  <div className="flex items-center justify-between border-b border-[#1F2937] pb-3 mb-4">
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-cyber-cyan flex items-center gap-2">
                      <span>📋</span> 4. Field Report & Situation Log
                    </h3>
                    <span className="text-xs font-mono text-platinum-700">Associated with Incident #{incidentObj?._id?.slice(-6) || "Active"}</span>
                  </div>

                  {/* Previous Notes / Field Reports History */}
                  {selectedAssignment.notes && (
                    <div className="mb-4 rounded-xl border border-[#1F2937] bg-tactical-900/90 p-3.5">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyber-cyan mb-2">
                        Submitted Reports & Activity Log:
                      </p>
                      <div className="max-h-40 overflow-y-auto whitespace-pre-line text-xs font-mono text-platinum-900 bg-tactical-950/60 p-3 rounded-lg border border-[#1F2937]">
                        {selectedAssignment.notes}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleReportSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Select
                        label="Emergency Conditions"
                        value={conditions}
                        onChange={(e) => setConditions(e.target.value)}
                      >
                        <option value="Stable">Stable</option>
                        <option value="Deteriorating">Deteriorating</option>
                        <option value="Critical / Severe">Critical / Severe</option>
                        <option value="Controlled">Controlled</option>
                      </Select>

                      <Select
                        label="Rescue Progress"
                        value={rescueProgress}
                        onChange={(e) => setRescueProgress(e.target.value)}
                      >
                        <option value="In progress">In progress</option>
                        <option value="Evacuating civilians">Evacuating civilians</option>
                        <option value="Area secured">Area secured</option>
                        <option value="Medical triage active">Medical triage active</option>
                        <option value="Mission completed">Mission completed</option>
                      </Select>

                      <div className="space-y-1">
                        <label className="block text-xs font-mono font-bold uppercase tracking-wider text-platinum-700">
                          People Rescued / Assisted
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={peopleAssisted}
                          onChange={(e) => setPeopleAssisted(e.target.value)}
                          className="w-full rounded-lg border border-cyber-cyan/20 bg-tactical-800 px-3 py-2 text-sm text-white focus:border-cyber-cyan focus:outline-none"
                        />
                      </div>
                    </div>

                    <Textarea
                      label="Field Observations & Situation Details"
                      rows={3}
                      placeholder="Describe hazards, rescue status, structural damage, medical needs..."
                      value={fieldNotes}
                      onChange={(e) => setFieldNotes(e.target.value)}
                    />

                    <div className="space-y-1">
                      <label className="block text-xs font-mono font-bold uppercase tracking-wider text-platinum-700">
                        Additional Resource / Support Requests (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Requesting extra ambulance or water pump unit"
                        value={resourceRequests}
                        onChange={(e) => setResourceRequests(e.target.value)}
                        className="w-full rounded-lg border border-cyber-cyan/20 bg-tactical-800 px-3 py-2 text-sm text-white focus:border-cyber-cyan focus:outline-none"
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button type="submit" isLoading={reportMutation.isPending}>
                        Submit Field Report →
                      </Button>
                    </div>
                  </form>
                </Card>
              </>
            ) : (
              <Card>
                <div className="py-12 text-center">
                  <p className="text-platinum-700 font-mono text-sm">Select an assignment from the left panel to inspect mission details.</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </QueryState>
    </div>
  );
};

export default ResponderDashboard;
