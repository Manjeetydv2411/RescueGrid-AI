import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";

import { useAuth } from "./useAuth";
import { tokenStore } from "../services/api";
import type { SocketEvent } from "../types/api";

/**
 * Socket.IO server origin.
 *
 * The backend mounts Socket.IO on the same HTTP server as the REST API, so by
 * default this is the API origin. It can be overridden for deployments where
 * the realtime gateway is hosted separately.
 */
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || "http://localhost:4000";

export const SOCKET_EVENTS = {
  INCIDENT_CREATED: "incident:created",
  INCIDENT_UPDATED: "incident:updated",
  INCIDENT_STATUS_CHANGED: "incident:status-changed",
  INCIDENT_ASSIGNED: "incident:assigned",
  INCIDENT_UNASSIGNED: "incident:unassigned",
  RESOURCE_CREATED: "resource:created",
  RESOURCE_UPDATED: "resource:updated",
  RESOURCE_STATUS_CHANGED: "resource:status-changed",
  ASSIGNMENT_CREATED: "assignment:created",
  ASSIGNMENT_UPDATED: "assignment:updated",
  ASSIGNMENT_STATUS_CHANGED: "assignment:status-changed",
  ASSIGNMENT_CANCELLED: "assignment:cancelled",
  NOTIFICATION_NEW: "notification:new",
  NOTIFICATION_READ: "notification:read",
  JOIN_INCIDENT: "join:incident",
  LEAVE_INCIDENT: "leave:incident",
  REQUEST_MISSED_UPDATES: "sync:request",
} as const;

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  joinIncident: (incidentId: string) => Promise<boolean>;
  leaveIncident: (incidentId: string) => Promise<boolean>;
  requestMissedUpdates: (
    incidentId: string,
    sinceVersion?: number
  ) => Promise<unknown>;
  /**
   * Subscribe to a server event.
   *
   * The handler receives the *unwrapped* event payload (`payload.data`), so
   * consumers never have to know about the socket envelope.
   */
  onEvent: <T = unknown>(
    event: string,
    handler: (data: T) => void
  ) => () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  // The socket must connect with a valid token, so it follows the session.
  const { isAuthenticated } = useAuth();

  /**
   * The socket is created eagerly (not in an effect) so that consumers can
   * subscribe during their own effects. React runs child effects before
   * parent effects, so a socket created in the provider's effect would be
   * missing when a page subscribes to it.
   *
   * The instance is kept in a ref rather than state: a state update here would
   * re-render every consumer on every connection change, and React 18's
   * StrictMode double-invoke would otherwise tear down and rebuild the socket
   * on every mount.
   */
  const socketRef = useRef<Socket | null>(null);

  if (socketRef.current === null) {
    const instance = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10_000,
      autoConnect: false,
      // The token is supplied per connection attempt so a refreshed token is
      // picked up on reconnect.
      auth: (cb) => {
        cb({ token: tokenStore.getAccessToken() });
      },
      // Engine.IO v6 reads extraHeaders as a plain object, not a callback, and
      // only applies it to the Node transports. The browser ignores it, so the
      // handshake token above is what actually authenticates the socket.
    });
    socketRef.current = instance;
  }

  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const instance = socketRef.current;
    if (!instance) return;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleError = (error: Error) => {
      setIsConnected(false);
      // Surfaced in the UI as an offline indicator; not fatal.
      console.warn("Socket connection error:", error.message);
    };

    instance.on("connect", handleConnect);
    instance.on("disconnect", handleDisconnect);
    instance.on("connect_error", handleError);

    return () => {
      instance.off("connect", handleConnect);
      instance.off("disconnect", handleDisconnect);
      instance.off("connect_error", handleError);
    };
  }, []);

  // Close the socket when the provider unmounts for good.
  useEffect(
    () => () => {
      socketRef.current?.removeAllListeners();
      socketRef.current?.close();
    },
    []
  );

  // Connect and disconnect as the session comes and goes.
  useEffect(() => {
    const instance = socketRef.current;
    if (!instance) return;

    if (isAuthenticated) {
      // Do not assign `instance.auth` here. The client treats `auth` as a
      // function-or-object and reads it on *every* connect attempt; replacing
      // the constructor's callback with a static object would freeze the token
      // at connect time, and a later reconnect would present the expired
      // token and be rejected by the server's handshake middleware.
      if (!instance.connected) instance.connect();
    } else {
      instance.disconnect();
      setIsConnected(false);
    }
  }, [isAuthenticated]);

  const connect = useCallback(() => {
    const instance = socketRef.current;
    if (!instance || instance.connected) return;
    // The constructor's `auth` callback reads the current token, so the
    // reconnect handshake always carries a fresh one.
    instance.connect();
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
  }, []);

  const joinIncident = useCallback(
    (incidentId: string): Promise<boolean> =>
      new Promise((resolve) => {
        const instance = socketRef.current;
        if (!instance || !instance.connected) {
          resolve(false);
          return;
        }
        instance.emit(
          SOCKET_EVENTS.JOIN_INCIDENT,
          { incidentId },
          (response: { success?: boolean }) => resolve(!!response?.success)
        );
      }),
    []
  );

  const leaveIncident = useCallback(
    (incidentId: string): Promise<boolean> =>
      new Promise((resolve) => {
        const instance = socketRef.current;
        if (!instance) {
          resolve(false);
          return;
        }
        instance.emit(
          SOCKET_EVENTS.LEAVE_INCIDENT,
          { incidentId },
          (response: { success?: boolean }) => resolve(!!response?.success)
        );
      }),
    []
  );

  const requestMissedUpdates = useCallback(
    (incidentId: string, sinceVersion?: number): Promise<unknown> =>
      new Promise((resolve) => {
        const instance = socketRef.current;
        if (!instance || !instance.connected) {
          resolve(null);
          return;
        }
        instance.emit(
          SOCKET_EVENTS.REQUEST_MISSED_UPDATES,
          { incidentId, sinceVersion },
          (response: unknown) => resolve(response)
        );
      }),
    []
  );

  /**
   * Subscribe to a server event, unwrapping the standard event envelope.
   * Returns an unsubscribe function.
   */
  const onEvent = useCallback(
    <T = unknown>(event: string, handler: (data: T) => void) => {
      const instance = socketRef.current;
      if (!instance) return () => {};

      const listener = (payload: SocketEvent<T>) => {
        // The server always sends the envelope; be defensive in case a bare
        // payload arrives.
        if (payload && typeof payload === "object" && "data" in payload) {
          handler(payload.data);
        } else {
          handler(payload as T);
        }
      };

      instance.on(event, listener);
      return () => {
        instance.off(event, listener);
      };
    },
    []
  );

  const value = useMemo<SocketContextValue>(
    () => ({
      socket: socketRef.current,
      isConnected,
      connect,
      disconnect,
      joinIncident,
      leaveIncident,
      requestMissedUpdates,
      onEvent,
    }),
    [
      isConnected,
      connect,
      disconnect,
      joinIncident,
      leaveIncident,
      requestMissedUpdates,
      onEvent,
    ]
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextValue => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export default SocketProvider;
