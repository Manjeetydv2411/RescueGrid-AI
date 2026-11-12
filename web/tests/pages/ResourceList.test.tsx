import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateAvailability = vi.fn();
const mockOnEvent = vi.fn<(event: string, handler: (data: unknown) => void) => () => void>(
  () => () => {}
);
const mockRole = vi.fn();

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/services/api")
  >("../../src/services/api");
  return {
    ...actual,
    resourceApi: {
      list: (...args: unknown[]) => mockList(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      updateAvailability: (...args: unknown[]) => mockUpdateAvailability(...args),
    },
  };
});

vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { _id: "u1", name: "Test operator", email: "operator@example.test", role: mockRole() },
  }),
}));

vi.mock("../../src/hooks/useSocket", () => ({
  SOCKET_EVENTS: {
    RESOURCE_CREATED: "resource:created",
    RESOURCE_UPDATED: "resource:updated",
    RESOURCE_STATUS_CHANGED: "resource:status-changed",
  },
  useSocket: () => ({ onEvent: mockOnEvent }),
}));

import ResourceList from "../../src/pages/Resources/ResourceList";

const paginatedResources = {
  data: [],
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasMore: false,
  },
};

const createdResource = {
  _id: "r1",
  name: "Northside rescue boat",
  type: "Water rescue unit",
  category: "Rescue",
  status: "AVAILABLE" as const,
  location: { type: "Point" as const, coordinates: [-122.4194, 37.7749] as [number, number] },
  capacity: 6,
  contact: "Radio channel 4",
  lastUpdated: "2026-01-05T11:00:00.000Z",
};

const renderList = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/resources"]}>
        <ResourceList />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const openCreateDialog = async () => {
  renderList();
  await waitFor(() => expect(mockList).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByRole("button", { name: /add resource/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /add resource/i }));
  return screen.getByRole("dialog");
};

const fillValidForm = (dialog: HTMLElement) => {
  fireEvent.change(within(dialog).getByLabelText(/^Resource name/i), {
    target: { value: "Northside rescue boat" },
  });
  fireEvent.change(within(dialog).getByLabelText(/^Resource type/i), {
    target: { value: "Water rescue unit" },
  });
  fireEvent.change(within(dialog).getByLabelText(/^Category/i), {
    target: { value: "Rescue" },
  });
  fireEvent.change(within(dialog).getByLabelText(/^Capacity/i), {
    target: { value: "6" },
  });
  fireEvent.change(within(dialog).getByLabelText(/^Contact/i), {
    target: { value: "Radio channel 4" },
  });
};

describe("ResourceList creation and editing workflow", () => {
  beforeEach(() => {
    mockRole.mockReset();
    mockList.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockUpdateAvailability.mockReset();
    mockOnEvent.mockClear();

    mockRole.mockReturnValue("ADMIN");
    mockList.mockResolvedValue(paginatedResources);
    mockCreate.mockResolvedValue(createdResource);
    mockUpdate.mockResolvedValue({ ...createdResource, name: "Updated rescue boat" });
  });

  it.each(["ADMIN", "COORDINATOR"])(
    "shows the Add Resource action to %s users",
    async (role) => {
      mockRole.mockReturnValue(role);
      renderList();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /add resource/i })).toBeInTheDocument();
      });
    }
  );

  it("hides the Add Resource action from read-only users", async () => {
    mockRole.mockReturnValue("VIEWER");
    renderList();

    await waitFor(() => expect(mockList).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /add resource/i })).not.toBeInTheDocument();
  });

  it("shows inline validation errors without calling the API", async () => {
    mockList.mockResolvedValue({
      data: [createdResource],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false },
    });
    mockRole.mockReturnValue("ADMIN");
    const dialog = await openCreateDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: /add resource/i }));

    await waitFor(() => {
      expect(screen.getByText("Resource name must be at least 2 characters")).toBeInTheDocument();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates a resource with GeoJSON coordinates and closes the dialog", async () => {
    mockList.mockResolvedValue({
      data: [createdResource],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false },
    });
    mockRole.mockReturnValue("ADMIN");
    const dialog = await openCreateDialog();
    fillValidForm(dialog);

    fireEvent.click(within(dialog).getByRole("button", { name: /add resource/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Northside rescue boat",
        type: "Water rescue unit",
        category: "Rescue",
        status: "AVAILABLE",
        location: {
          type: "Point",
          coordinates: [-122.4194, 37.7749],
        },
        capacity: 6,
        contact: "Radio channel 4",
      })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("allows editing an existing resource", async () => {
    mockList.mockResolvedValue({
      data: [createdResource],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false },
    });
    mockRole.mockReturnValue("ADMIN");
    renderList();

    await waitFor(() => expect(screen.getByText("Northside rescue boat")).toBeInTheDocument());

    const editButton = screen.getByRole("button", { name: /edit/i });
    fireEvent.click(editButton);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Edit resource")).toBeInTheDocument();

    const nameInput = within(dialog).getByLabelText(/^Resource name/i);
    fireEvent.change(nameInput, { target: { value: "Updated rescue boat" } });

    fireEvent.click(within(dialog).getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({
        name: "Updated rescue boat",
      })
    );
  });

  it("surfaces a failed creation without closing the form", async () => {
    mockList.mockResolvedValue({
      data: [createdResource],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false },
    });
    mockRole.mockReturnValue("ADMIN");
    mockCreate.mockRejectedValue(new Error("Resource service unavailable"));
    const dialog = await openCreateDialog();
    fillValidForm(dialog);

    fireEvent.click(within(dialog).getByRole("button", { name: /add resource/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Resource service unavailable");
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
