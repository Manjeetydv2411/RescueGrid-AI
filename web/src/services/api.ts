import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
} from "axios";

import type {
  AppNotification,
  Assignment,
  AuditLogEntry,
  DashboardStats,
  Incident,
  IncidentAttachment,
  IncidentCategory,
  IncidentStatus,
  Paginated,
  Responder,
  Resource,
  ResourceStatus,
  Severity,
  User,
  UserRole,
} from "../types/api";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const TOKEN_KEY = "accessToken";
export const REFRESH_TOKEN_KEY = "refreshToken";

/** Shape of every successful backend response. */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const tokenStore = {
  getAccessToken: (): string | null =>
    localStorage.getItem(TOKEN_KEY),
  getRefreshToken: (): string | null =>
    localStorage.getItem(REFRESH_TOKEN_KEY),
  set(accessToken: string, refreshToken?: string): void {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the bearer token to every outgoing request.
api.interceptors.request.use((config) => {
  const token = tokenStore.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * On a 401, exchange the refresh token for a new access token and replay the
 * original request once.
 *
 * The refresh token is only ever sent to POST /auth/refresh — the backend
 * rejects it as a bearer credential on any other route. If the refresh fails
 * the session is cleared and the user is sent to /login.
 */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (AxiosRequestConfig & {
      _retry?: boolean;
    }) | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const refreshToken = tokenStore.getRefreshToken();
      originalRequest._retry = true;

      if (refreshToken) {
        try {
          // A bare axios call, so this request does not re-enter the
          // interceptor and loop on failure.
          const refreshed = await axios.post<ApiEnvelope<{
            accessToken: string;
            refreshToken: string;
          }>>(`${API_BASE_URL}/api/v1/auth/refresh`, { refreshToken });

          const { accessToken, refreshToken: nextRefreshToken } =
            refreshed.data.data;
          tokenStore.set(accessToken, nextRefreshToken);

          // AxiosHeaders.concat preserves the instance's header handling
          // rather than flattening it into a plain object. The runtime value
          // of `config.headers` is always an AxiosHeaders instance.
          originalRequest.headers = AxiosHeaders.concat(
            originalRequest.headers as AxiosHeaders,
            { Authorization: `Bearer ${accessToken}` }
          );
          return await api.request(originalRequest);
        } catch {
          // Fall through to the session-clearing path below.
        }
      }

      tokenStore.clear();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }

    return Promise.reject(error);
  }
);

/** Extract a human-readable message from a failed request. */
export const getErrorMessage = (error: unknown, fallback = "Something went wrong"): string => {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as
      | { error?: { message?: string }; message?: string }
      | undefined;
    return (
      payload?.error?.message ||
      payload?.message ||
      error.message ||
      fallback
    );
  }
  if (error instanceof Error) return error.message;
  return fallback;
};

/** Unwrap the backend envelope, returning the `data` payload. */
export const unwrap = <T>(response: { data: ApiEnvelope<T> }): T => response.data.data;

/**
 * Normalise an identifier.
 *
 * Some endpoints return documents verbatim (which carry `_id`), while the
 * auth and incident-create endpoints serialise `id` explicitly. The UI always
 * works with `_id`, so the alias is filled in here rather than in every page.
 */
const withId = <T extends { _id?: string; id?: string }>(entity: T): T =>
  entity && !entity._id && entity.id
    ? ({ ...entity, _id: entity.id } as T)
    : entity;

const normaliseUser = (user: User): User => withId(user);

const normaliseIncident = (incident: Incident): Incident => withId(incident);

const normaliseResource = (resource: Resource): Resource => withId(resource);

const normaliseAssignment = (assignment: Assignment): Assignment => withId(assignment);

export const authApi = {
  register: async (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<User> => {
    const response = await api.post<ApiEnvelope<User>>(
      "/api/v1/auth/register",
      data
    );
    return normaliseUser(unwrap(response));
  },

  login: async (data: {
    email: string;
    password: string;
  }): Promise<{ user: User; accessToken: string; refreshToken: string }> => {
    const response = await api.post<
      ApiEnvelope<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>
    >("/api/v1/auth/login", data);
    const result = unwrap(response);
    return { ...result, user: normaliseUser(result.user) };
  },

  logout: async (): Promise<void> => {
    await api.post("/api/v1/auth/logout");
  },

  getMe: async (): Promise<User> => {
    const response = await api.get<ApiEnvelope<User>>("/api/v1/auth/me");
    return normaliseUser(unwrap(response));
  },
};

export interface IncidentQuery {
  page?: number;
  limit?: number;
  status?: IncidentStatus | "";
  severity?: Severity | "";
  category?: IncidentCategory | "";
  search?: string;
  near?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export const incidentApi = {
  list: async (params: IncidentQuery = {}): Promise<Paginated<Incident>> => {
    const response = await api.get<ApiEnvelope<Paginated<Incident>>>(
      "/api/v1/incidents",
      { params }
    );
    return unwrap(response);
  },

  get: async (id: string): Promise<Incident> => {
    const response = await api.get<ApiEnvelope<Incident>>(
      `/api/v1/incidents/${id}`
    );
    return normaliseIncident(unwrap(response));
  },

  create: async (data: FormData): Promise<Incident> => {
    const response = await api.post<ApiEnvelope<Incident>>(
      "/api/v1/incidents",
      data
    );
    return normaliseIncident(unwrap(response));
  },

  update: async (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      severity: Severity;
      category: IncidentCategory;
      status: IncidentStatus;
      assignedTo: string;
      location: { type: "Point"; coordinates: [number, number] };
      address: string;
      tags: string[];
      contactPhone: string;
    }>
  ): Promise<Incident> => {
    const response = await api.put<ApiEnvelope<Incident>>(
      `/api/v1/incidents/${id}`,
      data
    );
    return normaliseIncident(unwrap(response));
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/incidents/${id}`);
  },

  nearby: async (
    lng: number,
    lat: number,
    maxDistance?: number,
    limit?: number
  ): Promise<Incident[]> => {
    const response = await api.get<ApiEnvelope<Incident[]>>(
      "/api/v1/incidents/nearby",
      { params: { lng, lat, maxDistance, limit } }
    );
    return unwrap(response);
  },

  assign: async (id: string, assignedTo: string): Promise<Incident> => {
    const response = await api.post<ApiEnvelope<Incident>>(
      `/api/v1/incidents/${id}/assign`,
      { assignedTo }
    );
    return normaliseIncident(unwrap(response));
  },

  unassign: async (id: string): Promise<Incident> => {
    const response = await api.post<ApiEnvelope<Incident>>(
      `/api/v1/incidents/${id}/unassign`
    );
    return normaliseIncident(unwrap(response));
  },

  listAttachments: async (id: string): Promise<{ attachments: IncidentAttachment[] }> => {
    const response = await api.get<ApiEnvelope<{ attachments: IncidentAttachment[] }>>(
      `/api/v1/incidents/${id}/attachments`
    );
    return unwrap(response);
  },
};

export interface ResourceQuery {
  page?: number;
  limit?: number;
  status?: ResourceStatus | "";
  category?: string;
  type?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export const resourceApi = {
  list: async (params: ResourceQuery = {}): Promise<Paginated<Resource>> => {
    const response = await api.get<ApiEnvelope<Paginated<Resource>>>(
      "/api/v1/resources",
      { params }
    );
    return unwrap(response);
  },

  get: async (id: string): Promise<Resource> => {
    const response = await api.get<ApiEnvelope<Resource>>(
      `/api/v1/resources/${id}`
    );
    return normaliseResource(unwrap(response));
  },

  create: async (data: {
    name: string;
    type: string;
    category: string;
    status: ResourceStatus;
    location: { type: "Point"; coordinates: [number, number] };
    capacity?: number;
    contact?: string;
  }): Promise<Resource> => {
    const response = await api.post<ApiEnvelope<Resource>>(
      "/api/v1/resources",
      data
    );
    return normaliseResource(unwrap(response));
  },

  update: async (
    id: string,
    data: Partial<{
      name: string;
      type: string;
      category: string;
      status: ResourceStatus;
      capacity: number;
      contact: string;
      location: { type: "Point"; coordinates: [number, number] };
    }>
  ): Promise<Resource> => {
    const response = await api.put<ApiEnvelope<Resource>>(
      `/api/v1/resources/${id}`,
      data
    );
    return normaliseResource(unwrap(response));
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/resources/${id}`);
  },

  updateAvailability: async (
    id: string,
    status: ResourceStatus
  ): Promise<Resource> => {
    const response = await api.patch<ApiEnvelope<Resource>>(
      `/api/v1/resources/${id}/availability`,
      { status }
    );
    return normaliseResource(unwrap(response));
  },

  nearby: async (
    lng: number,
    lat: number,
    maxDistance?: number,
    limit?: number
  ): Promise<Resource[]> => {
    const response = await api.get<ApiEnvelope<Resource[]>>(
      "/api/v1/resources/nearby",
      { params: { lng, lat, maxDistance, limit } }
    );
    return unwrap(response);
  },
};

export interface AssignmentQuery {
  page?: number;
  limit?: number;
  status?: string;
  incidentId?: string;
  responderId?: string;
  resourceId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export const assignmentApi = {
  list: async (params: AssignmentQuery = {}): Promise<Paginated<Assignment>> => {
    const response = await api.get<ApiEnvelope<Paginated<Assignment>>>(
      "/api/v1/assignments",
      { params }
    );
    return unwrap(response);
  },

  get: async (id: string): Promise<Assignment> => {
    const response = await api.get<ApiEnvelope<Assignment>>(
      `/api/v1/assignments/${id}`
    );
    return normaliseAssignment(unwrap(response));
  },

  create: async (
    incidentId: string,
    data: { responderId: string; resourceId?: string; notes?: string }
  ): Promise<Assignment> => {
    const response = await api.post<ApiEnvelope<Assignment>>(
      `/api/v1/assignments/incidents/${incidentId}`,
      data
    );
    return normaliseAssignment(unwrap(response));
  },

  update: async (
    id: string,
    data: Partial<{ status: string; notes: string }>
  ): Promise<Assignment> => {
    const response = await api.put<ApiEnvelope<Assignment>>(
      `/api/v1/assignments/${id}`,
      data
    );
    return normaliseAssignment(unwrap(response));
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/assignments/${id}`);
  },

  cancel: async (id: string): Promise<Assignment> => {
    const response = await api.post<ApiEnvelope<Assignment>>(
      `/api/v1/assignments/${id}/cancel`
    );
    return normaliseAssignment(unwrap(response));
  },

  byResponder: async (responderId: string): Promise<Assignment[]> => {
    const response = await api.get<ApiEnvelope<Assignment[]>>(
      `/api/v1/assignments/responder/${responderId}`
    );
    return unwrap(response);
  },

  byIncident: async (incidentId: string): Promise<Assignment[]> => {
    const response = await api.get<ApiEnvelope<Assignment[]>>(
      `/api/v1/assignments/incidents/${incidentId}`
    );
    return unwrap(response);
  },

  responders: async (search?: string): Promise<Responder[]> => {
    const response = await api.get<ApiEnvelope<Responder[]>>(
      "/api/v1/assignments/responders",
      { params: { search } }
    );
    return unwrap(response);
  },

  recommendations: async (incidentId: string): Promise<any[]> => {
    const response = await api.get<ApiEnvelope<any[]>>(
      `/api/v1/assignments/recommendations/${incidentId}`
    );
    return unwrap(response);
  },
};

export interface ResourceRecommendation {
  resource: {
    _id: string;
    name: string;
    type: string;
    category: string;
    status: string;
    capacity?: number;
    contact?: string;
  };
  distanceKm: number | null;
  matchScore: number;
  explanation: string;
}

export const allocationApi = {
  getRecommendations: async (incidentId: string): Promise<ResourceRecommendation[]> => {
    const response = await api.get<ApiEnvelope<ResourceRecommendation[]>>(
      `/api/v1/allocation/recommendations/${incidentId}`
    );
    return unwrap(response);
  },

  allocate: async (incidentId: string, resourceId: string, notes?: string): Promise<any> => {
    const response = await api.post<ApiEnvelope<any>>("/api/v1/allocation/allocate", {
      incidentId,
      resourceId,
      notes,
    });
    return unwrap(response);
  },

  deallocate: async (resourceId: string): Promise<any> => {
    const response = await api.post<ApiEnvelope<any>>(`/api/v1/allocation/deallocate/${resourceId}`);
    return unwrap(response);
  },
};

export interface AiCategorySuggestion {
  suggested_category: IncidentCategory;
  explanation: string;
  matched_keywords?: string[];
  total_matches?: number;
}

export interface AiSummary {
  summary: string;
  key_points: string[];
  estimated_impact: string;
}

export interface AiPriorityScore {
  score: number;
  factors: string[];
  max_score: number;
  confidence?: number;
}

export interface AiMissingField {
  field: string;
  severity: string;
  verification_suggestion: string;
}

export const aiApi = {
  categorySuggestion: async (data: {
    title: string;
    description: string;
  }): Promise<AiCategorySuggestion> => {
    const response = await api.post<ApiEnvelope<AiCategorySuggestion>>(
      "/api/v1/ai/category-suggestion",
      data
    );
    return unwrap(response);
  },

  summary: async (incidentId: string): Promise<AiSummary> => {
    const response = await api.post<ApiEnvelope<AiSummary>>(
      `/api/v1/ai/summary/${incidentId}`,
      {}
    );
    return unwrap(response);
  },

  priorityScore: async (incidentId: string): Promise<AiPriorityScore> => {
    const response = await api.post<ApiEnvelope<AiPriorityScore>>(
      `/api/v1/ai/priority/${incidentId}`,
      {}
    );
    return unwrap(response);
  },

  missingInfo: async (incidentId: string): Promise<AiMissingField[]> => {
    const response = await api.post<ApiEnvelope<{ missing_fields: AiMissingField[] }>>(
      `/api/v1/ai/missing-info/${incidentId}`,
      {}
    );
    return unwrap(response).missing_fields ?? [];
  },
};

export const voiceApi = {
  transcribe: async (audioFile: File): Promise<any> => {
    const fd = new FormData();
    fd.append("audio", audioFile);
    const response = await api.post<ApiEnvelope<any>>("/api/v1/voice/transcribe", fd, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return unwrap(response);
  },
};

export interface EvacuationRoute {
  routeId: string;
  name: string;
  path: [number, number][];
  distanceKm: number;
  estimatedTimeMins: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
  isAlternative: boolean;
  warning?: string;
}

export interface EvacuationPlan {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  safeRoutes: EvacuationRoute[];
  hazardZones: { center: [number, number]; radiusKm: number; title: string }[];
  blockedRoads: { coordinates: [number, number][]; reason: string }[];
  message?: string;
}

export const evacuationApi = {
  getPlan: async (
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): Promise<EvacuationPlan> => {
    const response = await api.get<ApiEnvelope<EvacuationPlan>>(
      "/api/v1/evacuation/plan",
      {
        params: { originLat, originLng, destLat, destLng },
      }
    );
    return unwrap(response);
  },
};

export const notificationApi = {
  list: async (params: {
    page?: number;
    limit?: number;
    unread?: boolean;
  } = {}): Promise<Paginated<AppNotification>> => {
    const response = await api.get<ApiEnvelope<Paginated<AppNotification>>>(
      "/api/v1/notifications",
      { params }
    );
    return unwrap(response);
  },

  unreadCount: async (): Promise<number> => {
    const response = await api.get<ApiEnvelope<{ unreadCount: number }>>(
      "/api/v1/notifications/unread-count"
    );
    return unwrap(response).unreadCount ?? 0;
  },

  markRead: async (id: string): Promise<AppNotification> => {
    const response = await api.patch<ApiEnvelope<AppNotification>>(
      `/api/v1/notifications/${id}/read`
    );
    return unwrap(response);
  },

  markAllRead: async (): Promise<number> => {
    const response = await api.patch<ApiEnvelope<{ modifiedCount: number }>>(
      "/api/v1/notifications/read-all"
    );
    return unwrap(response).modifiedCount ?? 0;
  },
};

export interface BroadcastRecord {
  _id: string;
  title: string;
  message: string;
  severity: Severity;
  channels: string[];
  scope: {
    targetRoles?: UserRole[];
    targetUserIds?: string[];
    zone?: string;
  };
  senderId: {
    _id: string;
    name: string;
    email: string;
    role: UserRole;
  };
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  totalRecipients: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  simulatedDeliveries: number;
  createdAt: string;
  updatedAt: string;
}

export interface BroadcastDeliveryRecord {
  _id: string;
  broadcastId: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    role: UserRole;
    phone?: string;
  };
  channel: string;
  status: "SIMULATED" | "QUEUED" | "SENT" | "DELIVERED" | "FAILED";
  recipientAddress: string;
  retryCount: number;
  errorMessage?: string;
  deliveredAt?: string;
}

export const broadcastApi = {
  create: async (data: {
    title: string;
    message: string;
    severity: Severity;
    channels: string[];
    scope?: {
      targetingMode?: string;
      targetRoles?: UserRole[];
      targetUserIds?: string[];
      incidentId?: string;
      center?: [number, number];
      radiusKm?: number;
      district?: string;
      city?: string;
      zone?: string;
    };
    idempotencyKey?: string;
  }): Promise<BroadcastRecord> => {
    const response = await api.post<ApiEnvelope<BroadcastRecord>>(
      "/api/v1/broadcasts",
      data
    );
    return unwrap(response);
  },

  preview: async (data: {
    title: string;
    message: string;
    severity: Severity;
    channels: string[];
    scope?: {
      targetingMode?: string;
      targetRoles?: UserRole[];
      targetUserIds?: string[];
      incidentId?: string;
      center?: [number, number];
      radiusKm?: number;
      district?: string;
      city?: string;
      zone?: string;
    };
  }): Promise<{ totalRecipients: number; byRole: Record<string, number>; channels: string[]; targetingMode: string }> => {
    const response = await api.post<ApiEnvelope<{ totalRecipients: number; byRole: Record<string, number>; channels: string[]; targetingMode: string }>>(
      "/api/v1/broadcasts/preview",
      data
    );
    return unwrap(response);
  },

  list: async (params: {
    page?: number;
    limit?: number;
    severity?: Severity | "";
    status?: string;
  } = {}): Promise<Paginated<BroadcastRecord>> => {
    const response = await api.get<ApiEnvelope<Paginated<BroadcastRecord>>>(
      "/api/v1/broadcasts",
      { params }
    );
    return unwrap(response);
  },

  get: async (id: string): Promise<{ broadcast: BroadcastRecord; deliveries: BroadcastDeliveryRecord[] }> => {
    const response = await api.get<ApiEnvelope<{ broadcast: BroadcastRecord; deliveries: BroadcastDeliveryRecord[] }>>(
      `/api/v1/broadcasts/${id}`
    );
    return unwrap(response);
  },
};

export const adminApi = {
  createUser: async (data: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    phone?: string;
  }): Promise<User> => {
    const response = await api.post<ApiEnvelope<User>>(
      "/api/v1/admin/users",
      data
    );
    return normaliseUser(unwrap(response));
  },

  getUsers: async (params: {
    page?: number;
    limit?: number;
    role?: UserRole | "";
    search?: string;
  } = {}): Promise<Paginated<User>> => {
    const response = await api.get<ApiEnvelope<Paginated<User>>>(
      "/api/v1/admin/users",
      { params }
    );
    return unwrap(response);
  },

  updateUserRole: async (id: string, role: UserRole): Promise<User> => {
    const response = await api.patch<ApiEnvelope<User>>(
      `/api/v1/admin/users/${id}/role`,
      { role }
    );
    return normaliseUser(unwrap(response));
  },

  getAuditLogs: async (params: {
    page?: number;
    limit?: number;
    entity?: string;
    action?: string;
  } = {}): Promise<Paginated<AuditLogEntry>> => {
    const response = await api.get<ApiEnvelope<Paginated<AuditLogEntry>>>(
      "/api/v1/admin/audit",
      { params }
    );
    return unwrap(response);
  },
};

export const statsApi = {
  dashboard: async (): Promise<DashboardStats> => {
    const response = await api.get<ApiEnvelope<DashboardStats>>(
      "/api/v1/stats"
    );
    return unwrap(response);
  },
};

export const assistantApi = {
  chat: async (message: string): Promise<{ response: string; role: string }> => {
    const response = await api.post<ApiEnvelope<{ response: string; role: string }>>(
      "/api/v1/assistant/chat",
      { message }
    );
    return unwrap(response);
  },
};

export default api;
