import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  AssignmentStatusBadge,
  CategoryBadge,
  IncidentStatusBadge,
  ResourceStatusBadge,
  RoleBadge,
  SeverityBadge,
} from "../../src/components/common/StatusBadge";
import {
  INCIDENT_STATUS_META,
  SEVERITY_META,
  getAssignmentStatusMeta,
  getIncidentStatusMeta,
  getResourceStatusMeta,
  getSeverityMeta,
} from "../../src/utils/domain";

describe("StatusBadge components", () => {
  it("renders the canonical incident status label", () => {
    render(<IncidentStatusBadge status="ACTIVE" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders the canonical severity label", () => {
    render(<SeverityBadge severity="CRITICAL" />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("falls back to Unknown for an unrecognised status", () => {
    render(<IncidentStatusBadge status="NOT_A_STATUS" />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("uses the same label for the same status everywhere", () => {
    // The domain module is the single source of truth; the badge must not
    // re-label a status differently from the metadata.
    render(
      <>
        <IncidentStatusBadge status="REPORTED" />
        <IncidentStatusBadge status="REPORTED" label={INCIDENT_STATUS_META.REPORTED.label} />
      </>
    );
    expect(screen.getAllByText("Reported")).toHaveLength(2);
  });

  it("exposes the status description as a tooltip", () => {
    render(<IncidentStatusBadge status="CLOSED" />);
    const badge = screen.getByText("Closed");
    expect(badge).toHaveAttribute(
      "title",
      INCIDENT_STATUS_META.CLOSED.description
    );
  });

  it("renders resource, assignment, category, and role badges", () => {
    const { rerender } = render(<ResourceStatusBadge status="ON_MISSION" />);
    expect(screen.getByText("On Mission")).toBeInTheDocument();

    rerender(<AssignmentStatusBadge status="PENDING" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();

    rerender(<CategoryBadge category="EARTHQUAKE" />);
    expect(screen.getByText("Earthquake")).toBeInTheDocument();

    rerender(<RoleBadge role="COORDINATOR" />);
    expect(screen.getByText("Coordinator")).toBeInTheDocument();
  });
});

describe("domain metadata", () => {
  it("maps every incident status to a label and tone", () => {
    for (const status of Object.keys(INCIDENT_STATUS_META)) {
      const meta = getIncidentStatusMeta(status);
      expect(meta.label).toBeTruthy();
      expect(meta.tone).toBeTruthy();
    }
  });

  it("maps every severity to a label", () => {
    for (const severity of Object.keys(SEVERITY_META)) {
      expect(getSeverityMeta(severity).label).toBeTruthy();
    }
  });

  it("returns the neutral fallback for missing values", () => {
    expect(getIncidentStatusMeta(undefined).label).toBe("Unknown");
    expect(getSeverityMeta(undefined).tone).toBe("gray");
    expect(getResourceStatusMeta("").label).toBe("Unknown");
    expect(getAssignmentStatusMeta(undefined).label).toBe("Unknown");
  });
});
