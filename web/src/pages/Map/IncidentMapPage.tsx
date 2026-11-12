import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleMarker,
  Polyline,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import toast from "react-hot-toast";

import { incidentApi, evacuationApi, type EvacuationRoute } from "../../services/api";
import {
  INCIDENT_STATUSES,
  SEVERITIES,
  getIncidentStatusMeta,
  getSeverityMeta,
} from "../../utils/domain";
import type {
  Incident,
  IncidentEventData,
  IncidentStatus,
  Paginated,
  Severity,
} from "../../types/api";
import Button, { ButtonLink } from "../../components/common/Button";
import Card from "../../components/common/Card";
import QueryState from "../../components/common/QueryState";
import Select from "../../components/common/Select";
import {
  CategoryBadge,
  IncidentStatusBadge,
  SeverityBadge,
} from "../../components/common/StatusBadge";
import { SOCKET_EVENTS, useSocket } from "../../hooks/useSocket";

const MAP_CENTER: [number, number] = [37.7749, -122.4194];
const MAP_LIMIT = 200;

const FitBounds = ({
  incidents,
  hasSelection,
}: {
  incidents: Incident[];
  hasSelection: boolean;
}) => {
  const map = useMap();

  useEffect(() => {
    if (hasSelection) return;

    const points = incidents
      .map((incident) => incident.location?.coordinates)
      .filter((coords): coords is [number, number] => Array.isArray(coords));

    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0][1], points[0][0]], Math.max(map.getZoom(), 13));
      return;
    }
    map.fitBounds(
      points.map(([lng, lat]) => [lat, lng] as [number, number]),
      { padding: [40, 40], maxZoom: 15 }
    );
  }, [incidents, hasSelection, map]);

  return null;
};

const FocusIncident = ({ incident }: { incident: Incident | null }) => {
  const map = useMap();
  const coords = incident?.location?.coordinates;
  const lng = Array.isArray(coords) ? coords[0] : null;
  const lat = Array.isArray(coords) ? coords[1] : null;

  useEffect(() => {
    if (lng === null || lat === null) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [lng, lat, map]);

  return null;
};

const IncidentMapPage = () => {
  const queryClient = useQueryClient();
  const { onEvent } = useSocket();

  const [status, setStatus] = useState<IncidentStatus | "">("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reconciled, setReconciled] = useState<string[]>([]);

  // Evacuation routing states
  const [evacMode, setEvacMode] = useState(false);
  const [originLat, setOriginLat] = useState("37.75");
  const [originLng, setOriginLng] = useState("-122.45");
  const [destLat, setDestLat] = useState("37.80");
  const [destLng, setDestLng] = useState("-122.38");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const evacQuery = useQuery({
    queryKey: ["evacuation-plan", originLat, originLng, destLat, destLng],
    queryFn: () =>
      evacuationApi.getPlan(
        parseFloat(originLat),
        parseFloat(originLng),
        parseFloat(destLat),
        parseFloat(destLng)
      ),
    enabled: evacMode && !isNaN(parseFloat(originLat)) && !isNaN(parseFloat(originLng)) && !isNaN(parseFloat(destLat)) && !isNaN(parseFloat(destLng)),
    refetchInterval: 15000, // Update routes when new incidents or road-block info changes
  });

  const listKey = useMemo(
    () => ["incidents", "map", status, severity] as const,
    [status, severity]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: listKey,
    queryFn: () =>
      incidentApi.list({
        page: 1,
        limit: MAP_LIMIT,
        status: status || undefined,
        severity: severity || undefined,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
    placeholderData: (previous) => previous,
  });

  const incidents = useMemo(() => data?.data ?? [], [data]);
  const totalIncidents = data?.pagination.total ?? 0;
  const isTruncated = totalIncidents > incidents.length;

  const reconcile = useCallback(
    async (event: IncidentEventData) => {
      const incidentId = event.incidentId;
      if (!incidentId) return;

      try {
        const fresh = await incidentApi.get(incidentId);
        const matchesFilters =
          (!status || fresh.status === status) &&
          (!severity || fresh.severity === severity);

        queryClient.setQueryData<Paginated<Incident>>(listKey, (previous) => {
          if (!previous) return previous;
          const exists = previous.data.some((item) => item._id === incidentId);

          if (!matchesFilters) {
            if (!exists) return previous;
            return {
              ...previous,
              data: previous.data.filter((item) => item._id !== incidentId),
              pagination: {
                ...previous.pagination,
                total: Math.max(previous.pagination.total - 1, 0),
              },
            };
          }

          return {
            ...previous,
            data: (exists
              ? previous.data.map((item) =>
                  item._id === incidentId ? fresh : item
                )
              : [fresh, ...previous.data]
            )
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
              )
              .slice(0, MAP_LIMIT),
            pagination: exists
              ? previous.pagination
              : {
                  ...previous.pagination,
                  total: previous.pagination.total + 1,
                },
          };
        });
        setReconciled((current) => [incidentId, ...current].slice(0, 5));
      } catch {
        void queryClient.invalidateQueries({ queryKey: ["incidents"] });
      }
    },
    [listKey, queryClient, status, severity]
  );

  useEffect(() => {
    const unsubscribers = [
      onEvent<IncidentEventData>(SOCKET_EVENTS.INCIDENT_CREATED, (data) => { void reconcile(data); }),
      onEvent<IncidentEventData>(SOCKET_EVENTS.INCIDENT_UPDATED, (data) => { void reconcile(data); }),
      onEvent<IncidentEventData>(SOCKET_EVENTS.INCIDENT_STATUS_CHANGED, (data) => { void reconcile(data); }),
      onEvent<IncidentEventData>(SOCKET_EVENTS.INCIDENT_ASSIGNED, (data) => { void reconcile(data); }),
      onEvent<IncidentEventData>(SOCKET_EVENTS.INCIDENT_UNASSIGNED, (data) => { void reconcile(data); }),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, [onEvent, reconcile]);

  const selected = useMemo(
    () => incidents.find((incident) => incident._id === selectedId) ?? null,
    [incidents, selectedId]
  );

  useEffect(() => {
    if (selectedId && !incidents.some((incident) => incident._id === selectedId)) {
      setSelectedId(null);
    }
  }, [incidents, selectedId]);

  const withLocation = useMemo(
    () =>
      incidents.filter((incident) =>
        Array.isArray(incident.location?.coordinates)
      ),
    [incidents]
  );

  const evacPlan = evacQuery.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end border-b border-cyber-cyan/15 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyber-cyan animate-pulse" />
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-cyber-cyan">
              COMMAND CENTER // RADAR & GIS
            </p>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
            Tactical Incident & Evacuation Map
          </h1>
          <p className="mt-0.5 text-sm font-mono text-platinum-700">
            {data
              ? isTruncated
                ? `Showing ${incidents.length} of ${totalIncidents} matching incidents. Color-coded by severity.`
                : `${incidents.length} incident${incidents.length === 1 ? "" : "s"} plotted on tactical grid.`
              : "Plotting reported incidents with dark tactical overlay."}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Button
            variant={evacMode ? "primary" : "secondary"}
            size="sm"
            onClick={() => setEvacMode(!evacMode)}
          >
            {evacMode ? "Hide Evacuation Planning" : "Dynamic Evacuation Routing"}
          </Button>

          <Select
            label="Status filter"
            value={status}
            onChange={(event) => setStatus(event.target.value as IncidentStatus | "")}
            className="w-40"
          >
            <option value="">All statuses</option>
            {INCIDENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {getIncidentStatusMeta(value).label}
              </option>
            ))}
          </Select>
          <Select
            label="Severity filter"
            value={severity}
            onChange={(event) => setSeverity(event.target.value as Severity | "")}
            className="w-40"
          >
            <option value="">All severities</option>
            {SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {getSeverityMeta(value).label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {evacMode && (
        <Card title="Dynamic Evacuation Route Planner" description="Calculate safe evacuation corridors avoiding hazards & road closures">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 items-end">
            <div>
              <label className="block text-xs font-mono font-bold text-platinum-700 mb-1">Origin Lat</label>
              <input
                value={originLat}
                onChange={(e) => setOriginLat(e.target.value)}
                className="w-full rounded bg-tactical-800 border border-cyber-cyan/30 px-3 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-mono font-bold text-platinum-700 mb-1">Origin Lng</label>
              <input
                value={originLng}
                onChange={(e) => setOriginLng(e.target.value)}
                className="w-full rounded bg-tactical-800 border border-cyber-cyan/30 px-3 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-mono font-bold text-platinum-700 mb-1">Destination Lat</label>
              <input
                value={destLat}
                onChange={(e) => setDestLat(e.target.value)}
                className="w-full rounded bg-tactical-800 border border-cyber-cyan/30 px-3 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-mono font-bold text-platinum-700 mb-1">Destination Lng</label>
              <input
                value={destLng}
                onChange={(e) => setDestLng(e.target.value)}
                className="w-full rounded bg-tactical-800 border border-cyber-cyan/30 px-3 py-1.5 text-sm text-white"
              />
            </div>
          </div>

          {evacPlan?.message && (
            <div className="mt-3 p-3 bg-alert-red/20 border border-alert-red rounded text-sm text-alert-red font-medium">
              {evacPlan.message}
            </div>
          )}

          {evacPlan?.safeRoutes && evacPlan.safeRoutes.length > 0 && (
            <div className="mt-4 space-y-3">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyber-cyan">Calculated Evacuation Routes</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {evacPlan.safeRoutes.map((route: EvacuationRoute) => (
                  <div
                    key={route.routeId}
                    onClick={() => setSelectedRouteId(route.routeId)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedRouteId === route.routeId ? "border-cyber-cyan bg-cyber-cyan/10" : "border-platinum-700 bg-tactical-800"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-sm text-white">{route.name}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        route.riskLevel === "LOW" ? "bg-safe-green/20 text-safe-green" :
                        route.riskLevel === "MEDIUM" ? "bg-warn-amber/20 text-warn-amber" : "bg-alert-red/20 text-alert-red"
                      }`}>
                        Risk: {route.riskLevel}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-platinum-700">Distance: {route.distanceKm} km | Est Time: {route.estimatedTimeMins} mins</p>
                    {route.warning && <p className="mt-1 text-xs text-warn-amber">{route.warning}</p>}
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.success(`Evacuation route "${route.name}" broadcasted to responders.`);
                        }}
                      >
                        Share with Responders
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => void queryClient.invalidateQueries({ queryKey: listKey })}
        loadingMessage="Acquiring GPS coordinates & map telemetry…"
        errorTitle="Unable to load tactical map"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card
            className="lg:col-span-2 overflow-hidden p-0"
            title="Geospatial Tactical Radar"
            description={
              withLocation.length < incidents.length
                ? `${incidents.length - withLocation.length} incident(s) lack coordinates.`
                : "OpenStreetMap Dark Tactical Projection"
            }
          >
            <div className="h-[28rem] w-full sm:h-[34rem]">
              <MapContainer
                center={MAP_CENTER}
                zoom={12}
                className="h-full w-full"
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds incidents={withLocation} hasSelection={selected !== null} />
                <FocusIncident incident={selected} />

                {/* Render Evacuation Routes */}
                {evacPlan?.safeRoutes?.map((route: EvacuationRoute) => {
                  const isSelected = selectedRouteId === route.routeId;
                  const color = route.riskLevel === "LOW" ? "#10B981" : route.riskLevel === "MEDIUM" ? "#F59E0B" : "#EF4444";
                  return (
                    <Polyline
                      key={route.routeId}
                      positions={route.path}
                      pathOptions={{
                        color,
                        weight: isSelected ? 6 : 4,
                        opacity: isSelected ? 1.0 : 0.7,
                        dashArray: route.isAlternative ? "6, 6" : undefined,
                      }}
                    />
                  );
                })}

                {/* Render Hazard Zones */}
                {evacPlan?.hazardZones?.map((hazard: { center: [number, number]; radiusKm: number; title: string }, index: number) => (
                  <CircleMarker
                    key={`hazard-${index}`}
                    center={hazard.center}
                    radius={25}
                    pathOptions={{
                      color: "#EF4444",
                      fillColor: "#EF4444",
                      fillOpacity: 0.3,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="bg-tactical-900 text-white p-1 text-xs">
                        <strong className="text-alert-red">Hazard Zone:</strong> {hazard.title}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}

                {withLocation.map((incident) => {
                  const [lng, lat] = incident.location!.coordinates;
                  const meta = getSeverityMeta(incident.severity);
                  const isSelected = incident._id === selectedId;

                  return (
                    <CircleMarker
                      key={incident._id}
                      center={[lat, lng]}
                      radius={isSelected ? 14 : 10}
                      pathOptions={{
                        color: isSelected ? "#00F3FF" : meta.color,
                        fillColor: meta.color,
                        fillOpacity: 0.85,
                        weight: isSelected ? 3 : 2,
                      }}
                      eventHandlers={{
                        click: () => setSelectedId(incident._id),
                        keypress: () => setSelectedId(incident._id),
                      }}
                    >
                      <Popup>
                        <div className="min-w-[12rem] bg-tactical-900 text-white p-1">
                          <h3 className="text-sm font-bold text-cyber-cyan">
                            {incident.title}
                          </h3>
                          <p className="mt-1 line-clamp-3 text-xs text-platinum-700">
                            {incident.description}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <IncidentStatusBadge status={incident.status} size="sm" />
                            <SeverityBadge severity={incident.severity} size="sm" />
                          </div>
                          <p className="mt-2 font-mono text-[10px] text-platinum-700">
                            REPORTED: {new Date(incident.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
          </Card>

          <div className="space-y-4">
            <Card
              title="Selected Incident Telemetry"
              description="Live synchronized feed"
            >
              {selected ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <IncidentStatusBadge status={selected.status} />
                    <SeverityBadge severity={selected.severity} />
                    <CategoryBadge category={selected.category} />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {selected.title}
                  </h3>
                  <p className="text-sm text-platinum-700">{selected.description}</p>

                  <dl className="space-y-2 border-t border-cyber-cyan/15 pt-3 font-mono text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-platinum-700">Address / Location</dt>
                      <dd className="text-right font-medium text-platinum-800 truncate max-w-[12rem]">
                        {selected.address ?? "Not recorded"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-platinum-700">Coordinates</dt>
                      <dd className="text-right text-cyber-cyan">
                        {selected.location
                          ? `${selected.location.coordinates[1].toFixed(4)}, ${selected.location.coordinates[0].toFixed(4)}`
                          : "Unavailable"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-platinum-700">Priority Score</dt>
                      <dd className="text-right font-bold text-warn-amber">
                        {selected.priority ?? 0}/10
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-platinum-700">Timestamp</dt>
                      <dd className="text-right text-platinum-700">
                        {new Date(selected.createdAt).toLocaleString()}
                      </dd>
                    </div>
                  </dl>

                  <ButtonLink
                    to={`/incidents/${selected._id}`}
                    fullWidth
                    variant="secondary"
                  >
                    Open full incident record
                  </ButtonLink>
                </div>
              ) : (
                <p className="py-6 text-center font-mono text-xs text-platinum-700">
                  Select a radar marker or list item to inspect incident telemetry.
                </p>
              )}
            </Card>

            <Card
              title="Plotted Incidents"
              description={`${withLocation.length} active markers`}
              flush
            >
              {withLocation.length === 0 ? (
                <p className="px-4 py-8 text-center font-mono text-xs text-platinum-700">
                  No incidents with recorded GPS coordinates.
                </p>
              ) : (
                <ul className="max-h-72 divide-y divide-cyber-cyan/10 overflow-y-auto">
                  {withLocation.map((incident) => {
                    const isSelected = incident._id === selectedId;
                    return (
                      <li key={incident._id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(incident._id)}
                          aria-current={isSelected ? "true" : undefined}
                          className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyber-cyan ${
                            isSelected
                              ? "bg-cyber-cyan/15 border-l-2 border-cyber-cyan text-white"
                              : "hover:bg-cyber-cyan/5 text-platinum-700"
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {incident.title}
                            </span>
                            <span className="mt-1 flex items-center gap-1.5">
                              <SeverityBadge
                                severity={incident.severity}
                                size="sm"
                              />
                              <IncidentStatusBadge
                                status={incident.status}
                                size="sm"
                              />
                            </span>
                          </span>
                          {reconciled.includes(incident._id) && (
                            <span
                              className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-wider text-safe-green bg-safe-green/10 px-1.5 py-0.5 rounded border border-safe-green/30"
                              title="Updated from live telemetry stream"
                            >
                              SYNC
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </QueryState>
    </div>
  );
};

export default IncidentMapPage;
