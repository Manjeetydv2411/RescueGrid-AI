
import { useEffect, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface LocationResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  address: string;
  onLocationChange: (
    address: string,
    latitude: number,
    longitude: number
  ) => void;
}

// Queue requests to avoid sending geocoding requests too frequently.
let requestQueue: Promise<unknown> = Promise.resolve();
let lastRequestTime = 0;

function nominatimRequest(url: string): Promise<unknown> {
  const request = requestQueue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastRequestTime));

    if (wait > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, wait));
    }

    lastRequestTime = Date.now();

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(
        "Location service is unavailable. Please try again shortly."
      );
    }

    return response.json() as Promise<unknown>;
  });

  requestQueue = request.then(
    () => undefined,
    () => undefined
  );

  return request;
}

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:30px;line-height:32px;filter:drop-shadow(0 2px 3px #000)">📍</div>',
  iconSize: [30, 32],
  iconAnchor: [15, 30],
});

function isValidLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function MapCenter({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView([latitude, longitude], Math.max(map.getZoom(), 13));
  }, [map, latitude, longitude]);

  return null;
}

function MapClickHandler({
  onPick,
}: {
  onPick: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export default function LocationPicker({
  latitude,
  longitude,
  address,
  onLocationChange,
}: LocationPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  // Keep editable input values synchronized with the parent form.
  const [latitudeInput, setLatitudeInput] = useState(String(latitude));
  const [longitudeInput, setLongitudeInput] = useState(String(longitude));

  useEffect(() => {
    setLatitudeInput(String(latitude));
  }, [latitude]);

  useEffect(() => {
    setLongitudeInput(String(longitude));
  }, [longitude]);

  const hasValidCoordinates =
    isValidLatitude(latitude) && isValidLongitude(longitude);

  // A safe map center is used until valid coordinates are selected.
  const mapLatitude = hasValidCoordinates ? latitude : 28.6139;
  const mapLongitude = hasValidCoordinates ? longitude : 77.209;

  function updateLatitude(value: string) {
    setLatitudeInput(value);

    const nextLatitude = Number(value);

    if (
      value.trim() === "" ||
      !isValidLatitude(nextLatitude) ||
      !isValidLongitude(longitude)
    ) {
      return;
    }

    onLocationChange(address, nextLatitude, longitude);
  }

  function updateLongitude(value: string) {
    setLongitudeInput(value);

    const nextLongitude = Number(value);

    if (
      value.trim() === "" ||
      !isValidLongitude(nextLongitude) ||
      !isValidLatitude(latitude)
    ) {
      return;
    }

    onLocationChange(address, latitude, nextLongitude);
  }

  async function searchAddress() {
    const searchQuery = query.trim();

    if (!searchQuery) {
      setError("Enter an address, landmark, or place to search.");
      setResults([]);
      return;
    }

    setSearching(true);
    setError("");
    setResults([]);

    try {
      const url =
        "https://nominatim.openstreetmap.org/search?" +
        new URLSearchParams({
          format: "jsonv2",
          q: searchQuery,
          limit: "5",
          addressdetails: "1",
        });

      const data = (await nominatimRequest(url)) as LocationResult[];

      if (data.length === 0) {
        setError("No matching places found. Try a more specific address.");
      }

      setResults(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to search locations."
      );
    } finally {
      setSearching(false);
    }
  }

  async function pickLocation(
    lat: number,
    lng: number,
    selectedAddress?: string
  ) {
    if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
      setError("Please select valid coordinates.");
      return;
    }

    // Update the parent form and coordinate inputs immediately.
    onLocationChange(selectedAddress ?? address, lat, lng);
    setLatitudeInput(String(lat));
    setLongitudeInput(String(lng));
    setResults([]);
    setError("");

    if (selectedAddress) {
      setQuery(selectedAddress);
      return;
    }

    setResolving(true);

    try {
      const url =
        "https://nominatim.openstreetmap.org/reverse?" +
        new URLSearchParams({
          format: "jsonv2",
          lat: String(lat),
          lon: String(lng),
        });

      const result = (await nominatimRequest(url)) as {
        display_name?: string;
      };

      if (result.display_name) {
        onLocationChange(result.display_name, lat, lng);
        setQuery(result.display_name);
      } else {
        setError("Coordinates selected, but no address was found.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to resolve the selected address."
      );
    } finally {
      setResolving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-cyber-cyan/20 bg-tactical-900/60 p-4">
      <div>
        <h3 className="font-mono text-sm font-bold text-cyber-cyan">
          Exact Incident Location
        </h3>

        <p className="mt-1 text-xs text-platinum-700">
          Search for a place, select a result, click the map, or drag
          the marker to refine the location.
        </p>
      </div>

      {/* Address search */}
      <div className="flex gap-2">
        <input
          aria-label="Search address or landmark"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void searchAddress();
            }
          }}
          placeholder="Search address, landmark, or nearby place..."
          className="min-w-0 flex-1 rounded-lg border border-cyber-cyan/20 bg-tactical-800 px-3 py-2 text-sm text-white"
        />

        <button
          type="button"
          onClick={() => void searchAddress()}
          disabled={searching}
          className="rounded-lg bg-cyber-cyan px-4 py-2 text-sm font-bold text-tactical-950 disabled:opacity-50"
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {results.map((result) => (
            <button
              type="button"
              key={result.place_id}
              onClick={() =>
                void pickLocation(
                  Number(result.lat),
                  Number(result.lon),
                  result.display_name
                )
              }
              className="block w-full rounded-md border border-cyber-cyan/10 p-2 text-left text-sm text-platinum-900 hover:bg-cyber-cyan/10"
            >
              {result.display_name}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-alert-red">
          {error}
        </p>
      )}

      {/* Editable coordinates */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="incident-latitude"
            className="mb-1 block text-xs font-mono font-bold uppercase tracking-wider text-platinum-700"
          >
            Latitude
          </label>

          <input
            id="incident-latitude"
            aria-label="Latitude"
            type="number"
            step="any"
            min="-90"
            max="90"
            value={latitudeInput}
            onChange={(event) => updateLatitude(event.target.value)}
            className="block w-full rounded-lg border border-cyber-cyan/20 bg-tactical-800 px-3 py-2 text-sm text-white focus:border-cyber-cyan focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
          />
        </div>

        <div>
          <label
            htmlFor="incident-longitude"
            className="mb-1 block text-xs font-mono font-bold uppercase tracking-wider text-platinum-700"
          >
            Longitude
          </label>

          <input
            id="incident-longitude"
            aria-label="Longitude"
            type="number"
            step="any"
            min="-180"
            max="180"
            value={longitudeInput}
            onChange={(event) => updateLongitude(event.target.value)}
            className="block w-full rounded-lg border border-cyber-cyan/20 bg-tactical-800 px-3 py-2 text-sm text-white focus:border-cyber-cyan focus:outline-none focus:ring-2 focus:ring-cyber-cyan"
          />
        </div>
      </div>

      {/* Map */}
      <div className="h-72 overflow-hidden rounded-lg border border-cyber-cyan/20">
        <MapContainer
          center={[mapLatitude, mapLongitude]}
          zoom={13}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapCenter
            latitude={mapLatitude}
            longitude={mapLongitude}
          />

          <MapClickHandler
            onPick={(lat, lng) => void pickLocation(lat, lng)}
          />

          {hasValidCoordinates && (
            <Marker
              position={[latitude, longitude]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend(event) {
                  const marker = event.target as L.Marker;
                  const point = marker.getLatLng();

                  void pickLocation(point.lat, point.lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className="text-xs text-platinum-700">
        <p>
          <strong>Selected address:</strong>{" "}
          {address || "Not selected"}
        </p>

        <p className="mt-1">
          <strong>Coordinates:</strong>{" "}
          {hasValidCoordinates
            ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            : "Not selected"}
        </p>

        {resolving && (
          <p className="mt-1">Finding the address...</p>
        )}
      </div>
    </section>
  );
}
