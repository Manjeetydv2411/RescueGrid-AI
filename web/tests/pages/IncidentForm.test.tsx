import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/services/api")
  >("../../src/services/api");
  return {
    ...actual,
    incidentApi: {
      get: (...args: unknown[]) => mockGet(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  };
});

import IncidentForm from "../../src/pages/Incidents/IncidentForm";

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

const renderForm = (path = "/incidents/i1/edit") => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/incidents/new" element={<IncidentForm />} />
          <Route path="/incidents/:id/edit" element={<IncidentForm />} />
          <Route path="/incidents/:id" element={<p>Incident detail</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

// Required fields render a trailing asterisk into their label, so the label
// text is matched with a pattern rather than an exact string.
const titleField = () => screen.getByLabelText(/^title/i);
const descriptionField = () => screen.getByLabelText(/^description/i);
const latitudeField = () => screen.getByLabelText(/^latitude/i);
const longitudeField = () => screen.getByLabelText(/^longitude/i);

describe("IncidentForm", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockUpdate.mockReset();
    mockCreate.mockReset();

    mockGet.mockResolvedValue(incident);
    mockUpdate.mockResolvedValue(incident);
    mockCreate.mockResolvedValue(incident);
  });

  it("fills the edit form with the stored incident", async () => {
    renderForm();

    await waitFor(() => {
      expect(titleField()).toHaveValue("Flash flood on Riverside Drive");
    });

    expect(descriptionField()).toHaveValue(
      "Water rising rapidly across the low-lying road."
    );
    expect(screen.getByLabelText("Severity")).toHaveValue("HIGH");
    expect(screen.getByLabelText("Category")).toHaveValue("FLOOD");
    expect(screen.getByLabelText("Address")).toHaveValue("Riverside Drive");
    expect(latitudeField()).toHaveValue(37.77);
    expect(longitudeField()).toHaveValue(-122.4);
    expect(screen.getByLabelText("Tags")).toHaveValue("flood");
  });

  it("offers only the transitions the server will accept", async () => {
    renderForm();

    await waitFor(() => {
      expect(screen.getByLabelText("Status")).toBeInTheDocument();
    });

    const options = Array.from(
      screen.getByLabelText("Status").querySelectorAll("option")
    ).map((option) => option.getAttribute("value"));

    // REPORTED may move to VERIFIED or ACTIVE. A status is never a valid
    // transition from itself, so REPORTED must not be offered.
    expect(options).toEqual(["", "VERIFIED", "ACTIVE"]);
  });

  it("saves an edit without touching the status", async () => {
    // Regression: the form used to seed its status field with the incident's
    // own status, which made every save compare the status against itself and
    // fail. Leaving the field alone must send no status at all.
    renderForm();

    await waitFor(() => {
      expect(titleField()).toHaveValue("Flash flood on Riverside Drive");
    });

    fireEvent.change(titleField(), {
      target: { value: "Flash flood on Riverside Drive (updated)" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    const payload = mockUpdate.mock.calls[0][1];
    expect(payload).not.toHaveProperty("status");
    expect(payload.title).toBe("Flash flood on Riverside Drive (updated)");
    expect(payload.severity).toBe("HIGH");
    expect(payload.category).toBe("FLOOD");
    expect(payload.location).toEqual({
      type: "Point",
      coordinates: [-122.4, 37.77],
    });
  });

  it("sends the new status when a transition is chosen", async () => {
    renderForm();

    await waitFor(() => {
      expect(screen.getByLabelText("Status")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "VERIFIED" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      "i1",
      expect.objectContaining({ status: "VERIFIED" })
    );
  });

  it("does not offer a status transition when reporting a new incident", async () => {
    renderForm("/incidents/new");

    await waitFor(() => {
      expect(titleField()).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /report incident/i })
    ).toBeInTheDocument();
  });

  it("reports a validation failure instead of calling the API", async () => {
    renderForm();

    await waitFor(() => {
      expect(titleField()).toHaveValue("Flash flood on Riverside Drive");
    });

    fireEvent.change(titleField(), { target: { value: "ab" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Title must be at least 3 characters")
      ).toBeInTheDocument();
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });
  it("surfaces a failed save as an error message", async () => {
  mockUpdate.mockRejectedValue(new Error("Service unavailable"));

  renderForm();

  await waitFor(() => {
    expect(titleField()).toHaveValue("Flash flood on Riverside Drive");
  });

  fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

  await waitFor(() => {
    expect(mockUpdate).toHaveBeenCalled();
  });

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Service unavailable"
  );
});

});
