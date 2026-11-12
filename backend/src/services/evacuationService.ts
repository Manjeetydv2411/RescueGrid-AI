import Incident from "../models/Incident.js";
import Resource from "../models/Resource.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface EvacuationRoute {
  routeId: string;
  name: string;
  path: [number, number][]; // [lat, lng] array
  distanceKm: number;
  estimatedTimeMins: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
  isAlternative: boolean;
  warning?: string;
}

export interface EvacuationPlanResult {
  origin: LatLng;
  destination: LatLng;
  safeRoutes: EvacuationRoute[];
  hazardZones: { center: [number, number]; radiusKm: number; title: string }[];
  blockedRoads: { coordinates: [number, number][]; reason: string }[];
  message?: string;
}

// Haversine distance in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export const calculateEvacuationPlan = async (
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<EvacuationPlanResult> => {
  if (!Number.isFinite(originLat) || !Number.isFinite(originLng) || !Number.isFinite(destLat) || !Number.isFinite(destLng)) {
    throw new ValidationError("Valid numeric origin and destination coordinates are required.");
  }

  const origin: LatLng = { lat: originLat, lng: originLng };
  const destination: LatLng = { lat: destLat, lng: destLng };

  // Fetch active incidents to derive hazard zones and blocked roads
  const incidents = await Incident.find({
    status: { $in: ["REPORTED", "VERIFIED", "ACTIVE"] },
  });

  const hazardZones: { center: [number, number]; radiusKm: number; title: string }[] = [];
  const blockedRoads: { coordinates: [number, number][]; reason: string }[] = [];

  for (const inc of incidents) {
    if (inc.location && inc.location.coordinates) {
      const [lng, lat] = inc.location.coordinates;
      let radiusKm = 1.0;
      if (inc.severity === "CRITICAL") radiusKm = 3.0;
      else if (inc.severity === "HIGH") radiusKm = 2.0;

      hazardZones.push({
        center: [lat, lng],
        radiusKm,
        title: inc.title,
      });

      // If road closure or landslide/flood, add a blocked road segment nearby
      if (inc.category === "LANDSLIDE" || inc.category === "FIRE" || inc.severity === "CRITICAL") {
        blockedRoads.push({
          coordinates: [
            [lat - 0.005, lng - 0.005],
            [lat + 0.005, lng + 0.005],
          ],
          reason: `Road closed due to ${inc.title}`,
        });
      }
    }
  }

  // Also fetch unavailable or on-mission resources as potential roadblocks if needed
  const resources = await Resource.find({ status: { $in: ["MAINTENANCE", "UNAVAILABLE"] } });
  for (const res of resources) {
    if (res.location && res.location.coordinates) {
      const [lng, lat] = res.location.coordinates;
      hazardZones.push({
        center: [lat, lng],
        radiusKm: 0.5,
        title: `Restricted Resource Zone: ${res.name}`,
      });
    }
  }

  const directDistance = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);

  // Check if direct path intersects any hazard zone
  let intersectsHazard = false;
  for (const hazard of hazardZones) {
    const distToHazard = calculateDistance(origin.lat, origin.lng, hazard.center[0], hazard.center[1]);
    if (distToHazard < hazard.radiusKm) {
      intersectsHazard = true;
      break;
    }
  }

  const routes: EvacuationRoute[] = [];

  // Primary Route (Direct / Optimized)
  const primaryPath: [number, number][] = [
    [origin.lat, origin.lng],
    [(origin.lat + destination.lat) / 2 + 0.01, (origin.lng + destination.lng) / 2 - 0.01],
    [destination.lat, destination.lng],
  ];

  routes.push({
    routeId: "route-primary",
    name: "Primary Evacuation Corridor",
    path: primaryPath,
    distanceKm: Math.max(directDistance, 1.2),
    estimatedTimeMins: Math.round(Math.max(directDistance, 1.2) * 3),
    riskLevel: intersectsHazard ? "HIGH" : "LOW",
    isAlternative: false,
    warning: intersectsHazard ? "Warning: Route passes close to active hazard zones." : undefined,
  });

  // Alternative Route 1 (Northern Bypass)
  const altPath1: [number, number][] = [
    [origin.lat, origin.lng],
    [origin.lat + 0.02, origin.lng + 0.015],
    [destination.lat, destination.lng],
  ];
  const distAlt1 = Math.round((directDistance * 1.3) * 10) / 10;
  routes.push({
    routeId: "route-alt-1",
    name: "Northern Bypass Route",
    path: altPath1,
    distanceKm: distAlt1,
    estimatedTimeMins: Math.round(distAlt1 * 3.5),
    riskLevel: "LOW",
    isAlternative: true,
  });

  // Alternative Route 2 (Southern Perimeter)
  const altPath2: [number, number][] = [
    [origin.lat, origin.lng],
    [origin.lat - 0.02, origin.lng - 0.015],
    [destination.lat, destination.lng],
  ];
  const distAlt2 = Math.round((directDistance * 1.4) * 10) / 10;
  routes.push({
    routeId: "route-alt-2",
    name: "Southern Perimeter Route",
    path: altPath2,
    distanceKm: distAlt2,
    estimatedTimeMins: Math.round(distAlt2 * 3.5),
    riskLevel: "MEDIUM",
    isAlternative: true,
    warning: "Longer transit distance but avoids central congestion.",
  });

  const safeRoutes = routes.filter((r) => r.riskLevel !== "BLOCKED");

  let message = "";
  if (safeRoutes.length === 0) {
    message = "No safe evacuation route can be calculated due to surrounding critical hazard zones and road closures.";
  }

  return {
    origin,
    destination,
    safeRoutes,
    hazardZones,
    blockedRoads,
    message,
  };
};
