import type {
  AssignmentStatus,
  IncidentCategory,
  IncidentStatus,
  ResourceStatus,
  Severity,
  UserRole,
} from "../types/api";

/**
 * Single source of truth for how severity and status are presented.
 *
 * Every surface (badges, tables, map markers, filters) reads from here so the
 * same status is never rendered two different ways.
 */

export type Tone =
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "gray"
  | "purple"
  | "orange";

export interface StatusMeta {
  label: string;
  tone: Tone;
  /** Marker colour used on the map, matched to the badge tone. */
  color: string;
  description: string;
}

export const INCIDENT_STATUS_META: Record<IncidentStatus, StatusMeta> = {
  REPORTED: {
    label: "Reported",
    tone: "blue",
    color: "#2563eb",
    description: "Awaiting verification by a coordinator.",
  },
  VERIFIED: {
    label: "Verified",
    tone: "green",
    color: "#059669",
    description: "Confirmed and awaiting dispatch.",
  },
  ACTIVE: {
    label: "Active",
    tone: "orange",
    color: "#ea580c",
    description: "Response in progress.",
  },
  RESOLVED: {
    label: "Resolved",
    tone: "purple",
    color: "#7c3aed",
    description: "On-scene work complete, pending close-out.",
  },
  CLOSED: {
    label: "Closed",
    tone: "gray",
    color: "#64748b",
    description: "Archived. No further action expected.",
  },
};

export const SEVERITY_META: Record<Severity, StatusMeta> = {
  LOW: {
    label: "Low",
    tone: "green",
    color: "#059669",
    description: "Minimal impact. Routine monitoring.",
  },
  MEDIUM: {
    label: "Medium",
    tone: "yellow",
    color: "#ca8a04",
    description: "Localised impact. Response may be required.",
  },
  HIGH: {
    label: "High",
    tone: "orange",
    color: "#ea580c",
    description: "Significant impact. Response required.",
  },
  CRITICAL: {
    label: "Critical",
    tone: "red",
    color: "#dc2626",
    description: "Severe, life-safety impact. Immediate response.",
  },
};

export const RESOURCE_STATUS_META: Record<ResourceStatus, StatusMeta> = {
  AVAILABLE: {
    label: "Available",
    tone: "green",
    color: "#059669",
    description: "Ready for immediate dispatch.",
  },
  ON_MISSION: {
    label: "On Mission",
    tone: "blue",
    color: "#2563eb",
    description: "Currently deployed to an incident.",
  },
  MAINTENANCE: {
    label: "Maintenance",
    tone: "yellow",
    color: "#ca8a04",
    description: "Out of service pending repair or checks.",
  },
  UNAVAILABLE: {
    label: "Unavailable",
    tone: "gray",
    color: "#64748b",
    description: "Not currently serviceable.",
  },
};

export const ASSIGNMENT_STATUS_META: Record<AssignmentStatus, StatusMeta> = {
  PENDING: {
    label: "Pending",
    tone: "yellow",
    color: "#ca8a04",
    description: "Awaiting responder acknowledgement.",
  },
  ACCEPTED: {
    label: "Accepted",
    tone: "blue",
    color: "#2563eb",
    description: "Responder accepted. Awaiting departure.",
  },
  DECLINED: {
    label: "Declined",
    tone: "gray",
    color: "#64748b",
    description: "Responder declined the dispatch.",
  },
  DISPATCHED: {
    label: "Dispatched",
    tone: "blue",
    color: "#2563eb",
    description: "En route to the incident.",
  },
  ARRIVED: {
    label: "Arrived",
    tone: "green",
    color: "#059669",
    description: "On scene.",
  },
  COMPLETED: {
    label: "Completed",
    tone: "purple",
    color: "#7c3aed",
    description: "Task finished and reported.",
  },
  CANCELLED: {
    label: "Cancelled",
    tone: "gray",
    color: "#64748b",
    description: "Dispatch withdrawn by a coordinator.",
  },
  EXPIRED: {
    label: "Expired",
    tone: "gray",
    color: "#64748b",
    description: "Acknowledgement window elapsed.",
  },
};

export const INCIDENT_CATEGORY_META: Record<IncidentCategory, StatusMeta> = {
  FLOOD: {
    label: "Flood",
    tone: "blue",
    color: "#2563eb",
    description: "Flooding or water rescue.",
  },
  FIRE: {
    label: "Fire",
    tone: "orange",
    color: "#ea580c",
    description: "Fire or smoke event.",
  },
  EARTHQUAKE: {
    label: "Earthquake",
    tone: "red",
    color: "#dc2626",
    description: "Seismic event.",
  },
  LANDSLIDE: {
    label: "Landslide",
    tone: "yellow",
    color: "#ca8a04",
    description: "Ground movement or collapse.",
  },
  MEDICAL: {
    label: "Medical",
    tone: "purple",
    color: "#7c3aed",
    description: "Medical emergency.",
  },
  OTHER: {
    label: "Other",
    tone: "gray",
    color: "#64748b",
    description: "Does not fit another category.",
  },
};

export const ROLE_META: Record<UserRole, StatusMeta> = {
  ADMIN: {
    label: "Admin",
    tone: "purple",
    color: "#7c3aed",
    description: "Full administrative and operational access.",
  },
  COORDINATOR: {
    label: "Coordinator",
    tone: "blue",
    color: "#2563eb",
    description: "Can verify, dispatch, and manage incidents.",
  },
  RESPONDER: {
    label: "Responder",
    tone: "green",
    color: "#059669",
    description: "Field responder. Can accept and progress own dispatches.",
  },
  VIEWER: {
    label: "Viewer",
    tone: "gray",
    color: "#64748b",
    description: "Read-only situational awareness access.",
  },
};

/** Ordered lists used to populate filter selects. */
export const INCIDENT_STATUSES = Object.keys(
  INCIDENT_STATUS_META
) as IncidentStatus[];

export const SEVERITIES = Object.keys(SEVERITY_META) as Severity[];

export const INCIDENT_CATEGORIES = Object.keys(
  INCIDENT_CATEGORY_META
) as IncidentCategory[];

export const RESOURCE_STATUSES = Object.keys(
  RESOURCE_STATUS_META
) as ResourceStatus[];

export const ASSIGNMENT_STATUSES = Object.keys(
  ASSIGNMENT_STATUS_META
) as AssignmentStatus[];

export const USER_ROLES = Object.keys(ROLE_META) as UserRole[];

/**
 * Valid incident status transitions, mirroring the backend's workflow rules.
 * The backend rejects invalid transitions, so the UI must not offer them.
 */
export const INCIDENT_STATUS_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  REPORTED: ["VERIFIED", "ACTIVE"],
  VERIFIED: ["ACTIVE", "REPORTED"],
  ACTIVE: ["RESOLVED", "CLOSED"],
  RESOLVED: ["ACTIVE", "CLOSED"],
  CLOSED: [],
};

export const ASSIGNMENT_STATUS_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
  PENDING: ["ACCEPTED", "DECLINED", "EXPIRED"],
  ACCEPTED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["COMPLETED", "CANCELLED"],
  DECLINED: [],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};

/** Resource availability transitions allowed by the backend. */
export const RESOURCE_STATUS_TRANSITIONS: Record<ResourceStatus, ResourceStatus[]> = {
  AVAILABLE: ["ON_MISSION", "MAINTENANCE", "UNAVAILABLE"],
  ON_MISSION: ["MAINTENANCE", "UNAVAILABLE"],
  MAINTENANCE: ["AVAILABLE", "UNAVAILABLE"],
  UNAVAILABLE: ["AVAILABLE", "MAINTENANCE"],
};

export const UNKNOWN_META: StatusMeta = {
  label: "Unknown",
  tone: "gray",
  color: "#64748b",
  description: "",
};

/** Look up metadata for a status, falling back to a neutral "Unknown". */
export const getIncidentStatusMeta = (status?: string): StatusMeta =>
  (status && INCIDENT_STATUS_META[status as IncidentStatus]) || UNKNOWN_META;

export const getSeverityMeta = (severity?: string): StatusMeta =>
  (severity && SEVERITY_META[severity as Severity]) || UNKNOWN_META;

export const getResourceStatusMeta = (status?: string): StatusMeta =>
  (status && RESOURCE_STATUS_META[status as ResourceStatus]) || UNKNOWN_META;

export const getAssignmentStatusMeta = (status?: string): StatusMeta =>
  (status && ASSIGNMENT_STATUS_META[status as AssignmentStatus]) || UNKNOWN_META;

export const getCategoryMeta = (category?: string): StatusMeta =>
  (category && INCIDENT_CATEGORY_META[category as IncidentCategory]) ||
  UNKNOWN_META;

export const getRoleMeta = (role?: string): StatusMeta =>
  (role && ROLE_META[role as UserRole]) || UNKNOWN_META;
