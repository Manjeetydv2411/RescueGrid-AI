import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { aiApi, assignmentApi, getErrorMessage, incidentApi, type AiPriorityScore, type AiMissingField } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { SOCKET_EVENTS, useSocket } from "@/hooks/useSocket";
import {
  INCIDENT_STATUS_TRANSITIONS,
  getIncidentStatusMeta,
} from "@/utils/domain";
import type {
  IncidentEventData,
  IncidentStatus,
  Responder,
  IncidentAttachment,
} from "@/types/api";
import Button, { ButtonLink } from "@/components/common/Button";
import Card from "@/components/common/Card";
import QueryState from "@/components/common/QueryState";
import {
  CategoryBadge,
  IncidentStatusBadge,
  SeverityBadge,
} from "@/components/common/StatusBadge";
import { tokenStore } from "@/services/api";
import { ResourceAllocationModal } from "@/components/ResourceAllocationModal";

const MediaViewer = ({ attachment }: { attachment: IncidentAttachment }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const response = await fetch(attachment.url, {
          headers: {
            Authorization: `Bearer ${tokenStore.getAccessToken()}`,
          },
        });
        const blob = await response.blob();
        setBlobUrl(URL.createObjectURL(blob));
      } catch (err) {
        toast.error("Failed to load media");
      }
    };
    fetchMedia();
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [attachment.url]);

  if (!blobUrl) return <div className="h-48 w-full animate-pulse bg-platinum-800" />;

  return attachment.type === "IMAGE" ? (
    <img src={blobUrl} alt={attachment.originalName} className="h-full w-full object-cover" />
  ) : (
    <video src={blobUrl} controls className="h-full w-full object-cover" />
  );
};

const TimelineStep = ({
  status,
  reachedAt,
  isCurrent,
  isPast,
}: {
  status: IncidentStatus;
  reachedAt?: string;
  isCurrent: boolean;
  isPast: boolean;
}) => {
  const meta = getIncidentStatusMeta(status);

  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
            isCurrent
              ? "border-blue-600 bg-blue-600"
              : isPast
              ? "border-emerald-500 bg-emerald-500"
              : "border-platinum-300 bg-tactical-800"
          }`}
        >
          {isPast && (
            <svg
              className="h-3 w-3 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </span>
        <span
          aria-hidden="true"
          className={`mt-1 w-0.5 flex-1 ${
            isPast ? "bg-emerald-200" : "bg-platinum-200"
          }`}
        />
      </div>
      <div className="-mt-0.5 min-w-0">
        <p
          className={`text-sm font-semibold ${
            isCurrent ? "text-platinum-900" : "text-platinum-800"
          }`}
        >
          {meta.label}
          {isCurrent && (
            <span className="ml-2 text-xs font-medium text-cyber-cyan">
              Current
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-platinum-700">
          {reachedAt
            ? new Date(reachedAt).toLocaleString()
            : isPast
            ? "Completed"
            : meta.description}
        </p>
      </div>
    </li>
  );
};

const ResponderList = ({
  responders,
  isLoading,
  isError,
  selectedId,
  onSelect,
}: {
  responders: Responder[];
  isLoading: boolean;
  isError: boolean;
  selectedId: string | null;
  onSelect: (responder: Responder) => void;
}) => {
  if (isLoading) {
    return (
      <p className="py-6 text-center text-sm text-platinum-700">
        Loading responders…
      </p>
    );
  }

  if (isError) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-alert-red">
        Unable to load the responder directory. Choosing a responder requires
        the coordinator role.
      </p>
    );
  }

  if (responders.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-platinum-700">
        No responders match that search.
      </p>
    );
  }

  return (
    <ul
      className="max-h-60 divide-y divide-platinum-100 overflow-y-auto rounded-lg border border-platinum-200"
      aria-label="Available responders"
    >
      {responders.map((responder) => {
        const isSelected = selectedId === responder._id;
        return (
          <li key={responder._id}>
            <button
              type="button"
              onClick={() => onSelect(responder)}
              aria-pressed={isSelected}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mocha-500 ${
                isSelected ? "bg-blue-50" : "hover:bg-platinum-50"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-platinum-900">
                  {responder.name}
                </span>
                <span className="block truncate text-xs text-platinum-700">
                  {responder.email}
                </span>
              </span>
              <span className="shrink-0 text-xs font-medium text-platinum-800">
                {responder.isAvailable === false ? "Off duty" : responder.role}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

const SmartRecommendationsList = ({
  recommendations,
  isLoading,
  isError,
  selectedId,
  onSelect,
}: {
  recommendations: any[];
  isLoading: boolean;
  isError: boolean;
  selectedId: string | null;
  onSelect: (responder: Responder) => void;
}) => {
  if (isLoading) {
    return <p className="py-4 text-center text-sm text-platinum-700">Computing AI recommendations…</p>;
  }
  if (isError) {
    return <p className="text-sm text-alert-red">Failed to load recommendations.</p>;
  }
  if (!recommendations || recommendations.length === 0) {
    return <p className="text-sm text-platinum-700">No available responders found for recommendation.</p>;
  }

  return (
    <ul className="max-h-60 divide-y divide-platinum-100 overflow-y-auto rounded-lg border border-platinum-200">
      {recommendations.map((rec) => {
        const responder = rec.responder;
        const isSelected = selectedId === responder._id;
        return (
          <li key={responder._id}>
            <button
              type="button"
              onClick={() => onSelect(responder)}
              aria-pressed={isSelected}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors ${
                isSelected ? "bg-blue-50" : "hover:bg-platinum-50"
              }`}
            >
              <div>
                <span className="block text-sm font-medium text-platinum-900">
                  {responder.name} <span className="text-xs font-bold text-cyber-cyan">Score: {rec.score}</span>
                </span>
                <span className="block text-xs text-platinum-700">
                  Distance: {rec.distanceKm !== null ? `${rec.distanceKm} km` : "Unknown"} | Workload: {rec.workload} active | Skills matched: {rec.skillMatchCount}
                </span>
              </div>
              <span className="shrink-0 text-xs font-medium text-emerald-600">
                Recommended
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

const IncidentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { onEvent, joinIncident, leaveIncident, requestMissedUpdates, isConnected } =
    useSocket();

  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<Responder | null>(
    null
  );
  const [responderSearch, setResponderSearch] = useState("");
  const [debouncedResponderSearch, setDebouncedResponderSearch] = useState("");
  const [selectedResponder, setSelectedResponder] = useState<Responder | null>(
    null
  );
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [summary, setSummary] = useState<{
    summary: string;
    key_points: string[];
    estimated_impact: string;
  } | null>(null);
  const [priority, setPriority] = useState<AiPriorityScore | null>(null);
  const [missingInfo, setMissingInfo] = useState<AiMissingField[] | null>(null);

  const incidentQuery = useQuery({
    queryKey: ["incident", id],
    queryFn: () => incidentApi.get(id!),
    enabled: Boolean(id),
  });

  const [serverVersion, setServerVersion] = useState<{
    id: string;
    version: number;
  } | null>(null);

  const assignmentsQuery = useQuery({
    queryKey: ["incident-assignments", id],
    queryFn: () => assignmentApi.byIncident(id!),
    enabled: Boolean(id),
  });

  const recommendationsQuery = useQuery({
    queryKey: ["incident-recommendations", id],
    queryFn: () => assignmentApi.recommendations(id!),
    enabled: Boolean(id) && dispatchOpen,
  });

  const respondersQuery = useQuery({
    queryKey: ["responders", debouncedResponderSearch],
    queryFn: () => assignmentApi.responders(debouncedResponderSearch || undefined),
    enabled: (dispatchOpen || assignOpen) && !debouncedResponderSearch,
  });

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedResponderSearch(responderSearch),
      300
    );
    return () => window.clearTimeout(timer);
  }, [responderSearch]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["incident", id] });
    void queryClient.invalidateQueries({ queryKey: ["incident-assignments", id] });
  }, [queryClient, id]);

  useEffect(() => {
    if (!id) return;
    if (!isConnected) return;

    const incidentId = id;

    const unsubscribers = [
      onEvent<IncidentEventData>(SOCKET_EVENTS.INCIDENT_UPDATED, (data) => {
        if (data.incidentId === incidentId) refresh();
      }),
      onEvent<IncidentEventData>(SOCKET_EVENTS.INCIDENT_STATUS_CHANGED, (data) => {
        if (data.incidentId === incidentId) refresh();
      }),
      onEvent<IncidentEventData>(SOCKET_EVENTS.INCIDENT_ASSIGNED, (data) => {
        if (data.incidentId === incidentId) refresh();
      }),
      onEvent<IncidentEventData>(SOCKET_EVENTS.INCIDENT_UNASSIGNED, (data) => {
        if (data.incidentId === incidentId) refresh();
      }),
      onEvent(SOCKET_EVENTS.ASSIGNMENT_CREATED, (data: { incidentId: string }) => {
        if (data.incidentId === incidentId) refresh();
      }),
      onEvent(SOCKET_EVENTS.ASSIGNMENT_STATUS_CHANGED, (data: { incidentId: string }) => {
        if (data.incidentId === incidentId) refresh();
      }),
      onEvent(SOCKET_EVENTS.ASSIGNMENT_CANCELLED, (data: { incidentId: string }) => {
        if (data.incidentId === incidentId) refresh();
      }),
    ];

    void joinIncident(incidentId);

    void requestMissedUpdates(incidentId).then((response) => {
      const payload = response as {
        success?: boolean;
        incident?: { version?: number };
      } | null;
      if (!payload?.success) return;

      const reported = payload.incident?.version;
      if (typeof reported !== "number") return;

      setServerVersion({ id: incidentId, version: reported });
    });

    return () => {
      unsubscribers.forEach((off) => off());
      void leaveIncident(incidentId);
    };
  }, [
    id,
    isConnected,
    onEvent,
    joinIncident,
    leaveIncident,
    requestMissedUpdates,
    refresh,
  ]);

  useEffect(() => {
    if (!serverVersion || serverVersion.id !== id) return;

    const localVersion = incidentQuery.data?.version;
    if (typeof localVersion !== "number") return;
    if (serverVersion.version <= localVersion) return;

    refresh();
  }, [serverVersion, id, incidentQuery.data?.version, refresh]);

  const statusMutation = useMutation({
    mutationFn: (status: IncidentStatus) => incidentApi.update(id!, { status }),
    onSuccess: (incident) => {
      toast.success(`Incident moved to ${getIncidentStatusMeta(incident.status).label}`);
      void queryClient.invalidateQueries({ queryKey: ["incident", id] });
      void queryClient.invalidateQueries({ queryKey: ["incidents"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to change the status"
      );
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: () =>
      assignmentApi.create(id!, {
        responderId: selectedResponder!._id,
        notes: dispatchNotes || undefined,
      }),
    onSuccess: () => {
      toast.success(`${selectedResponder?.name ?? "Responder"} dispatched`);
      setDispatchOpen(false);
      setSelectedResponder(null);
      setDispatchNotes("");
      refresh();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const assignMutation = useMutation({
    mutationFn: (assignedTo: string) => incidentApi.assign(id!, assignedTo),
    onSuccess: () => {
      toast.success("Responsible responder updated");
      setAssignOpen(false);
      setSelectedAssignee(null);
      refresh();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const unassignMutation = useMutation({
    mutationFn: () => incidentApi.unassign(id!),
    onSuccess: () => {
      toast.success("Responsible responder cleared");
      refresh();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const summaryMutation = useMutation({
    mutationFn: () => aiApi.summary(id!),
    onSuccess: (data) => {
      setSummary(data);
      toast.success("AI summary generated");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const priorityMutation = useMutation({
    mutationFn: () => aiApi.priorityScore(id!),
    onSuccess: (data) => {
      setPriority(data);
      toast.success("Priority analysis complete");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const missingInfoMutation = useMutation({
    mutationFn: () => aiApi.missingInfo(id!),
    onSuccess: (data) => {
      setMissingInfo(data);
      toast.success("Missing details check complete");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const incident = incidentQuery.data;
  const assignments = assignmentsQuery.data ?? [];
  const canManage = user?.role === "ADMIN" || user?.role === "COORDINATOR";

  const allowedTransitions = useMemo(() => {
    if (!incident) return [];
    return INCIDENT_STATUS_TRANSITIONS[incident.status] ?? [];
  }, [incident?.status]);

  const timeline = useMemo(() => {
    if (!incident) return [];

    const statuses: IncidentStatus[] = [
      "REPORTED",
      "VERIFIED",
      "ACTIVE",
      "RESOLVED",
      "CLOSED",
    ];

    const currentIndex = statuses.indexOf(incident.status);

    const logMap = new Map<string, string>();
    for (const entry of incident.auditLog ?? []) {
      if (entry.action === "INCIDENT_STATUS_CHANGED" && entry.details?.status) {
        logMap.set(entry.details.status as string, entry.timestamp);
      }
    }

    return statuses.map((status, index) => ({
      status,
      reachedAt: logMap.get(status),
      isCurrent: status === incident.status,
      isPast: currentIndex > index,
    }));
  }, [incident]);

  const responsibleResponder = useMemo<{
    id: string | null;
    name: string | null;
  } | null>(() => {
    const assigned = incident?.assignedTo;
    if (!assigned) return null;
    if (typeof assigned === "object") {
      return {
        id: assigned._id ?? assigned.id ?? null,
        name: assigned.name ?? null,
      };
    }
    return { id: assigned, name: null };
  }, [incident?.assignedTo]);

  const responsibleResponderLabel =
    responsibleResponder?.name ??
    responsibleResponder?.id ??
    "Unassigned";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate("/incidents")}
          >
            ← Back
          </Button>
          <p className="truncate font-mono text-xs text-platinum-700">
            ID: {id}
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            {allowedTransitions.map((status) => (
              <Button
                key={status}
                size="sm"
                variant="secondary"
                onClick={() => statusMutation.mutate(status)}
                isLoading={statusMutation.isPending}
              >
                Mark as {getIncidentStatusMeta(status).label.toLowerCase()}
              </Button>
            ))}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDispatchOpen(true)}
            >
              Dispatch responder
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAllocationOpen(true)}
            >
              Allocate resource
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAssignOpen(true)}
            >
              Set responsible responder
            </Button>
            {responsibleResponder?.id && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => unassignMutation.mutate()}
                isLoading={unassignMutation.isPending}
              >
                Clear responsible responder
              </Button>
            )}
            <ButtonLink to={`/incidents/${id}/edit`} size="sm" variant="secondary">
              Edit incident
            </ButtonLink>
          </div>
        )}
      </div>

      <QueryState
        isLoading={incidentQuery.isLoading}
        isError={incidentQuery.isError}
        error={incidentQuery.error}
        onRetry={() => void incidentQuery.refetch()}
      >
        {incident && (
          <>
            <Card>
              <div className="flex flex-col justify-between gap-4 border-b border-platinum-200 pb-5 md:flex-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <IncidentStatusBadge status={incident.status} />
                    <SeverityBadge severity={incident.severity} />
                    <CategoryBadge category={incident.category} />
                  </div>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-platinum-900">
                    {incident.title}
                  </h1>
                </div>
              </div>

              {/* Evidence Section */}
              <div className="py-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-platinum-700 mb-3">Evidence Media</h3>
                {incident.attachments && incident.attachments.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {incident.attachments.map(att => (
                      <div key={att._id} className="aspect-square rounded border border-platinum-700 overflow-hidden">
                        <MediaViewer attachment={att} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-platinum-600 italic">No media attached to this incident.</p>
                )}
              </div>

              {(user?.role === "ADMIN" || user?.role === "COORDINATOR") && incident.contactPhone && (
                <div className="py-4 border-t border-platinum-200">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-platinum-700 mb-2">Reporter Phone</h3>
                  <p className="text-sm text-platinum-900">{incident.contactPhone}</p>
                </div>
              )}

              <div className="grid gap-6 border-t border-platinum-200 py-5 md:grid-cols-2">
                <section>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-platinum-700">
                    Description
                  </h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-platinum-900">
                    {incident.description || "No description provided."}
                  </p>
                </section>

                <section className="space-y-4">
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-platinum-700">
                      Location
                    </h2>
                    <p className="mt-2 text-sm text-platinum-900">
                      {incident.address || "Location not provided"}
                    </p>
                    {incident.location?.coordinates && (
                      <p className="mt-1 text-xs text-platinum-700">
                        Coordinates: {incident.location.coordinates[1]},{" "}
                        {incident.location.coordinates[0]}
                      </p>
                    )}
                  </div>

                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-platinum-700">
                      Reported by
                    </h2>
                    <p className="mt-2 text-sm text-platinum-900">
                      {incident.reportedBy?.name || "Unknown reporter"}
                    </p>
                    {incident.reportedBy?.email && (
                      <p className="text-xs text-platinum-700">
                        {incident.reportedBy.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-platinum-700">
                      Responsible responder
                    </h2>
                    <p className="mt-2 text-sm font-medium text-platinum-900">
                      {responsibleResponderLabel}
                    </p>
                  </div>
                </section>
              </div>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <h2 className="text-lg font-semibold text-platinum-900">
                  Status timeline
                </h2>
                <ol className="mt-4">
                  {timeline.map((step) => (
                    <TimelineStep key={step.status} {...step} />
                  ))}
                </ol>
              </Card>

              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-platinum-900">
                    Dispatched units
                  </h2>
                  <span className="text-xs text-platinum-700">
                    {assignments.length} assignment{assignments.length === 1 ? "" : "s"}
                  </span>
                </div>

                {assignmentsQuery.isLoading ? (
                  <p className="mt-4 text-sm text-platinum-700">
                    Loading dispatched units…
                  </p>
                ) : assignmentsQuery.isError ? (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-alert-red">
                      Unable to load dispatched units
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void assignmentsQuery.refetch()}
                    >
                      Retry
                    </Button>
                  </div>
                ) : assignments.length === 0 ? (
                  <p className="mt-4 text-sm text-platinum-700">
                    No responders dispatched
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-platinum-200">
                    {assignments.map((assignment) => {
                      const responderInfo =
                        typeof assignment.responderId === "object"
                          ? assignment.responderId
                          : null;
                      const responderName =
                        responderInfo?.name ||
                        (typeof assignment.responderId === "string"
                          ? assignment.responderId
                          : responderInfo?._id) ||
                        "Unknown responder";
                      const resourceInfo =
                        assignment.resourceId &&
                        typeof assignment.resourceId === "object"
                          ? assignment.resourceId
                          : null;

                      return (
                        <li key={assignment._id} className="py-3">
                          <p className="text-sm font-medium text-platinum-900">
                            {responderName}
                          </p>
                          {responderInfo?.email && (
                            <p className="text-xs text-platinum-700">
                              {responderInfo.email}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-platinum-700">
                           Status: {assignment.status.replace(/_/g, " ")}
                          </p>
                          {resourceInfo?.name && (
                            <p className="text-xs text-platinum-700">
                              Resource: {resourceInfo.name}
                            </p>
                          )}
                          {assignment.notes && (
                            <p className="mt-1 text-sm text-platinum-800">
                              {assignment.notes}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>

            {canManage && (
              <Card>
                <h2 className="text-lg font-semibold text-platinum-900">
                  AI assistance
                </h2>
                <p className="mt-1 text-sm text-platinum-700">
                  AI results are advisory and should be verified by the response team.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => summaryMutation.mutate()}
                    isLoading={summaryMutation.isPending}
                  >
                    Generate summary
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => priorityMutation.mutate()}
                    isLoading={priorityMutation.isPending}
                  >
                    Analyze priority
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => missingInfoMutation.mutate()}
                    isLoading={missingInfoMutation.isPending}
                  >
                    Check missing details
                  </Button>
                </div>

                {summary && (
                  <section className="mt-5 border-t border-platinum-200 pt-4">
                    <h3 className="font-semibold text-platinum-900">Incident summary</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-platinum-800">
                      {summary.summary}
                    </p>
                    {summary.key_points.length > 0 && (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-platinum-800">
                        {summary.key_points.map((point, index) => (
                          <li key={`${index}-${point}`}>{point}</li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-3 text-sm text-platinum-700">
                      Estimated impact: {summary.estimated_impact}
                    </p>
                  </section>
                )}

                {priority && (
                  <section className="mt-5 border-t border-platinum-200 pt-4">
                    <h3 className="font-semibold text-platinum-900">Priority analysis</h3>
                    <p className="mt-2 text-sm text-platinum-800">
                      Score: {priority.score} / {priority.max_score}
                    </p>
                    {priority.factors.length > 0 && (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-platinum-800">
                        {priority.factors.map((factor, index) => (
                          <li key={`${index}-${factor}`}>{factor}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}

                {missingInfo && (
                  <section className="mt-5 border-t border-platinum-200 pt-4">
                    <h3 className="font-semibold text-platinum-900">Missing details</h3>
                    {missingInfo.length === 0 ? (
                      <p className="mt-2 text-sm text-platinum-800">
                        No missing details were identified.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-3">
                        {missingInfo.map((item, index) => (
                          <li
                            key={`${index}-${item.field}`}
                            className="rounded-lg border border-platinum-200 p-3"
                          >
                            <p className="text-sm font-medium text-platinum-900">
                              {item.field} · {item.severity}
                            </p>
                            <p className="mt-1 text-sm text-platinum-700">
                              {item.verification_suggestion}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
              </Card>
            )}
          </>
        )}
      </QueryState>

      {canManage && dispatchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDispatchOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="dispatch-dialog-title"
            className="my-8 w-full max-w-xl rounded-xl bg-tactical-900 p-5 shadow-xl"
          >
            <h2 id="dispatch-dialog-title" className="text-lg font-semibold text-platinum-900">
              Smart Dispatch & Recommendations
            </h2>
            <div className="mt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-platinum-700 mb-2">Recommended Responders</h3>
              <SmartRecommendationsList
                recommendations={recommendationsQuery.data ?? []}
                isLoading={recommendationsQuery.isLoading}
                isError={recommendationsQuery.isError}
                selectedId={selectedResponder?._id ?? null}
                onSelect={setSelectedResponder}
              />
            </div>

            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-platinum-700 mb-2">Or Search All Responders</h3>
              <input
                value={responderSearch}
                onChange={(event) => setResponderSearch(event.target.value)}
                placeholder="Search by name or email"
                className="mt-1 w-full rounded-lg border border-platinum-300 bg-white px-3 py-2 text-sm text-platinum-900"
              />
              <div className="mt-3">
                <ResponderList
                  responders={respondersQuery.data ?? []}
                  isLoading={respondersQuery.isLoading}
                  isError={respondersQuery.isError}
                  selectedId={selectedResponder?._id ?? null}
                  onSelect={setSelectedResponder}
                />
              </div>
            </div>

            <label className="mt-4 block text-sm font-medium text-platinum-900">
              Dispatch notes (optional)
              <textarea
                value={dispatchNotes}
                onChange={(event) => setDispatchNotes(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-platinum-300 bg-white px-3 py-2 text-sm text-platinum-900"
              />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setDispatchOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => dispatchMutation.mutate()}
                disabled={!selectedResponder || dispatchMutation.isPending}
                isLoading={dispatchMutation.isPending}
              >
                Confirm dispatch
              </Button>
            </div>
          </section>
        </div>
      )}

      {canManage && id && (
        <ResourceAllocationModal
          incidentId={id}
          isOpen={allocationOpen}
          onClose={() => setAllocationOpen(false)}
        />
      )}

      {canManage && assignOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAssignOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-dialog-title"
            className="my-8 w-full max-w-xl rounded-xl bg-tactical-900 p-5 shadow-xl"
          >
            <h2 id="assign-dialog-title" className="text-lg font-semibold text-platinum-900">
              Set responsible responder
            </h2>
            <label className="mt-4 block text-sm font-medium text-platinum-900">
              Search responders
              <input
                value={responderSearch}
                onChange={(event) => setResponderSearch(event.target.value)}
                placeholder="Search by name or email"
                className="mt-1 w-full rounded-lg border border-platinum-300 bg-white px-3 py-2 text-sm text-platinum-900"
              />
            </label>
            <div className="mt-3">
              <ResponderList
                responders={respondersQuery.data ?? []}
                isLoading={respondersQuery.isLoading}
                isError={respondersQuery.isError}
                selectedId={selectedAssignee?._id ?? null}
                onSelect={setSelectedAssignee}
              />
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setAssignOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => selectedAssignee && assignMutation.mutate(selectedAssignee._id)}
                disabled={!selectedAssignee || assignMutation.isPending}
                isLoading={assignMutation.isPending}
              >
                {selectedAssignee
                  ? `Make ${selectedAssignee.name} responsible`
                  : "Make responder responsible"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default IncidentDetail;
