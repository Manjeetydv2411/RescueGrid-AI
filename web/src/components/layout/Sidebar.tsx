import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import type { UserRole } from "../../types/api";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: ReactNode;
  badge?: string;
  roles?: UserRole[];
  dataTour?: string;
}

const iconClass = "h-5 w-5 shrink-0 transition-transform group-hover:scale-110 text-platinum-700 group-hover:text-cyber-cyan";

const OPERATIONS_NAV: NavItem[] = [
  {
    name: "Command Center",
    href: "/dashboard",
    dataTour: "sidebar-dashboard",
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: "Tactical Map",
    href: "/map",
    badge: "LIVE",
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    name: "Incidents & SOS",
    href: "/incidents",
    dataTour: "sidebar-incidents",
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    name: "Resource Fleet",
    href: "/resources",
    dataTour: "sidebar-resources",
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    name: "Unit Dispatches",
    href: "/assignments",
    dataTour: "assignment-list",
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    name: "Alert Feed",
    href: "/notifications",
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 1 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    name: "Emergency Broadcasts",
    href: "/broadcasts",
    badge: "ALERT",
    dataTour: "broadcast-action",
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
  },
];

const ADMIN_NAV: NavItem[] = [
  {
    name: "Operator Roster",
    href: "/admin/users",
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    roles: ["ADMIN"],
  },
  {
    name: "Tactical Audit Trail",
    href: "/admin/audit",
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    roles: ["ADMIN"],
  },
];

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { user } = useAuth();
  const role = user?.role;

  const visible = (items: NavItem[]) =>
    items.filter((item) => !item.roles || (role && item.roles.includes(role)));

  const operations = visible(OPERATIONS_NAV);
  const administration = visible(ADMIN_NAV);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-tactical-950/80 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed left-0 top-16 z-40 flex h-[calc(100vh-4rem)] w-64 flex-col border-r border-cyber-cyan/15 bg-tactical-900/90 backdrop-blur-md transition-[transform,visibility] duration-200 ease-in-out md:sticky md:top-16 md:visible md:translate-x-0 ${
          isOpen
            ? "visible translate-x-0"
            : "invisible -translate-x-full"
        }`}
        aria-label="Main navigation"
      >
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2 px-3">
              <p className="text-cyber-cyan font-mono text-xs font-bold tracking-widest uppercase opacity-100 block mb-2">
                TACTICAL OPERATIONS
              </p>
              <span className="h-1 w-1 rounded-full bg-cyber-cyan animate-ping" />
            </div>
            <ul className="space-y-1">
              {operations.map((item) => (
                <li key={item.href}>
                  <NavLink
                    to={item.href}
                    data-tour={item.dataTour}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan ${
                        isActive
                          ? "bg-cyber-cyan/15 text-cyber-cyan border-l-2 border-cyber-cyan shadow-neon-cyan font-semibold"
                          : "text-platinum-700 hover:text-white hover:bg-tactical-800/80 font-medium flex items-center gap-2 px-3 py-2 rounded-md transition-all border-l-2 border-transparent"
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-safe-green/20 text-safe-green border border-safe-green/30 font-bold">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {administration.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-3">
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-warn-amber/80">
                  SYSTEM & SECURITY
                </p>
                <span className="h-1 w-1 rounded-full bg-warn-amber" />
              </div>
              <ul className="space-y-1">
                {administration.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      to={item.href}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-warn-amber ${
                          isActive
                            ? "bg-warn-amber/15 text-warn-amber border-l-2 border-warn-amber shadow-neon-amber font-semibold"
                            : "text-platinum-700 hover:bg-tactical-800 hover:text-white border-l-2 border-transparent hover:border-warn-amber/40"
                        }`
                      }
                    >
                      {item.icon}
                      <span>{item.name}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        {/* Tactical Telemetry Status Footer */}
        <div className="border-t border-cyber-cyan/15 bg-tactical-950/60 px-4 py-3 text-xs font-mono">
          <div className="flex items-center justify-between text-platinum-700">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-safe-green" />
              GRID SYNC
            </span>
            <span className="text-cyber-cyan">99.98%</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-platinum-700">
            <span>DEFCON LEVEL</span>
            <span className="text-warn-amber font-bold">ALPHA-1</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
