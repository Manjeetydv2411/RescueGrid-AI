import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mockLogin = vi.fn();

const loginUser = (role: "ADMIN" | "COORDINATOR" | "RESPONDER" | "VIEWER") => ({
  _id: "u1",
  name: "Operator",
  email: "operator@example.com",
  role,
});

vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: mockLogin,
    register: vi.fn(),
    logout: vi.fn(),
    refreshProfile: vi.fn(),
    hasRole: () => false,
  }),
}));

import Login from "../../src/pages/Auth/Login";

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<p>Dashboard content</p>} />
        <Route path="/admin/users" element={<p>Admin content</p>} />
        <Route path="/assignments" element={<p>Assignments content</p>} />
      </Routes>
    </MemoryRouter>
  );

describe("Login page", () => {
  beforeEach(() => {
    mockLogin.mockReset();
  });

  it("renders the email and password fields with labels", () => {
    renderLogin();

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("does not submit an invalid email address", async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "not-an-email" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("signs in with the entered credentials and navigates to the dashboard", async () => {
    mockLogin.mockResolvedValue(loginUser("COORDINATOR"));
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "coordinator@agency.gov" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        "coordinator@agency.gov",
        "password123"
      );
    });
    await waitFor(() => {
      expect(screen.getByText("Dashboard content")).toBeInTheDocument();
    });
  });

  it.each([
    ["ADMIN", "/admin/users"],
    ["COORDINATOR", "/dashboard"],
    ["RESPONDER", "/assignments"],
    ["VIEWER", "/dashboard"],
  ] as const)("redirects a %s to its role home", async (role, destination) => {
    mockLogin.mockResolvedValue(loginUser(role));
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "operator@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      const content = {
        "/admin/users": "Admin content",
        "/dashboard": "Dashboard content",
        "/assignments": "Assignments content",
      }[destination];
      expect(content).toBeDefined();
      expect(screen.getByText(content as string)).toBeInTheDocument();
    });
  });

  it("shows the server's error message when sign-in fails", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "coordinator@agency.gov" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials");
    });
  });
});
