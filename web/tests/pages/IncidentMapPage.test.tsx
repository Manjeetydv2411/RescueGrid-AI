import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockList = vi.fn();
const mockGet = vi.fn();

/**
 * The socket subscription stub.
 *
 * The signature is given explicitly so the recorded calls are typed: an
 * inferred `() => () => void` would make every call a zero-length tuple, and
 * reading the event name out of one would not type-check.
 */
const mockOnEvent = vi.fn<
  (event: string, handler: (data: unknown) => void) => () => void
>(() => () => {});

/**
 * Leaflet needs a real layout engine, so the map components are replaced with
 * plain elements. The marker keeps the centre and the click handler the page
 * passes it, so the test can still assert on what the page plots and what it
 * does when a marker is activated.
 *
 * The popup's contents are not rendered: they repeat the incident title and
 * detail the side list already shows, and duplicating them would make every
 * text assertion ambiguous.
 */
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => (
    <div aria-label="incident map">{children}</div>
  ),
  TileLayer: () => <div aria-label="map tiles" />,
  CircleMarker: ({
    center,
    eventHandlers,
  }: {
    center: [number, number];
    eventHandlers?: { click?: () => void };
  }) => (
    <button
      type="button"
      aria-label={`marker ${center[0]} ${center[1]}`}
      onClick={() => eventHandlers?.click?.()}
    />
  ),
  Popup: () => <div aria-label="marker popup" />,
  useMap: () => ({
    setView: vi.fn(),
    fitBounds: vi.fn(),
    flyTo: vi.fn(),
    getZoom: () => 12,
  }),
}));

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/services/api")
  >("../../src/services/api");
  return {
    ...actual,
    incidentApi: {
      list: (...args: unknown[]) => mockList(...args),
      get: (...args: unknown[]) => mockGet(...args),
    },
  };
});

vi.mock("../../src/hooks/useSocket", () => ({
  SOCKET_EVENTS: {
    INCIDENT_CREATED: "incident:created",
    INCIDENT_UPDATED: "incident:updated",
    INCIDENT_STATUS_CHANGED: "incident:status-changed",
    INCIDENT_ASSIGNED: "incident:assigned",
    INCIDENT_UNASSIGNED: "incident:unassigned",
  },
  useSocket: () => ({ onEvent: mockOnEvent }),
}));

import IncidentMapPage from "../../src/pages/Map/IncidentMapPage";

const activeIncident = {
  _id: "i1",
  title: "Flash flood on Riverside Drive",
  description: "Water rising rapidly across the low-lying road.",
  severity: "HIGH" as const,
  category: "FLOOD" as const,
  status: "ACTIVE" as const,
  priority: 8,
  location: { type: "Point" as const, coordinates: [-122.4, 37.77] },
  address: "Riverside Drive",
  reportedBy: null,
  assignedTo: null,
  tags: [],
  version: 1,
  createdAt: "2026-01-05T10:00:00.000Z",
  updatedAt: "2026-01-05T11:00:00.000Z",
};

const paginated = (data: unknown[], total = data.length) => ({
  data,
  pagination: {
    page: 1,
    limit: 200,
    total,
    totalPages: Math.max(Math.ceil(total / 200), 1),
    hasMore: false,
  },
});

const MARKER = "marker 37.77 -122.4";

const renderMap = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  // The page links to the full incident record, so it needs a router.
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <IncidentMapPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

  return queryClient;
};

/**
 * Wait until no request is in flight.
 *
 * The live event is reconciled against the list the page is showing. If the
 * list request were still in flight it could land afterwards and overwrite
 * the reconciled cache, so the tests wait for the request to settle first.
 */
const settle = (queryClient: QueryClient) =>
  waitFor(() => {
    expect(queryClient.isFetching()).toBe(0);
  });

/**
 * The handler the page most recently registered for a socket event.
 *
 * The page re-subscribes whenever its filters change, so the last
 * registration is the one bound to the current list — an earlier one would
 * write to a cache key the page is no longer reading.
 */
const handlerFor = (event: string) => {
  const calls = mockOnEvent.mock.calls.filter((call) => call[0] === event);
  const call = calls[calls.length - 1];
  return call?.[1];
};

describe("IncidentMapPage", () => {
  beforeEach(() => {
    mockList.mockReset();
    mockGet.mockReset();
    mockOnEvent.mockReset();
    mockOnEvent.mockImplementation(() => () => {});

    mockList.mockResolvedValue(paginated([activeIncident]));
  });

  it("plots the incidents it receives", async () => {
    renderMap();

    await waitFor(() => {
      expect(
        screen.getByText("Flash flood on Riverside Drive")
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: MARKER })).toBeInTheDocument();
  });

  it("keeps the selected incident's details in step with the marker", async () => {
    renderMap();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: MARKER })).toBeInTheDocument();
    });

    // Nothing is selected yet.
    expect(screen.getByText(/select a (radar )?marker/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: MARKER }));

    await waitFor(() => {
      expect(screen.getByText("Riverside Drive")).toBeInTheDocument();
    });
  });

  it("states how many incidents were omitted when the map is truncated", async () => {
    mockList.mockResolvedValue(paginated([activeIncident], 12));

    renderMap();

    await waitFor(() => {
      expect(
        screen.getByText(/showing 1 of 12 matching incidents/i)
      ).toBeInTheDocument();
    });
  });

  it("reports a failure to load the map rather than showing an empty map", async () => {
    mockList.mockRejectedValue(new Error("Service unavailable"));

    renderMap();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Service unavailable");
    });
  });

  it("removes a live incident that no longer matches the active filter", async () => {
    // The map is filtered to active incidents. An incident that has just been
    // closed no longer belongs in that set, so a live event about it must
    // take it off the map rather than leave it plotted as active.
    const queryClient = renderMap();

    await waitFor(() => {
      expect(
        screen.getByText("Flash flood on Riverside Drive")
      ).toBeInTheDocument();
    });

    // Filter the map to active incidents. The list request is re-issued with
    // the filter, and the page re-subscribes with a handler bound to the
    // filtered list.
    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: "ACTIVE" },
    });

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ACTIVE" })
      );
    });
    await settle(queryClient);

    mockGet.mockResolvedValue({ ...activeIncident, status: "CLOSED" });

    const onStatusChanged = handlerFor("incident:status-changed");
    expect(onStatusChanged).toBeDefined();

    onStatusChanged?.({ incidentId: "i1" });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith("i1");
    });

    await waitFor(() => {
      expect(
        screen.queryByText("Flash flood on Riverside Drive")
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: MARKER })
    ).not.toBeInTheDocument();
  });

  it("keeps a live incident that still matches the filter", async () => {
    const queryClient = renderMap();

    await waitFor(() => {
      expect(
        screen.getByText("Flash flood on Riverside Drive")
      ).toBeInTheDocument();
    });
    await settle(queryClient);

    mockGet.mockResolvedValue({
      ...activeIncident,
      title: "Flash flood on Riverside Drive (updated)",
    });

    const onUpdated = handlerFor("incident:updated");
    expect(onUpdated).toBeDefined();

    onUpdated?.({ incidentId: "i1" });

    await waitFor(() => {
      expect(
        screen.getByText("Flash flood on Riverside Drive (updated)")
      ).toBeInTheDocument();
    });
  });
});
