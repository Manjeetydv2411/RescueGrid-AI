import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockGet = vi.fn();
const mockByIncident = vi.fn();
const mockResponders = vi.fn();
const mockUpdate = vi.fn();
const mockAssign = vi.fn();
const mockUnassign = vi.fn();
const mockOnEvent = vi.fn(() => () => {});
const mockJoinIncident = vi.fn(async () => true);
const mockLeaveIncident = vi.fn(async () => true);
const mockRequestMissedUpdates = vi.fn(async () => ({
  success: true,
  incident: { version: 1 },
}));

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/services/api")
  >("../../src/services/api");
  return {
    ...actual,
    incidentApi: {
      get: (...args: unknown[]) => mockGet(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      assign: (...args: unknown[]) => mockAssign(...args),
      unassign: (...args: unknown[]) => mockUnassign(...args),
    },
    assignmentApi: {
      byIncident: (...args: unknown[]) => mockByIncident(...args),
      responders: (...args: unknown[]) => mockResponders(...args),
    },
  };
});

vi.mock("../../src/hooks/useSocket", () => ({
  SOCKET_EVENTS: {
    INCIDENT_UPDATED: "incident:updated",
    INCIDENT_STATUS_CHANGED: "incident:status-changed",
    INCIDENT_ASSIGNED: "incident:assigned",
    INCIDENT_UNASSIGNED: "incident:unassigned",
    ASSIGNMENT_CREATED: "assignment:created",
    ASSIGNMENT_STATUS_CHANGED: "assignment:status-changed",
    ASSIGNMENT_CANCELLED: "assignment:cancelled",
  },
  useSocket: () => ({
    onEvent: mockOnEvent,
    joinIncident: mockJoinIncident,
    leaveIncident: mockLeaveIncident,
    requestMissedUpdates: mockRequestMissedUpdates,
    isConnected: true,
  }),
}));

const mockUser = vi.fn();

vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockUser(),
    isAuthenticated: true,
    isLoading: false,
    hasRole: (...roles: string[]) =>
      roles.includes(mockUser()?.role ?? ""),
  }),
}));

import IncidentDetail from "../../src/pages/Incidents/IncidentDetail";

const incident = {
  _id: "i1",
  title: "Flash flood on Riverside Drive",
  description: "Water rising rapidly across the low-lying road.",
  severity: "HIGH" as const,
  category: "FLOOD" as const,
  status: "REPORTED" as const,
  priority: 8,
  location: { type: "Point" as const, coordinates: [-122.4, 37.77] },
  address: "Riverside Drive",
  reportedBy: { _id: "u1", name: "Ada Okonkwo" },
  assignedTo: null,
  tags: ["flood"],
  version: 1,
  auditLog: [],
  createdAt: "2026-01-05T10:00:00.000Z",
  updatedAt: "2026-01-05T11:00:00.000Z",
};

/** The same incident, with a responsible responder nominated. */
const assignedIncident = {
  ...incident,
  assignedTo: { _id: "u9", name: "Ravi Menon", email: "ravi@example.com" },
};

const responder = {
  _id: "u9",
  name: "Ravi Menon",
  email: "ravi@example.com",
  role: "RESPONDER" as const,
  isAvailable: true,
};

const renderDetail = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/incidents/i1"]}>
        <Routes>
          <Route
            path="/incidents/:id"
            element={<IncidentDetail />}
          />
          <Route path="/incidents" element={<p>Incident list</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("IncidentDetail", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockByIncident.mockReset();
    mockResponders.mockReset();
    mockUpdate.mockReset();
    mockAssign.mockReset();
    mockUnassign.mockReset();
    mockOnEvent.mockReset();
    mockOnEvent.mockImplementation(() => () => {});
    mockUser.mockReset();
    mockRequestMissedUpdates.mockReset();
    mockRequestMissedUpdates.mockResolvedValue({
      success: true,
      incident: { version: 1 },
    });

    mockGet.mockResolvedValue(incident);
    mockByIncident.mockResolvedValue([]);
    mockResponders.mockResolvedValue([]);
  });

  it("shows the incident record and its status timeline", async () => {
    mockUser.mockReturnValue({ _id: "u1", role: "VIEWER" });
    renderDetail();

    await waitFor(() => {
      expect(
        screen.getByText("Flash flood on Riverside Drive")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Status timeline")).toBeInTheDocument();
    expect(screen.getByText("Riverside Drive")).toBeInTheDocument();
  });

  it("reports a failure to load dispatched units instead of claiming there are none", async () => {
    // The API refuses this read for a user who is neither a coordinator nor
    // an involved responder. Reporting "no responders dispatched" would be a
    // false statement about the incident.
    mockUser.mockReturnValue({ _id: "u2", role: "VIEWER" });
    mockByIncident.mockRejectedValue(
      new Error("Not authorized to view these assignments")
    );

    renderDetail();

    await waitFor(() => {
      expect(
        screen.getByText("Unable to load dispatched units")
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByText("No responders dispatched")
    ).not.toBeInTheDocument();
  });

  it("does not offer workflow actions to a viewer", async () => {
    mockUser.mockReturnValue({ _id: "u2", role: "VIEWER" });
    renderDetail();

    await waitFor(() => {
      expect(
        screen.getByText("Flash flood on Riverside Drive")
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: /mark as/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /dispatch responder/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /edit incident/i })
    ).not.toBeInTheDocument();
  });

  it("offers workflow actions to a coordinator", async () => {
    mockUser.mockReturnValue({ _id: "u3", role: "COORDINATOR" });
    renderDetail();

    await waitFor(() => {
      expect(
        screen.getByText("Flash flood on Riverside Drive")
      ).toBeInTheDocument();
    });

    // REPORTED may move to VERIFIED or ACTIVE.
    expect(
      screen.getByRole("button", { name: /mark as verified/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /dispatch responder/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit incident/i })).toBeInTheDocument();
  });

  it("moves the incident through the workflow and reports the new status", async () => {
    mockUser.mockReturnValue({ _id: "u3", role: "COORDINATOR" });
    mockUpdate.mockResolvedValue({ ...incident, status: "VERIFIED" });

    renderDetail();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /mark as verified/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /mark as verified/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith("i1", { status: "VERIFIED" });
    });
  });

  it("joins the incident room on mount and leaves it on unmount", async () => {
    mockUser.mockReturnValue({ _id: "u1", role: "VIEWER" });
    const { unmount } = renderDetail();

    await waitFor(() => {
      expect(mockJoinIncident).toHaveBeenCalledWith("i1");
    });

    unmount();
    expect(mockLeaveIncident).toHaveBeenCalledWith("i1");
  });

  it("asks the server for missed updates after joining the room", async () => {
    // Events that arrive while the socket is disconnected are never
    // delivered, so the client reconciles against the server on join.
    mockUser.mockReturnValue({ _id: "u1", role: "VIEWER" });
    renderDetail();

    await waitFor(() => {
      expect(mockRequestMissedUpdates).toHaveBeenCalledWith("i1");
    });
  });

  it("refetches when the server is on a newer version than the local copy", async () => {
    mockUser.mockReturnValue({ _id: "u1", role: "VIEWER" });
    mockGet.mockResolvedValue({ ...incident, version: 1 });
    mockRequestMissedUpdates.mockResolvedValue({
      success: true,
      incident: { version: 7 },
    });

    renderDetail();

    await waitFor(() => {
      expect(mockGet.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it("does not refetch when the server is not ahead of the local copy", async () => {
    // The reconciliation runs on every join, so a refetch on every load
    // would be needless traffic — the point is to catch up, not to poll.
    mockUser.mockReturnValue({ _id: "u1", role: "VIEWER" });
    mockGet.mockResolvedValue({ ...incident, version: 4 });
    mockRequestMissedUpdates.mockResolvedValue({
      success: true,
      incident: { version: 4 },
    });

    renderDetail();

    await waitFor(() => {
      expect(mockRequestMissedUpdates).toHaveBeenCalledWith("i1");
    });

    // Give any stray invalidation a chance to fire before asserting.
    await waitFor(() => {
      expect(screen.getByText("Flash flood on Riverside Drive")).toBeInTheDocument();
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  describe("responsible responder", () => {
    it("names the responder responsible for the incident", async () => {
      // The dashboard counts unassigned incidents from this field, so the
      // record has to say who is answerable for it rather than leaving the
      // answer to be inferred.
      mockUser.mockReturnValue({ _id: "u1", role: "VIEWER" });
      mockGet.mockResolvedValue(assignedIncident);

      renderDetail();

      await waitFor(() => {
        expect(screen.getByText("Ravi Menon")).toBeInTheDocument();
      });
    });

    it("reports an incident with no responsible responder as unassigned", async () => {
      mockUser.mockReturnValue({ _id: "u1", role: "VIEWER" });
      mockGet.mockResolvedValue(incident);

      renderDetail();

      await waitFor(() => {
        expect(
          screen.getByText("Flash flood on Riverside Drive")
        ).toBeInTheDocument();
      });

      expect(screen.getByText("Unassigned")).toBeInTheDocument();
    });

    it("offers a coordinator the action that nominates a responder", async () => {
      // Without this, the "unassigned" count on the dashboard is a number the
      // operator can read but not act on.
      mockUser.mockReturnValue({ _id: "u3", role: "COORDINATOR" });
      mockGet.mockResolvedValue(incident);

      renderDetail();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /set responsible responder/i })
        ).toBeInTheDocument();
      });
    });

    it("does not offer the responder action to a viewer", async () => {
      mockUser.mockReturnValue({ _id: "u2", role: "VIEWER" });
      mockGet.mockResolvedValue(assignedIncident);

      renderDetail();

      await waitFor(() => {
        expect(screen.getByText("Ravi Menon")).toBeInTheDocument();
      });

      expect(
        screen.queryByRole("button", { name: /set responsible responder/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /clear responsible responder/i })
      ).not.toBeInTheDocument();
    });

    it("nominates the chosen responder through the API", async () => {
      mockUser.mockReturnValue({ _id: "u3", role: "COORDINATOR" });
      mockGet.mockResolvedValue(incident);
      mockResponders.mockResolvedValue([responder]);
      mockAssign.mockResolvedValue(assignedIncident);

      renderDetail();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /set responsible responder/i })
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole("button", { name: /set responsible responder/i })
      );

      await waitFor(() => {
        expect(screen.getByText("Ravi Menon")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /Ravi Menon/ }));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /make ravi menon responsible/i })
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole("button", { name: /make ravi menon responsible/i })
      );

      await waitFor(() => {
        expect(mockAssign).toHaveBeenCalledWith("i1", "u9");
      });
    });

    it("clears the responsible responder through the API", async () => {
      mockUser.mockReturnValue({ _id: "u3", role: "COORDINATOR" });
      mockGet.mockResolvedValue(assignedIncident);
      mockUnassign.mockResolvedValue(incident);

      renderDetail();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /clear responsible responder/i })
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole("button", { name: /clear responsible responder/i })
      );

      await waitFor(() => {
        expect(mockUnassign).toHaveBeenCalledWith("i1");
      });
    });
  });
});
