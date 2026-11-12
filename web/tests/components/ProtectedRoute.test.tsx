import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mockUser = vi.fn();
const mockIsLoading = vi.fn();

vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockUser(),
    isAuthenticated: Boolean(mockUser()),
    isLoading: mockIsLoading(),
    hasRole: (...roles: string[]) => roles.includes(mockUser()?.role ?? ""),
  }),
}));

import ProtectedRoute from "../../src/components/common/ProtectedRoute";

const renderRoutes = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <p>Dashboard content</p>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute role="ADMIN">
              <p>User management</p>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>
  );

describe("ProtectedRoute", () => {
  beforeEach(() => {
    mockUser.mockReset();
    mockIsLoading.mockReset();
  });

  it("redirects an unauthenticated user to the login page", async () => {
    mockUser.mockReturnValue(null);
    mockIsLoading.mockReturnValue(false);

    renderRoutes();

    await waitFor(() => {
      expect(screen.getByText("Login page")).toBeInTheDocument();
    });
    expect(screen.queryByText("Dashboard content")).not.toBeInTheDocument();
  });

  it("shows a loading state while the session is being restored", () => {
    mockUser.mockReturnValue(null);
    mockIsLoading.mockReturnValue(true);

    renderRoutes();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  });

  it("renders the page for an authenticated user", async () => {
    mockUser.mockReturnValue({ _id: "u1", role: "VIEWER" });
    mockIsLoading.mockReturnValue(false);

    renderRoutes();

    await waitFor(() => {
      expect(screen.getByText("Dashboard content")).toBeInTheDocument();
    });
  });

  it("redirects a user without the required role away from the admin page", async () => {
    mockUser.mockReturnValue({ _id: "u1", role: "VIEWER" });
    mockIsLoading.mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <Routes>
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute role="ADMIN">
                <p>User management</p>
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<p>Dashboard content</p>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Dashboard content")).toBeInTheDocument();
    });
    expect(screen.queryByText("User management")).not.toBeInTheDocument();
  });

  it("renders the admin page for an administrator", async () => {
    mockUser.mockReturnValue({ _id: "u1", role: "ADMIN" });
    mockIsLoading.mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <Routes>
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute role="ADMIN">
                <p>User management</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("User management")).toBeInTheDocument();
    });
  });
});
