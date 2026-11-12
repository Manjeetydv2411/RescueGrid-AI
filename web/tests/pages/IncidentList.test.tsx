import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockList = vi.fn();

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

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/services/api")
  >("../../src/services/api");
  return {
    ...actual,
    incidentApi: {
      list: (...args: unknown[]) => mockList(...args),
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

import IncidentList from "../../src/pages/Incidents/IncidentList";

const incidents = [
  {
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
    tags: ["flood"],
    version: 2,
    createdAt: "2026-01-05T10:00:00.000Z",
    updatedAt: "2026-01-05T11:00:00.000Z",
  },
  {
    _id: "i2",
    title: "Warehouse fire in Docklands",
    description: "Smoke reported from the north warehouse roof.",
    severity: "MEDIUM" as const,
    category: "FIRE" as const,
    status: "REPORTED" as const,
    priority: 5,
    location: { type: "Point" as const, coordinates: [-122.35, 37.79] },
    address: null,
    reportedBy: null,
    assignedTo: null,
    tags: [],
    version: 1,
    createdAt: "2026-01-04T09:00:00.000Z",
    updatedAt: "2026-01-04T09:00:00.000Z",
  },
];

const paginated = {
  data: incidents,
  pagination: {
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
    hasMore: false,
  },
};

const renderList = (initialEntry = "/incidents") => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <IncidentList />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("IncidentList", () => {
  beforeEach(() => {
    mockList.mockReset();
    mockList.mockResolvedValue(paginated);
  });

  it("renders one row per incident with its severity and status", async () => {
    renderList();

    await waitFor(() => {
      expect(screen.getByText("Flash flood on Riverside Drive")).toBeInTheDocument();
    });

    expect(screen.getByText("Warehouse fire in Docklands")).toBeInTheDocument();
    // Severity and status use the canonical domain labels.
    expect(screen.getAllByText("High").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Medium").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Reported").length).toBeGreaterThanOrEqual(1);
  });

  it("links each incident to its detail page", async () => {
    renderList();

    await waitFor(() => {
      expect(screen.getByText("Flash flood on Riverside Drive")).toBeInTheDocument();
    });

    const link = screen.getByText("Flash flood on Riverside Drive").closest("a");
    expect(link).toHaveAttribute("href", "/incidents/i1");
  });

  it("requests incidents with the server's pagination and sort parameters", async () => {
    renderList();

    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      })
    );
  });

  it("shows the empty state when no incidents match", async () => {
    mockList.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
    });

    renderList();

    await waitFor(() => {
      expect(screen.getByText(/no incidents match/i)).toBeInTheDocument();
    });
  });

  it("shows an error state with a retry action when the request fails", async () => {
    mockList.mockRejectedValue(new Error("Service unavailable"));

    renderList();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Service unavailable");
    });
    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
  });

  it("subscribes to live incident events", async () => {
    renderList();

    await waitFor(() => {
      expect(mockOnEvent).toHaveBeenCalled();
    });

    const events = mockOnEvent.mock.calls.map((call) => call[0]);
    expect(events).toContain("incident:created");
    expect(events).toContain("incident:status-changed");
  });

  it("applies a status filter to the request", async () => {
    renderList();

    await waitFor(() => {
      expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: "ACTIVE" },
    });

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ACTIVE" })
      );
    });
  });

  it("moves back to the last page when the current page is out of range", async () => {
    // The result set has shrunk to a single page while the URL still points
    // at page 5. The list must not claim that nothing matches.
    mockList.mockImplementation((params: { page: number }) => {
      if (params.page > 1) {
        return Promise.resolve({
          data: [],
          pagination: {
            page: params.page,
            limit: 20,
            total: 2,
            totalPages: 1,
            hasMore: false,
          },
        });
      }
      return Promise.resolve(paginated);
    });

    renderList("/incidents?page=5");

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      );
    });

    expect(
      screen.queryByText("No incidents match these filters")
    ).not.toBeInTheDocument();
  });

  it("returns to the first page when the result set becomes empty", async () => {
    mockList.mockImplementation((params: { page: number }) => {
      if (params.page > 1) {
        return Promise.resolve({
          data: [],
          pagination: {
            page: params.page,
            limit: 20,
            total: 0,
            totalPages: 0,
            hasMore: false,
          },
        });
      }
      return Promise.resolve({
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      });
    });

    renderList("/incidents?page=3");

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      );
    });
  });
});
