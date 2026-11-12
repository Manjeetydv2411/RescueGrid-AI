import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { incidentApi, resourceApi } from "../../services/api";
import { SOCKET_EVENTS, useSocket } from "../../hooks/useSocket";
import type { Incident, Resource, Severity } from "../../types/api";

const MAP_CENTER: [number, number] = [37.7749, -122.4194]; // San Francisco default

const getSeverityColor = (severity: Severity): string => {
  switch (severity) {
    case "CRITICAL":
      return "#FF3366";
    case "HIGH":
      return "#FF6B00";
    case "MEDIUM":
      return "#FF9900";
    case "LOW":
      return "#00F0FF";
    default:
      return "#64748B";
  }
};

const FitBounds = ({
  incidents,
  resources,
  showIncidents,
  showResources,
}: {
  incidents: Incident[];
  resources: Resource[];
  showIncidents: boolean;
  showResources: boolean;
}) => {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [];
    if (showIncidents) {
      incidents.forEach((inc) => {
        const coords = inc.location?.coordinates;
        if (Array.isArray(coords) && coords.length === 2) {
          points.push([coords[1], coords[0]]);
        }
      });
    }
    if (showResources) {
      resources.forEach((res) => {
        const coords = res.location?.coordinates;
        if (Array.isArray(coords) && coords.length === 2) {
          points.push([coords[1], coords[0]]);
        }
      });
    }

    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 13));
      return;
    }
    map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
  }, [incidents, resources, showIncidents, showResources, map]);

  return null;
};

export const TacticalMap = () => {
  const queryClient = useQueryClient();
  const { onEvent } = useSocket();

  const [showRadar, setShowRadar] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [showResources, setShowResources] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  const incidentsQuery = useQuery({
    queryKey: ["incidents", "tactical-map"],
    queryFn: () => incidentApi.list({ limit: 200 }),
    refetchInterval: 30_000,
  });

  const resourcesQuery = useQuery({
    queryKey: ["resources", "tactical-map"],
    queryFn: () => resourceApi.list({ limit: 200 }),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["incidents", "tactical-map"] });
      void queryClient.invalidateQueries({ queryKey: ["resources", "tactical-map"] });
    };
    const unsubscribers = [
      onEvent(SOCKET_EVENTS.INCIDENT_CREATED, refresh),
      onEvent(SOCKET_EVENTS.INCIDENT_UPDATED, refresh),
      onEvent(SOCKET_EVENTS.INCIDENT_STATUS_CHANGED, refresh),
      onEvent(SOCKET_EVENTS.RESOURCE_CREATED, refresh),
      onEvent(SOCKET_EVENTS.RESOURCE_UPDATED, refresh),
      onEvent(SOCKET_EVENTS.RESOURCE_STATUS_CHANGED, refresh),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, [onEvent, queryClient]);

  const incidents = useMemo(() => incidentsQuery.data?.data || [], [incidentsQuery.data]);
  const resources = useMemo(() => resourcesQuery.data?.data || [], [resourcesQuery.data]);

  const resourceCategories = useMemo(() => {
    const set = new Set<string>();
    resources.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [resources]);

  const validIncidents = useMemo(
    () =>
      incidents.filter(
        (inc) =>
          inc.location?.coordinates &&
          Array.isArray(inc.location.coordinates) &&
          inc.location.coordinates.length === 2
      ),
    [incidents]
  );

  const validResources = useMemo(
    () =>
      resources
        .filter(
          (res) =>
            res.location?.coordinates &&
            Array.isArray(res.location.coordinates) &&
            res.location.coordinates.length === 2
        )
        .filter((res) => {
          if (selectedCategory === "ALL") return true;
          return res.category?.toUpperCase() === selectedCategory.toUpperCase();
        }),
    [resources, selectedCategory]
  );

  return (
    <div className="relative h-[420px] w-full rounded-xl border border-[#1F2937] bg-[#070D1A] overflow-hidden shadow-glass">
      {/* Radar Overlay Effect & Concentric Rings */}
      {showRadar && (
        <div className="absolute inset-0 pointer-events-none z-[350] flex items-center justify-center overflow-hidden opacity-35">
          <div className="absolute h-[600px] w-[600px] rounded-full border border-[#00F0FF]/30" />
          <div className="absolute h-[420px] w-[420px] rounded-full border border-[#00F0FF]/40 border-dashed" />
          <div className="absolute h-[240px] w-[240px] rounded-full border border-[#00F0FF]/50" />
          <div className="absolute h-[80px] w-[80px] rounded-full border border-[#00F0FF]/60" />
          <div className="absolute h-full w-[1px] bg-[#00F0FF]/20" />
          <div className="absolute w-full h-[1px] bg-[#00F0FF]/20" />
          {/* Rotating Sweep */}
          <div className="absolute h-[600px] w-[600px] animate-radar-sweep bg-gradient-to-tr from-transparent via-[#00F0FF]/15 to-transparent rounded-full" />
        </div>
      )}

      {/* Compact Map Controls & Filters Overlay */}
      <div className="absolute top-3 right-3 z-[400] flex flex-wrap items-center gap-2 bg-[#111827]/95 backdrop-blur border border-[#1F2937] rounded-lg p-2 shadow-glass font-mono text-xs">
        <button
          type="button"
          onClick={() => setShowRadar((prev) => !prev)}
          aria-label="Toggle Radar Sweep & Rings"
          className={`px-2 py-1 rounded transition-colors font-bold ${
            showRadar
              ? "bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40"
              : "text-[#94A3B8] hover:text-white"
          }`}
          title="Toggle Radar Sweep & Rings"
        >
          Radar
        </button>
        <button
          type="button"
          onClick={() => setShowIncidents((prev) => !prev)}
          aria-label="Toggle Incident Markers"
          className={`px-2.5 py-1 rounded transition-colors font-bold ${
            showIncidents
              ? "bg-[#FF3366]/20 text-[#FF3366] border border-[#FF3366]/40"
              : "text-[#94A3B8] hover:text-white"
          }`}
        >
          Incidents ({validIncidents.length})
        </button>
        <button
          type="button"
          onClick={() => setShowResources((prev) => !prev)}
          aria-label="Toggle Resource Markers"
          className={`px-2.5 py-1 rounded transition-colors font-bold ${
            showResources
              ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40"
              : "text-[#94A3B8] hover:text-white"
          }`}
        >
          Resources ({validResources.length})
        </button>

        {resourceCategories.length > 0 && showResources && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter Resources by Category"
            className="rounded bg-[#151E2D] border border-[#1F2937] text-white px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#00F0FF]"
          >
            <option value="ALL">All Categories</option>
            {resourceCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Selected Resource Information Banner */}
      {selectedResource && (
        <div className="absolute bottom-3 left-3 right-3 z-[400] bg-[#111827]/95 backdrop-blur border border-[#00F0FF]/40 rounded-lg p-3 shadow-glass flex items-center justify-between font-mono text-xs text-white">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-[#10B981] animate-ping" />
            <div>
              <span className="text-[#00F0FF] font-bold">SELECTED UNIT:</span>{" "}
              <span className="font-bold text-white">{selectedResource.name}</span>
              <span className="mx-2 text-[#94A3B8]">|</span>
              <span className="text-platinum-700">Type: {selectedResource.type}</span>
              <span className="mx-2 text-[#94A3B8]">|</span>
              <span className="text-emerald-400 font-semibold">{selectedResource.status}</span>
              {selectedResource.capacity !== undefined && (
                <>
                  <span className="mx-2 text-[#94A3B8]">|</span>
                  <span className="text-platinum-700">Capacity: {selectedResource.capacity}</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedResource(null)}
            className="rounded bg-[#1F2937] px-2 py-1 text-xs text-[#94A3B8] hover:text-white transition-colors"
          >
            Deselect ✕
          </button>
        </div>
      )}

      <MapContainer
        center={MAP_CENTER}
        zoom={12}
        style={{ height: "100%", width: "100%", background: "#070D1A" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds
          incidents={validIncidents}
          resources={validResources}
          showIncidents={showIncidents}
          showResources={showResources}
        />

        {showIncidents &&
          validIncidents.map((incident) => {
            const [lng, lat] = incident.location!.coordinates;
            const color = getSeverityColor(incident.severity);

            return (
              <CircleMarker
                key={incident._id}
                center={[lat, lng]}
                radius={incident.severity === "CRITICAL" ? 9 : 8}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 0.85,
                  weight: incident.severity === "CRITICAL" ? 3 : 2,
                }}
              >
                <Popup>
                  <div className="p-2 font-mono text-xs space-y-1 text-slate-900 min-w-[200px]">
                    <div className="flex items-center justify-between border-b pb-1">
                      <span className="font-bold text-slate-900">INCIDENT</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: `${color}20`, color }}>
                        {incident.severity}
                      </span>
                    </div>
                    <p className="font-bold text-sm text-slate-900 mt-1">{incident.title}</p>
                    <p className="text-[11px] text-slate-600">Category: {incident.category}</p>
                    <p className="text-[11px] text-slate-600">Status: {incident.status}</p>
                    {incident.address && <p className="text-[11px] text-slate-600 truncate">Addr: {incident.address}</p>}
                    <div className="pt-2">
                      <Link
                        to={`/incidents/${incident._id}`}
                        className="inline-block w-full text-center bg-slate-900 text-cyan-400 font-bold py-1 px-2 rounded text-xs hover:bg-slate-800 transition-colors"
                      >
                        Inspect Incident →
                      </Link>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

        {showResources &&
          validResources.map((resource) => {
            const [lng, lat] = resource.location!.coordinates;
            const isAvailable = resource.status === "AVAILABLE";
            const isSelected = selectedResource?._id === resource._id;
            const color = isAvailable ? "#10B981" : resource.status === "ON_MISSION" ? "#FF9900" : "#64748B";

            return (
              <CircleMarker
                key={resource._id}
                center={[lat, lng]}
                radius={isSelected ? 10 : 7}
                pathOptions={{
                  color: isSelected ? "#00F0FF" : color,
                  fillColor: color,
                  fillOpacity: 0.8,
                  weight: isSelected ? 3 : 2,
                }}
                eventHandlers={{
                  click: () => setSelectedResource(resource),
                }}
              >
                <Popup>
                  <div className="p-2 font-mono text-xs space-y-1 text-slate-900 min-w-[180px]">
                    <div className="flex items-center justify-between border-b pb-1">
                      <span className="font-bold text-slate-900">RESOURCE UNIT</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {resource.status}
                      </span>
                    </div>
                    <p className="font-bold text-sm text-slate-900 mt-1">{resource.name}</p>
                    <p className="text-[11px] text-slate-600">Type: {resource.type} ({resource.category})</p>
                    {resource.capacity !== undefined && (
                      <p className="text-[11px] text-slate-600">Capacity: {resource.capacity}</p>
                    )}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedResource(resource)}
                        className="w-full text-center bg-cyan-600 text-white font-bold py-1 px-2 rounded text-xs hover:bg-cyan-700 transition-colors"
                      >
                        Select Unit
                      </button>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
      </MapContainer>
    </div>
  );
};

export default TacticalMap;
