/**
 * Shared API types mirroring the RescueGrid backend contract.
 *
 * The backend wraps every response in `{ success, message, data }`. The types
 * below describe the *unwrapped* payloads the UI actually consumes.
 */

export type UserRole = "ADMIN" | "COORDINATOR" | "RESPONDER" | "VIEWER";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type IncidentStatus =
  | "REPORTED"
  | "VERIFIED"
  | "ACTIVE"
  | "RESOLVED"
  | "CLOSED";

export type IncidentCategory =
  | "FLOOD"
  | "FIRE"
  | "EARTHQUAKE"
  | "LANDSLIDE"
  | "MEDICAL"
  | "OTHER";

export type ResourceStatus =
  | "AVAILABLE"
  | "ON_MISSION"
  | "MAINTENANCE"
  | "UNAVAILABLE";

export type AssignmentStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "DISPATCHED"
  | "ARRIVED"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

export type NotificationType =
  | "INCIDENT"
  | "ASSIGNMENT"
  | "RESOURCE"
  | "BROADCAST";

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  isAvailable?: boolean;
  createdAt?: string;
}

export interface IncidentAuditEntry {
  action: string;
  actorId: string;
  actorRole: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface IncidentAttachment {
  _id: string;
  type: "IMAGE" | "VIDEO";
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

export interface Incident {
  _id: string;
  title: string;
  description: string;
  severity: Severity;
  category: IncidentCategory;
  status: IncidentStatus;
  priority: number;
  location?: GeoPoint;
  address?: string;
  contactPhone?: string;
  reportedBy?: {
    _id?: string;
    id?: string;
    name?: string;
    email?: string;
    role?: UserRole;
    phone?: string;
  } | null;
  /**
   * The responsible responder.
   *
   * The backend populates this reference on read, so it arrives as a person
   * rather than a bare identifier. It stays a string for the one case that
   * still holds an id: the `assignedTo` echoed inside a socket event payload.
   */
  assignedTo?:
    | string
    | {
        _id?: string;
        id?: string;
        name?: string;
        email?: string;
        role?: UserRole;
      }
    | null;
  tags: string[];
  attachments?: IncidentAttachment[];
  version: number;
  auditLog?: IncidentAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Resource {
  _id: string;
  name: string;
  type: string;
  category: string;
  status: ResourceStatus;
  location?: GeoPoint;
  address?: string;
  capacity?: number;
  contact?: string;
  availableAt?: string;
  lastUpdated: string;
  createdAt?: string;
}

export interface Assignment {
  _id: string;
  incidentId: string | { _id: string; title?: string; status?: IncidentStatus; severity?: Severity };
  responderId: string | { _id: string; name?: string; email?: string; role?: UserRole };
  resourceId?: string | { _id: string; name?: string; type?: string; status?: ResourceStatus } | null;
  status: AssignmentStatus;
  assignedAt: string;
  completedAt?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  _id: string;
  action: string;
  entity: string;
  entityId: string;
  actorId: string | { _id: string; name?: string; email?: string; role?: UserRole } | null;
  actorRole: UserRole;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore?: boolean;
  unreadCount?: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export interface DashboardStats {
  incidents: {
    total: number;
    byStatus: Record<IncidentStatus, number>;
    bySeverity: Record<Severity, number>;
    byCategory: Record<string, number>;
    openTotal: number;
    unassignedTotal: number;
  };
  resources: {
    total: number;
    byStatus: Record<ResourceStatus, number>;
    byType: Record<string, number>;
  };
  assignments: {
    total: number;
    byStatus: Record<AssignmentStatus, number>;
    pendingTotal: number;
    activeTotal: number;
  };
  generatedAt: string;
}

export interface Responder {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isAvailable: boolean;
}

/** Standard socket event envelope emitted by the backend. */
export interface SocketEvent<T> {
  eventId: string;
  eventType: string;
  timestamp: string;
  sequenceNumber?: number;
  data: T;
}

export interface IncidentEventData {
  incidentId: string;
  title: string;
  severity: Severity;
  category: IncidentCategory;
  status: IncidentStatus;
  location?: GeoPoint;
  assignedTo?: string;
  updatedBy?: string;
  previousStatus?: IncidentStatus;
}

export interface ResourceEventData {
  resourceId: string;
  name: string;
  type: string;
  status: ResourceStatus;
  previousStatus?: ResourceStatus;
  location?: GeoPoint;
  lastUpdated: string;
}

export interface AssignmentEventData {
  assignmentId: string;
  incidentId: string;
  responderId: string;
  resourceId?: string;
  status: AssignmentStatus;
  previousStatus?: AssignmentStatus;
  updatedBy: string;
}

export interface NotificationEventData {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string;
  createdAt: string;
}
