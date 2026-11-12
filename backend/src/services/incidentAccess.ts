import { IIncidentDocument } from "../models/Incident.js";
import { IncidentStatus, UserRole } from "../types/models.js";

/**
 * Who may subscribe to an incident's live room.
 *
 * Joining a room is a subscription to a stream of updates about that
 * incident, so the two socket handlers that grant it — JOIN_INCIDENT and
 * REQUEST_MISSED_UPDATES — must apply the same rule. Previously only
 * JOIN_INCIDENT checked anything, and REQUEST_MISSED_UPDATES checked
 * nothing at all, so any authenticated socket could pull the full state and
 * audit history of any incident, including closed ones.
 *
 * The rules:
 * - ADMIN and COORDINATOR see everything.
 * - RESPONDER sees anything that is still open, plus anything assigned to
 *   them (including a closed record they worked).
 * - VIEWER sees anything that has not been closed.
 */
export const canJoinIncidentRoom = (
  incident: Pick<IIncidentDocument, "status" | "assignedTo">,
  user: { id: string; role: UserRole }
): boolean => {
  if (user.role === "ADMIN" || user.role === "COORDINATOR") {
    return true;
  }

  const assignedTo = (incident.assignedTo as any)?._id?.toString
    ? (incident.assignedTo as any)._id.toString()
    : incident.assignedTo?.toString();

  if (assignedTo && assignedTo === user.id) {
    return true;
  }

  return incident.status !== IncidentStatus.CLOSED;
};

/**
 * Only ADMIN and COORDINATOR users are permitted to view the reporter's contact phone number.
 */
export const canViewReporterPhone = (user?: { role?: string } | null): boolean => {
  return user?.role === "ADMIN" || user?.role === "COORDINATOR";
};

/**
 * Access control check for incident attachment download.
 */
export const canAccessIncidentAttachment = (
  incident: Pick<IIncidentDocument, "status" | "assignedTo" | "reportedBy">,
  user: { id: string; role: UserRole }
): boolean => {
  if (user.role === "ADMIN" || user.role === "COORDINATOR") {
    return true;
  }

  const reportedBy = (incident.reportedBy as any)?._id?.toString
    ? (incident.reportedBy as any)._id.toString()
    : incident.reportedBy?.toString();

  if (reportedBy && reportedBy === user.id) {
    return true;
  }

  const assignedTo = (incident.assignedTo as any)?._id?.toString
    ? (incident.assignedTo as any)._id.toString()
    : incident.assignedTo?.toString();

  if (assignedTo && assignedTo === user.id) {
    return true;
  }

  // Active / open incidents can be viewed by responders and viewers
  return incident.status !== IncidentStatus.CLOSED;
};

/**
 * The reason a subscription was refused, for an error message.
 */
export const incidentRoomRefusal = (user: { role: UserRole }): string =>
  user.role === "VIEWER"
    ? "Unauthorized to view closed incident"
    : "Unauthorized to view this incident";

export default {
  canJoinIncidentRoom,
  incidentRoomRefusal,
  canViewReporterPhone,
  canAccessIncidentAttachment,
};
