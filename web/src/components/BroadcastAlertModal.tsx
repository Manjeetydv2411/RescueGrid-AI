import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { broadcastApi, incidentApi } from "../services/api";
import { SEVERITIES, getSeverityMeta } from "../utils/domain";
import type { Severity, UserRole } from "../types/api";
import Modal from "./common/Modal";
import Button from "./common/Button";
import Input from "./common/Input";
import Textarea from "./common/Textarea";
import Select from "./common/Select";

interface BroadcastAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ALL_ROLES: UserRole[] = ["RESPONDER", "VIEWER", "COORDINATOR", "ADMIN"];
const TARGETING_MODES = [
  { id: "EVERYONE", label: "Everyone (All Users)", desc: "Broadcasts to all users across the system" },
  { id: "RADIUS", label: "Geographic Radius", desc: "Target users within X km of specified coordinates" },
  { id: "INCIDENT_LOCATION", label: "Incident Location", desc: "Target users within X km of a specific incident" },
  { id: "DISTRICT", label: "District / Region", desc: "Target users matching district address string" },
  { id: "CITY", label: "City", desc: "Target users matching city address string" },
];

const ALL_CHANNELS = [
  { id: "IN_APP", label: "In-App Notification", desc: "Delivers to user portal in real-time" },
  { id: "SMS", label: "SMS Text Message", desc: "Simulated or gateway SMS dispatch" },
  { id: "EMAIL", label: "Emergency Email", desc: "Secure operational email alert" },
  { id: "PUSH", label: "Push Notification", desc: "Mobile device push alert" },
];

export const BroadcastAlertModal = ({ isOpen, onClose, onSuccess }: BroadcastAlertModalProps) => {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<Severity>("HIGH");
  const [channels, setChannels] = useState<string[]>(["IN_APP", "SMS"]);
  const [targetRoles, setTargetRoles] = useState<UserRole[]>(["RESPONDER", "COORDINATOR", "ADMIN"]);

  // Location targeting state
  const [targetingMode, setTargetingMode] = useState<string>("EVERYONE");
  const [incidentId, setIncidentId] = useState<string>("");
  const [lat, setLat] = useState<string>("37.7749");
  const [lng, setLng] = useState<string>("-122.4194");
  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [district, setDistrict] = useState<string>("");
  const [city, setCity] = useState<string>("");

  // Preview & Confirmation state
  const [previewResult, setPreviewResult] = useState<{
    totalRecipients: number;
    byRole: Record<string, number>;
    channels: string[];
    targetingMode: string;
  } | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => `broadcast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  // Fetch incidents for INCIDENT_LOCATION mode
  const { data: incidentsData } = useQuery({
    queryKey: ["incidents-for-broadcast"],
    queryFn: () => incidentApi.list({ limit: 100 }),
    enabled: isOpen && targetingMode === "INCIDENT_LOCATION",
  });

  const incidents = incidentsData?.data || [];

  const previewMutation = useMutation({
    mutationFn: () =>
      broadcastApi.preview({
        title,
        message,
        severity,
        channels,
        scope: {
          targetingMode,
          targetRoles,
          incidentId: targetingMode === "INCIDENT_LOCATION" ? incidentId : undefined,
          center: targetingMode === "RADIUS" ? [parseFloat(lng) || 0, parseFloat(lat) || 0] : undefined,
          radiusKm: targetingMode === "RADIUS" || targetingMode === "INCIDENT_LOCATION" ? radiusKm : undefined,
          district: targetingMode === "DISTRICT" ? district : undefined,
          city: targetingMode === "CITY" ? city : undefined,
        },
      }),
    onSuccess: (data) => {
      setPreviewResult(data);
      setConfirmStep(true);
      toast.success(`Recipient preview generated: ${data.totalRecipients} eligible recipient(s).`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to preview recipients");
    },
  });

  const mutation = useMutation({
    mutationFn: () =>
      broadcastApi.create({
        title,
        message,
        severity,
        channels,
        scope: {
          targetingMode,
          targetRoles,
          incidentId: targetingMode === "INCIDENT_LOCATION" ? incidentId : undefined,
          center: targetingMode === "RADIUS" ? [parseFloat(lng) || 0, parseFloat(lat) || 0] : undefined,
          radiusKm: targetingMode === "RADIUS" || targetingMode === "INCIDENT_LOCATION" ? radiusKm : undefined,
          district: targetingMode === "DISTRICT" ? district : undefined,
          city: targetingMode === "CITY" ? city : undefined,
        },
        idempotencyKey,
      }),
    onSuccess: () => {
      toast.success("Emergency broadcast dispatched successfully.");
      void queryClient.invalidateQueries({ queryKey: ["broadcasts"] });
      onSuccess?.();
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to dispatch broadcast");
    },
  });

  const handleClose = () => {
    setTitle("");
    setMessage("");
    setSeverity("HIGH");
    setChannels(["IN_APP", "SMS"]);
    setTargetRoles(["RESPONDER", "COORDINATOR", "ADMIN"]);
    setTargetingMode("EVERYONE");
    setIncidentId("");
    setLat("37.7749");
    setLng("-122.4194");
    setRadiusKm(25);
    setDistrict("");
    setCity("");
    setPreviewResult(null);
    setConfirmStep(false);
    setIdempotencyKey(`broadcast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
    onClose();
  };

  const toggleChannel = (ch: string) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
    setPreviewResult(null);
  };

  const toggleRole = (role: UserRole) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
    setPreviewResult(null);
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required.");
      return;
    }
    if (channels.length === 0) {
      toast.error("Select at least one delivery channel.");
      return;
    }
    if (targetRoles.length === 0) {
      toast.error("Select at least one target recipient role.");
      return;
    }
    if (targetingMode === "INCIDENT_LOCATION" && !incidentId) {
      toast.error("Please select a target incident.");
      return;
    }
    if (targetingMode === "DISTRICT" && !district.trim()) {
      toast.error("Please enter a target district.");
      return;
    }
    if (targetingMode === "CITY" && !city.trim()) {
      toast.error("Please enter a target city.");
      return;
    }

    previewMutation.mutate();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Dispatch Multi-Channel Emergency Broadcast"
      description="Broadcast high-priority emergency alerts with precise location targeting and channel routing."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={mutation.isPending || previewMutation.isPending}>
            Cancel
          </Button>
          {confirmStep ? (
            <Button
              variant="secondary"
              onClick={() => setConfirmStep(false)}
              disabled={mutation.isPending}
            >
              Back to Edit & Targeting
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={handlePreview}
              isLoading={previewMutation.isPending}
              disabled={mutation.isPending}
            >
              Preview Recipients
            </Button>
          )}
          {confirmStep && (
            <Button
              variant="primary"
              onClick={() => mutation.mutate()}
              isLoading={mutation.isPending}
              className="bg-alert-red hover:bg-alert-red/90 text-white"
            >
              Confirm & Dispatch Broadcast
            </Button>
          )}
        </>
      }
    >
      <form onSubmit={handlePreview} className="space-y-6">
        {confirmStep && previewResult ? (
          <div className="space-y-4 rounded-lg border border-alert-red/40 bg-tactical-950/90 p-5 font-mono text-sm">
            <div className="flex items-center gap-2 text-alert-red font-bold uppercase tracking-wider text-base">
              <span className="h-3 w-3 rounded-full bg-alert-red animate-ping" />
              EMERGENCY BROADCAST REVIEW & TARGETING TELEMETRY
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-tactical-900 p-4 rounded-lg border border-tactical-800">
              <div className="space-y-2 text-platinum-800">
                <p><strong className="text-white">Title:</strong> {title}</p>
                <p><strong className="text-white">Severity:</strong> <span className="text-alert-red font-bold">{severity}</span></p>
                <p><strong className="text-white">Targeting Mode:</strong> <span className="text-cyber-cyan font-bold">{targetingMode}</span></p>
                <p><strong className="text-white">Target Roles:</strong> {targetRoles.join(", ")}</p>
                <p><strong className="text-white">Channels:</strong> {channels.join(", ")}</p>
              </div>
              <div className="space-y-2 border-l border-tactical-800 pl-4 text-platinum-800">
                <p className="text-xs uppercase text-cyber-cyan font-bold tracking-wider">Eligible Recipient Telemetry:</p>
                <div className="text-2xl font-bold text-white mb-2">
                  {previewResult.totalRecipients} <span className="text-xs font-normal text-platinum-700">Total Recipients</span>
                </div>
                <div className="space-y-1 text-xs">
                  {Object.entries(previewResult.byRole).map(([role, count]) => (
                    <div key={role} className="flex justify-between border-b border-tactical-800 pb-1">
                      <span className="text-platinum-700">{role}:</span>
                      <span className="text-white font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded bg-tactical-900 p-3 border border-cyber-cyan/20 text-white">
              <p className="text-xs text-cyber-cyan font-bold mb-1">MESSAGE CONTENT:</p>
              <p className="whitespace-pre-wrap text-sm">{message}</p>
            </div>

            {previewResult.totalRecipients === 0 && (
              <div className="rounded bg-warn-amber/10 p-3 border border-warn-amber/30 text-warn-amber text-xs">
                ⚠️ Warning: Zero recipients match the selected criteria and roles. Dispatching will deliver 0 notifications.
              </div>
            )}

            <p className="text-xs text-warn-amber font-semibold">
              Warning: Confirming will immediately dispatch multi-channel transmissions (with simulated gateways where live APIs are unconfigured) and create permanent audit logs.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <Input
                label="Broadcast Title"
                placeholder="e.g., URGENT: Sector 4 Flash Flood Evacuation Notice"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setPreviewResult(null); }}
                required
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-platinum-700 mb-1">
                    Emergency Severity
                  </label>
                  <Select
                    value={severity}
                    onChange={(e) => { setSeverity(e.target.value as Severity); setPreviewResult(null); }}
                  >
                    {SEVERITIES.map((sev) => {
                      const meta = getSeverityMeta(sev);
                      return (
                        <option key={sev} value={sev}>
                          {meta.label} ({sev})
                        </option>
                      );
                    })}
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-platinum-700 mb-1">
                    Targeting Mode
                  </label>
                  <Select
                    value={targetingMode}
                    onChange={(e) => { setTargetingMode(e.target.value); setPreviewResult(null); }}
                  >
                    {TARGETING_MODES.map((mode) => (
                      <option key={mode.id} value={mode.id}>
                        {mode.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Conditional Targeting Inputs */}
              {targetingMode === "INCIDENT_LOCATION" && (
                <div className="rounded-lg border border-tactical-800 bg-tactical-900/60 p-4 space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyber-cyan">
                    Select Target Incident
                  </h4>
                  <Select
                    value={incidentId}
                    onChange={(e) => { setIncidentId(e.target.value); setPreviewResult(null); }}
                  >
                    <option value="">-- Select Incident --</option>
                    {incidents.map((inc: any) => (
                      <option key={inc._id} value={inc._id}>
                        [{inc.severity}] {inc.title} ({inc.category})
                      </option>
                    ))}
                  </Select>
                  <div>
                    <label className="block text-xs font-mono text-platinum-700 mb-1">Radius (Kilometers)</label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={radiusKm}
                      onChange={(e) => { setRadiusKm(parseInt(e.target.value) || 25); setPreviewResult(null); }}
                    />
                  </div>
                </div>
              )}

              {targetingMode === "RADIUS" && (
                <div className="rounded-lg border border-tactical-800 bg-tactical-900/60 p-4 space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyber-cyan">
                    Geographic Coordinates & Radius
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      label="Latitude"
                      type="text"
                      value={lat}
                      onChange={(e) => { setLat(e.target.value); setPreviewResult(null); }}
                    />
                    <Input
                      label="Longitude"
                      type="text"
                      value={lng}
                      onChange={(e) => { setLng(e.target.value); setPreviewResult(null); }}
                    />
                    <Input
                      label="Radius (km)"
                      type="number"
                      min={1}
                      max={500}
                      value={radiusKm}
                      onChange={(e) => { setRadiusKm(parseInt(e.target.value) || 25); setPreviewResult(null); }}
                    />
                  </div>
                </div>
              )}

              {targetingMode === "DISTRICT" && (
                <div className="rounded-lg border border-tactical-800 bg-tactical-900/60 p-4 space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyber-cyan">
                    Target District
                  </h4>
                  <Input
                    placeholder="e.g., Downtown, North Ward, Sector 4"
                    value={district}
                    onChange={(e) => { setDistrict(e.target.value); setPreviewResult(null); }}
                  />
                </div>
              )}

              {targetingMode === "CITY" && (
                <div className="rounded-lg border border-tactical-800 bg-tactical-900/60 p-4 space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyber-cyan">
                    Target City
                  </h4>
                  <Input
                    placeholder="e.g., San Francisco, Los Angeles"
                    value={city}
                    onChange={(e) => { setCity(e.target.value); setPreviewResult(null); }}
                  />
                </div>
              )}

              <Textarea
                label="Broadcast Message Content"
                placeholder="Provide exact emergency instructions, safe corridors, and assembly points..."
                value={message}
                onChange={(e) => { setMessage(e.target.value); setPreviewResult(null); }}
                rows={4}
                required
              />

              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-platinum-700 mb-2">
                  Target Recipient Roles
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ALL_ROLES.map((role) => {
                    const selected = targetRoles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`rounded-lg border px-3 py-2 text-xs font-mono font-bold transition-all ${
                          selected
                            ? "border-cyber-cyan bg-cyber-cyan/15 text-white shadow-sm"
                            : "border-tactical-800 bg-tactical-800/50 text-platinum-700 hover:border-cyber-cyan/40"
                        }`}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-platinum-700 mb-2">
                  Delivery Channels
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ALL_CHANNELS.map((ch) => {
                    const selected = channels.includes(ch.id);
                    return (
                      <div
                        key={ch.id}
                        onClick={() => toggleChannel(ch.id)}
                        className={`cursor-pointer rounded-lg border p-3 transition-all ${
                          selected
                            ? "border-cyber-cyan bg-cyber-cyan/10 text-white"
                            : "border-tactical-800 bg-tactical-800/50 text-platinum-700 hover:border-cyber-cyan/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-white">{ch.label}</span>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {}}
                            className="rounded border-tactical-700 bg-tactical-900 text-cyber-cyan focus:ring-cyber-cyan"
                          />
                        </div>
                        <p className="mt-1 text-xs text-platinum-700">{ch.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};

export default BroadcastAlertModal;
