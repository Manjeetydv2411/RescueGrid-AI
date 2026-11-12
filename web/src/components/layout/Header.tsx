import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../hooks/useAuth";
import { SOCKET_EVENTS, useSocket } from "../../hooks/useSocket";
import { notificationApi, incidentApi } from "../../services/api";
import Button from "../common/Button";

interface HeaderProps {
  onToggleSidebar: () => void;
  /** Whether the mobile navigation drawer is currently open. */
  isSidebarOpen?: boolean;
}

const Header = ({ onToggleSidebar, isSidebarOpen = false }: HeaderProps) => {
  const { user, logout } = useAuth();
  const { isConnected, onEvent } = useSocket();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Tactical Digital HUD Clock
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unreadCount"],
    queryFn: () => notificationApi.unreadCount(),
    refetchInterval: 30_000,
    retry: false,
  });

  // Query active critical / active incidents for tactical SOS counter
  const { data: activeIncidents } = useQuery({
    queryKey: ["incidents", "active-count"],
    queryFn: () => incidentApi.list({ page: 1, limit: 1, status: "ACTIVE" }),
    refetchInterval: 30_000,
    retry: false,
  });

  const activeCount = activeIncidents?.pagination.total ?? 0;

  // A new notification can arrive over the socket at any time.
  useEffect(
    () =>
      onEvent(SOCKET_EVENTS.NOTIFICATION_NEW, () => {
        void queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }),
    [onEvent, queryClient]
  );

  useEffect(
    () =>
      onEvent(SOCKET_EVENTS.NOTIFICATION_READ, () => {
        void queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }),
    [onEvent, queryClient]
  );

  useEffect(
    () =>
      onEvent(SOCKET_EVENTS.INCIDENT_CREATED, () => {
        void queryClient.invalidateQueries({ queryKey: ["incidents", "active-count"] });
      }),
    [onEvent, queryClient]
  );

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  const utcString = currentTime.toISOString().substring(11, 19) + " UTC";
  const localString = currentTime.toLocaleTimeString([], { hour12: false });

  return (
    <header className="sticky top-0 z-30 border-b border-cyber-cyan/20 bg-tactical-900/90 backdrop-blur-md text-platinum-800 shadow-glass">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-lg p-2 text-platinum-700 hover:bg-tactical-800 hover:text-cyber-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan md:hidden"
            aria-label="Open navigation menu"
            aria-expanded={isSidebarOpen}
            aria-controls="app-sidebar"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <Link
            to="/dashboard"
            className="flex min-w-0 items-center gap-2.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan group"
          >
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tactical-800 border border-cyber-cyan/40 text-cyber-cyan shadow-neon-cyan transition-transform group-hover:scale-105">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-cyan opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-cyan"></span>
              </span>
            </div>
            <span className="flex flex-col leading-tight">
              <span className="truncate text-base font-bold tracking-tight text-white flex items-center gap-1.5 sm:text-lg">
                RescueGrid <span className="font-extrabold text-cyber-cyan drop-shadow-[0_0_8px_rgba(0,243,255,0.6)]">AI</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30">
                  HUD v2.4
                </span>
              </span>
              <span className="hidden text-[10px] font-mono tracking-widest text-platinum-700 sm:block">
                TACTICAL COMMAND INTERFACE
              </span>
            </span>
          </Link>

          {/* Connection Telemetry Beacon */}
          <span
            className={`ml-2 hidden items-center rounded-full border px-2.5 py-0.5 text-xs font-mono font-medium sm:inline-flex ${
              isConnected
                ? "border-safe-green/40 bg-safe-green/10 text-safe-green shadow-neon-green"
                : "border-alert-red/40 bg-alert-red/10 text-alert-red shadow-neon-red"
            }`}
            title={
              isConnected
                ? "Connected to the live tactical telemetry stream"
                : "Telemetry offline. Stream reconnecting..."
            }
          >
            <span
              aria-hidden="true"
              className={`mr-1.5 h-2 w-2 rounded-full ${
                isConnected ? "bg-safe-green animate-pulse" : "bg-alert-red"
              }`}
            />
            {isConnected ? "NET_LIVE" : "NET_OFFLINE"}
          </span>

          {/* Active SOS counter badge */}
          {activeCount > 0 && (
            <Link
              to="/incidents?status=ACTIVE"
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-alert-red/40 bg-alert-red/15 text-alert-red font-mono text-xs shadow-neon-red animate-pulse"
              title="Active emergency incidents requiring immediate attention"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-alert-red" />
              <span>SOS ACTIVE: {activeCount}</span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Tactical Clock Module */}
          <div className="hidden md:flex flex-col text-right font-mono text-xs border-r border-cyber-cyan/15 pr-3">
            <span className="text-cyber-cyan font-bold tracking-wider">{utcString}</span>
            <span className="text-[10px] text-platinum-700">LOC: {localString}</span>
          </div>

          <Link
            to="/notifications"
            className="relative rounded-lg p-2 text-platinum-700 hover:text-cyber-cyan cursor-pointer transition-colors hover:bg-tactical-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyber-cyan"
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications, none unread"
            }
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 1 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute right-0 top-0 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-alert-red px-1 font-mono text-[10px] font-bold text-white shadow-neon-red">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>

          {user && (
            <div className="flex items-center gap-3 border-l border-cyber-cyan/15 pl-3">
              <div className="hidden text-right sm:block">
                <div className="max-w-[10rem] truncate text-sm font-semibold text-white">
                  {user.name}
                </div>
                <span className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-mono text-xs font-bold px-2 py-0.5 rounded inline-block">
                  {user.role}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleLogout}
                className="text-platinum-700 hover:text-rose-400 font-medium text-sm transition-colors"
              >
                Sign out
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
