import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import Header from "./Header";
import Sidebar from "./Sidebar";
import RescueGridAssistant from "../common/RescueGridAssistant";

/**
 * Application shell: fixed header, collapsible sidebar, and the routed page.
 */
const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-tactical-950 font-sans text-platinum-800 tactical-grid">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-cyber-cyan focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-tactical-950"
      >
        Skip to main content
      </a>

      <Header
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        isSidebarOpen={sidebarOpen}
      />

      <div className="flex w-full flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full min-w-0 max-w-7xl flex-1 p-4 sm:p-6 lg:p-8 focus:outline-none"
        >
          <Outlet />
        </main>
      </div>

      <RescueGridAssistant />
    </div>
  );
};

export default Layout;
