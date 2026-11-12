import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LiveActivityFeed from "../components/dashboard/LiveActivityFeed";

const { mockOnEvent } = vi.hoisted(() => ({
  mockOnEvent: vi.fn(),
}));

vi.mock("../hooks/useSocket", () => ({
  SOCKET_EVENTS: {
    INCIDENT_CREATED: "incident:created",
    INCIDENT_UPDATED: "incident:updated",
    INCIDENT_STATUS_CHANGED: "incident:status-changed",
    INCIDENT_ASSIGNED: "incident:assigned",
    RESOURCE_CREATED: "resource:created",
    RESOURCE_STATUS_CHANGED: "resource:status-changed",
    ASSIGNMENT_CREATED: "assignment:created",
    ASSIGNMENT_STATUS_CHANGED: "assignment:status-changed",
  },

  useSocket: () => ({
    isConnected: true,
    onEvent: mockOnEvent,
  }),
}));

describe("LiveActivityFeed Component", () => {
  it("renders stream active state and displays incoming telemetry activity", () => {
    mockOnEvent.mockImplementation(
      (event: string, handler: (data: any) => void) => {
        if (event === "incident:created") {
          handler({
            title: "Test Flood Emergency",
            severity: "CRITICAL",
            category: "FLOOD",
            status: "REPORTED",
          });
        }

        return () => {};
      }
    );

    render(<LiveActivityFeed />);

    expect(
      screen.getByText("Live Telemetry Activity Feed")
    ).toBeInTheDocument();

    expect(screen.getByText("STREAM ACTIVE")).toBeInTheDocument();

    expect(
      screen.getByText("Test Flood Emergency")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Severity: CRITICAL • Category: FLOOD")
    ).toBeInTheDocument();
  });
});