import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider, useAuth } from "./hooks/useAuth";
import { SocketProvider } from "./hooks/useSocket";
import type { UserRole } from "./types/api";

const ROLE_HOME: Record<UserRole, string> = {
  ADMIN: "/admin/users",
  COORDINATOR: "/dashboard",
  RESPONDER: "/assignments",
  VIEWER: "/dashboard",
};

function RoleHomeRedirect() {
  const { user } = useAuth();
  const role = user?.role ?? "VIEWER";
  return <Navigate to={ROLE_HOME[role] ?? "/dashboard"} replace />;
}

import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/common/ProtectedRoute";

// Auth pages
import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";

// Dashboard
import Dashboard from "./pages/Dashboard/Dashboard";

// Map page
import IncidentMapPage from "./pages/Map/IncidentMapPage";

// Incidents
import IncidentList from "./pages/Incidents/IncidentList";
import IncidentDetail from "./pages/Incidents/IncidentDetail";
import IncidentForm from "./pages/Incidents/IncidentForm";

// Resources
import ResourceList from "./pages/Resources/ResourceList";

// Assignments
import AssignmentList from "./pages/Assignments/AssignmentList";

// Notifications
import NotificationList from "./pages/Notifications/NotificationList";

// Broadcasts
import BroadcastList from "./pages/Broadcasts/BroadcastList";

// Admin
import UserManagement from "./pages/Admin/UserManagement";
import AuditLog from "./pages/Admin/AuditLog";

// Not found
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 15_000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<RoleHomeRedirect />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="map" element={<IncidentMapPage />} />
                <Route path="incidents" element={<IncidentList />} />
                <Route path="incidents/new" element={<IncidentForm />} />
                <Route path="incidents/:id" element={<IncidentDetail />} />
                {/* Editing a report is a coordinator action; the API enforces
                    the same rule, this only keeps the UI honest. */}
                <Route
                  path="incidents/:id/edit"
                  element={
                    <ProtectedRoute role={["ADMIN", "COORDINATOR"]}>
                      <IncidentForm />
                    </ProtectedRoute>
                  }
                />
                <Route path="resources" element={<ResourceList />} />
                <Route path="assignments" element={<AssignmentList />} />
                <Route path="notifications" element={<NotificationList />} />
                <Route path="broadcasts" element={<BroadcastList />} />

                {/* Admin routes */}
                <Route path="admin" element={<Navigate to="/admin/users" replace />} />
                <Route
                  path="admin/users"
                  element={
                    <ProtectedRoute role="ADMIN">
                      <UserManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/audit"
                  element={
                    <ProtectedRoute role="ADMIN">
                      <AuditLog />
                    </ProtectedRoute>
                  }
                />

                {/* Any unknown path inside the app shell */}
                <Route path="*" element={<NotFound />} />
              </Route>

              {/* Not found outside the shell */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" />
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
