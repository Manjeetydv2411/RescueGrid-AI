export type UserRole = "ADMIN" | "COORDINATOR" | "RESPONDER" | "VIEWER";

export enum Severity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

// Incident status workflow: REPORTED -> VERIFIED -> ACTIVE -> RESOLVED -> CLOSED
export enum IncidentStatus {
  REPORTED = "REPORTED",
  VERIFIED = "VERIFIED",
  ACTIVE = "ACTIVE",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

export enum IncidentCategory {
  FLOOD = "FLOOD",
  FIRE = "FIRE",
  EARTHQUAKE = "EARTHQUAKE",
  LANDSLIDE = "LANDSLIDE",
  MEDICAL = "MEDICAL",
  OTHER = "OTHER",
}

// Resource types for emergency response
export enum ResourceType {
  AMBULANCE = "AMBULANCE",
  MEDICAL_TEAM = "MEDICAL_TEAM",
  RESCUE_TEAM = "RESCUE_TEAM",
  SHELTER = "SHELTER",
  FIRE_UNIT = "FIRE_UNIT",
  SUPPLY_DEPOT = "SUPPLY_DEPOT",
  EQUIPMENT = "EQUIPMENT",
}

// Resource status
export enum ResourceStatus {
  AVAILABLE = "AVAILABLE",
  ON_MISSION = "ON_MISSION",
  MAINTENANCE = "MAINTENANCE",
  UNAVAILABLE = "UNAVAILABLE",
}

// Assignment status workflow
export enum AssignmentStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  DECLINED = "DECLINED",
  DISPATCHED = "DISPATCHED",
  ARRIVED = "ARRIVED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface AuditEntry {
  action: string;
  actorId: string;
  actorRole: UserRole;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export type AttachmentType = "IMAGE" | "VIDEO";

export interface IIncidentAttachment {
  _id?: string;
  type: AttachmentType;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url?: string;
  createdAt: Date;
}
