import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockChat = vi.fn();
const mockRole = vi.fn();

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/services/api")
  >("../../src/services/api");
  return {
    ...actual,
    assistantApi: {
      chat: (...args: unknown[]) => mockChat(...args),
    },
  };
});

vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { _id: "u1", name: "Test operator", email: "operator@example.test", role: mockRole() },
  }),
}));

import RescueGridAssistant from "../../src/components/common/RescueGridAssistant";

describe("RescueGridAssistant Component", () => {
  beforeEach(() => {
    mockChat.mockReset();
    mockRole.mockReset();
    mockRole.mockReturnValue("COORDINATOR");
    mockChat.mockResolvedValue({
      response: "Here is guidance on the location picker.",
      role: "COORDINATOR",
    });
  });

  it("renders the floating assistant button when closed", () => {
    render(<RescueGridAssistant />);
    expect(screen.getByRole("button", { name: /open rescuegrid ai assistant/i })).toBeInTheDocument();
  });

  it("opens the chat panel when clicked", () => {
    render(<RescueGridAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open rescuegrid ai assistant/i }));

    expect(screen.getByRole("dialog", { name: /rescuegrid ai assistant chat/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /rescuegrid assistant/i })).toBeInTheDocument();
  });

  it("sends a message and displays the assistant response", async () => {
    render(<RescueGridAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open rescuegrid ai assistant/i }));

    const input = screen.getByPlaceholderText(/ask how to use rescuegrid/i);
    fireEvent.change(input, { target: { value: "How do I use the location picker?" } });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => {
      expect(mockChat).toHaveBeenCalledWith("How do I use the location picker?");
      expect(screen.getByText("Here is guidance on the location picker.")).toBeInTheDocument();
    });
  });

  it("closes the chat panel when close button is clicked", () => {
    render(<RescueGridAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open rescuegrid ai assistant/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close assistant/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
