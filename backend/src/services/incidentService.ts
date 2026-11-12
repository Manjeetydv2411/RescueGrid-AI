import mongoose, { FilterQuery } from "mongoose";
import Incident, { IIncidentDocument } from "../models/Incident.js";
import User from "../models/User.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { IncidentStatus, IncidentCategory, Severity, IIncidentAttachment } from "../types/models.js";
import * as socketService from "../socket/socketService.js";
import * as notificationService from "./notificationService.js";

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface IncidentFilter {
  status?: IncidentStatus | string;
  severity?: Severity | string;
  category?: IncidentCategory | string;
  search?: string;
  near?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedIncidents {
  data: IIncidentDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export const createIncident = async (
  title: string,
  description: string,
  severity: Severity,
  category: IncidentCategory,
  location: { type: "Point"; coordinates: [number, number] },
  reportedBy: string,
  address?: string,
  tags?: string[],
  contactPhone?: string,
  attachments?: IIncidentAttachment[]
): Promise<IIncidentDocument> => {
  const incident = await Incident.create({
    title,
    description,
    severity,
    category,
    location,
    reportedBy,
    address,
    tags,
    contactPhone,
    attachments: attachments || [],
  });

  // The reporter's role is needed for the audit trail and to decide who
  // should be notified. Any user may report an incident, so the role is
  // whatever the authenticated caller's role actually is — it must not be
  // assumed.
  const reporter = await User.findById(reportedBy).select("role").lean();

  // Add to audit log
  await addAuditEntry(
    incident._id.toString(),
    "INCIDENT_CREATED",
    reportedBy,
    reporter?.role ?? "VIEWER",
    {
      title,
      description,
      severity,
      category,
      location,
    }
  );

  logger.info(`Incident created: ${incident._id} by user ${reportedBy}`);

  // Emit real-time socket event after DB write succeeds
  socketService.emitIncidentCreated({
    incidentId: incident._id.toString(),
    title: incident.title,
    severity: incident.severity,
    category: incident.category,
    status: incident.status,
    location: incident.location,
    updatedBy: reportedBy,
  });

  // Tell the coordinators and admins that a new report is waiting for
  // triage. Without this, a reported incident is only visible to someone who
  // happens to open the incident list.
  await notifyDispatchers({
    title: `New ${severity.toLowerCase()} incident reported`,
    message: `${title} — awaiting verification.`,
    relatedId: incident._id.toString(),
    excludeUserId: reportedBy,
  });

  return incident.populate("reportedBy", "name email role phone");
};

/**
 * Notify every administrator and coordinator, optionally skipping one user.
 *
 * Used for events that the whole coordination team needs to see, such as a
 * newly reported incident. Recipients who cannot act on the notification
 * (the reporter themselves, for instance) are left out.
 */
export const notifyDispatchers = async (params: {
  title: string;
  message: string;
  relatedId?: string;
  excludeUserId?: string;
  type?: "INCIDENT" | "ASSIGNMENT" | "RESOURCE" | "BROADCAST";
}): Promise<void> => {
  try {
    const recipients = await User.find({
      role: { $in: ["ADMIN", "COORDINATOR"] },
    })
      .select("_id")
      .lean();

    for (const recipient of recipients) {
      const recipientId = recipient._id.toString();
      if (params.excludeUserId && recipientId === params.excludeUserId) {
        continue;
      }

      await notificationService.notify({
        userId: recipientId,
        type: params.type ?? "INCIDENT",
        title: params.title,
        message: params.message,
        relatedId: params.relatedId,
      });
    }
  } catch (error) {
    logger.warn(
      `Unable to notify dispatchers: ${(error as Error).message}`
    );
  }
};

export const getIncidentById = async (id: string): Promise<IIncidentDocument | null> => {
  // `assignedTo` is populated alongside `reportedBy` so the record names the
  // responsible responder rather than only carrying their identifier. The
  // dashboard's "unassigned" count is derived from this field, so a caller
  // that reads the incident has to be able to see who is answerable for it.
  return Incident.findById(id).populate(
    "reportedBy assignedTo",
    "name email role phone"
  );
};

export const updateIncident = async (
  incidentId: string,
  updates: {
    title?: string;
    description?: string;
    severity?: Severity;
    category?: IncidentCategory;
    status?: IncidentStatus;
    assignedTo?: string;
    location?: { type: "Point"; coordinates: [number, number] };
    address?: string;
    tags?: string[];
    contactPhone?: string;
  },
  actorId: string,
  actorRole: string
): Promise<IIncidentDocument> => {
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw new NotFoundError("Incident", incidentId);
  }

  // Validate status transitions
  if (updates.status) {
    const isValidTransition = isValidStatusTransition(incident.status, updates.status);
    if (!isValidTransition) {
      throw new ValidationError(
        `Invalid status transition from ${incident.status} to ${updates.status}`
      );
    }
  }

  const previousStatus = incident.status;

  // Apply updates
  if (updates.title) incident.title = updates.title;
  if (updates.description) incident.description = updates.description;
  if (updates.severity) incident.severity = updates.severity;
  if (updates.category) incident.category = updates.category;
  if (updates.status) incident.status = updates.status;
  if (updates.assignedTo) incident.assignedTo = updates.assignedTo;
  if (updates.location) incident.location = updates.location;
  if (updates.address) incident.address = updates.address;
  if (updates.tags !== undefined) incident.tags = updates.tags;
  if (updates.contactPhone !== undefined) incident.contactPhone = updates.contactPhone;

  incident.version = (incident.version || 0) + 1;

  // Add to audit log
  await addAuditEntry(incident._id.toString(), "INCIDENT_UPDATED", actorId, actorRole, updates);

  await incident.save();

  // Emit real-time socket events after DB write succeeds
  const eventData = {
    incidentId: incident._id.toString(),
    title: incident.title,
    severity: incident.severity,
    category: incident.category,
    status: incident.status,
    previousStatus,
    location: incident.location,
    assignedTo: incident.assignedTo?.toString(),
    updatedBy: actorId,
  };

  if (updates.status && updates.status !== previousStatus) {
    socketService.emitIncidentStatusChanged(eventData);
  } else {
    socketService.emitIncidentUpdated(eventData);
  }

  // `assignedTo` is populated alongside `reportedBy` so the caller sees the
  // responder the update names, not just the identifier that was written.
  return incident.populate("reportedBy assignedTo", "name email role phone");
};

export const deleteIncident = async (incidentId: string): Promise<void> => {
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw new NotFoundError("Incident", incidentId);
  }

  await Incident.deleteOne({ _id: incidentId });
  logger.info(`Incident deleted: ${incidentId}`);
};

// Severity ranks so "sort by severity" is meaningful (LOW -> CRITICAL)
const SEVERITY_RANK: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

// Status ranks follow the operational workflow order
const STATUS_RANK: Record<string, number> = {
  REPORTED: 1,
  VERIFIED: 2,
  ACTIVE: 3,
  RESOLVED: 4,
  CLOSED: 5,
};

const INCIDENT_SORT_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "priority",
  "severity",
  "status",
  "title",
]);

/**
 * Build the sort stage for a list query.
 *
 * "severity" and "status" are not stored in a sortable order (they are strings
 * and an enum respectively), so they are ranked via a computed field. Everything
 * else sorts directly on the stored field.
 */
const buildIncidentSortStage = (
  sortBy?: string,
  sortOrder?: "asc" | "desc"
): Record<string, 1 | -1> => {
  const direction: 1 | -1 = sortOrder === "asc" ? 1 : -1;

  if (!sortBy || !INCIDENT_SORT_FIELDS.has(sortBy)) {
    return { priority: -1, createdAt: -1 };
  }

  if (sortBy === "severity") {
    return { _severityRank: direction, createdAt: -1 };
  }

  if (sortBy === "status") {
    return { _statusRank: direction, createdAt: -1 };
  }

  return { [sortBy]: direction, _id: 1 };
};

const RANK_STAGES = [
  {
    $addFields: {
      _severityRank: {
        $switch: {
          branches: Object.entries(SEVERITY_RANK).map(([value, rank]) => ({
            case: { $eq: ["$severity", value] },
            then: rank,
          })),
          default: 0,
        },
      },
      _statusRank: {
        $switch: {
          branches: Object.entries(STATUS_RANK).map(([value, rank]) => ({
            case: { $eq: ["$status", value] },
            then: rank,
          })),
          default: 0,
        },
      },
    },
  },
];

/**
 * Escape user-supplied search text so regex metacharacters cannot alter the
 * query (and so a malformed pattern cannot throw at the database).
 */
export const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Aggregate incident counts for the operations dashboard.
 *
 * These are computed directly against the database (not derived from a
 * paginated page) so the dashboard always reflects the full picture.
 */
export const getIncidentStats = async (): Promise<{
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  openTotal: number;
  unassignedTotal: number;
}> => {
  const [total, statusCounts, severityCounts, categoryCounts, unassigned] =
    await Promise.all([
      Incident.countDocuments({}),
      Incident.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Incident.aggregate([
        { $group: { _id: "$severity", count: { $sum: 1 } } },
      ]),
      Incident.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
      Incident.countDocuments({
        status: { $in: ["REPORTED", "VERIFIED", "ACTIVE"] },
        $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }],
      }),
    ]);

  const toRecord = (
    rows: { _id: string | null; count: number }[]
  ): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const row of rows) {
      if (row._id) result[row._id] = row.count;
    }
    return result;
  };

  const byStatus = toRecord(statusCounts);
  const bySeverity = toRecord(severityCounts);

  // Every status key is always present so the UI can render a complete summary
  // even when a bucket is empty.
  const byStatusFull = {
    REPORTED: byStatus.REPORTED || 0,
    VERIFIED: byStatus.VERIFIED || 0,
    ACTIVE: byStatus.ACTIVE || 0,
    RESOLVED: byStatus.RESOLVED || 0,
    CLOSED: byStatus.CLOSED || 0,
  };

  const bySeverityFull = {
    LOW: bySeverity.LOW || 0,
    MEDIUM: bySeverity.MEDIUM || 0,
    HIGH: bySeverity.HIGH || 0,
    CRITICAL: bySeverity.CRITICAL || 0,
  };

  const openTotal =
    byStatusFull.REPORTED + byStatusFull.VERIFIED + byStatusFull.ACTIVE;

  return {
    total,
    byStatus: byStatusFull,
    bySeverity: bySeverityFull,
    byCategory: toRecord(categoryCounts),
    openTotal,
    unassignedTotal: unassigned,
  };
};

export const listIncidents = async (
  filter: IncidentFilter = {},
  pagination: PaginationOptions = { page: 1, limit: 20 }
): Promise<PaginatedIncidents> => {
  const query: FilterQuery<IIncidentDocument> = {};

  if (filter.status) {
    query.status = filter.status;
  }

  if (filter.severity) {
    query.severity = filter.severity;
  }

  if (filter.category) {
    query.category = filter.category;
  }

  if (filter.search) {
    const searchRegex = new RegExp(escapeRegExp(filter.search), "i");
    query.$or = [
      { title: searchRegex },
      { description: searchRegex },
      { address: searchRegex },
    ];
  }

  // Geospatial search
  if (filter.near) {
    const [lng, lat] = filter.near.split(",").map((c) => parseFloat(c.trim()));
    if (!isNaN(lng) && !isNaN(lat)) {
      query.location = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          $maxDistance: 50000, // 50km
        },
      };
    }
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const total = await Incident.countDocuments(query);
  const totalPages = Math.ceil(total / pagination.limit);

  const sortStage = buildIncidentSortStage(filter.sortBy, filter.sortOrder);
  const needsRankStage =
    sortStage._severityRank !== undefined || sortStage._statusRank !== undefined;

  let data: IIncidentDocument[];

  if (needsRankStage) {
    // Ranked sorting (severity/status) requires an aggregation pipeline.
    const rows = await Incident.aggregate([
      { $match: query },
      ...RANK_STAGES,
      { $sort: sortStage },
      { $skip: skip },
      { $limit: pagination.limit },
      {
        // The reporter and the responsible responder are resolved to people
        // rather than identifiers, for the same reason the non-aggregate
        // branch populates them: the record has to say who reported the
        // incident and who is answerable for it.
        //
        // The lookup projects exactly the fields the `populate` call
        // selects, so the two branches return the same shape and neither
        // exposes the stored password hash.
        $lookup: {
          from: "users",
          let: { incidentReporter: "$reportedBy" },
          pipeline: [
            {
              $match: { $expr: { $eq: ["$_id", "$$incidentReporter"] } },
            },
            {
              $project: {
                _id: 1,
                name: 1,
                email: 1,
                role: 1,
                phone: 1,
              },
            },
          ],
          as: "reportedBy",
        },
      },
      {
        $unwind: {
          path: "$reportedBy",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          let: { incidentAssignee: "$assignedTo" },
          pipeline: [
            {
              $match: { $expr: { $eq: ["$_id", "$$incidentAssignee"] } },
            },
            {
              $project: {
                _id: 1,
                name: 1,
                email: 1,
                role: 1,
                phone: 1,
              },
            },
          ],
          as: "assignedTo",
        },
      },
      {
        // Unlike the reporter, the responsible responder is optional, so
        // the empty array is dropped rather than preserved. Preserving it
        // would leave `assignedTo: []` on every unassigned incident — a
        // value that is neither a person nor an absent field, and so not
        // what the populated branch returns.
        $unwind: { path: "$assignedTo", preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          _severityRank: 0,
          _statusRank: 0,
        },
      },
    ]);

    data = rows as unknown as IIncidentDocument[];
  } else {
    data = await Incident.find(query)
      .sort(sortStage)
      .skip(skip)
      .limit(pagination.limit)
      .populate("reportedBy assignedTo", "name email role phone");
  }

  return {
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
      hasMore: pagination.page < totalPages,
    },
  };
};

export const getNearbyIncidents = async (
  lng: number,
  lat: number,
  maxDistance: number = 50000,
  limit: number = 10
): Promise<IIncidentDocument[]> => {
  return Incident.find({
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
        $maxDistance: maxDistance,
      },
    },
  })
    .sort({ priority: -1, createdAt: -1 })
    .limit(limit)
    .populate("reportedBy assignedTo", "name email role phone");
};

// Status transition rules
const validTransitions: Record<IncidentStatus, IncidentStatus[]> = {
  [IncidentStatus.REPORTED]: [IncidentStatus.VERIFIED, IncidentStatus.ACTIVE],
  [IncidentStatus.VERIFIED]: [IncidentStatus.ACTIVE, IncidentStatus.REPORTED],
  [IncidentStatus.ACTIVE]: [IncidentStatus.RESOLVED, IncidentStatus.CLOSED],
  [IncidentStatus.RESOLVED]: [IncidentStatus.ACTIVE, IncidentStatus.CLOSED],
  [IncidentStatus.CLOSED]: [],
};

export const isValidStatusTransition = (
  current: IncidentStatus,
  newStatus: IncidentStatus
): boolean => {
  if (!validTransitions[current]) return false;
  return validTransitions[current].includes(newStatus);
};

export const addAuditEntry = async (
  incidentId: string,
  action: string,
  actorId: string,
  actorRole: string,
  details?: Record<string, unknown>
): Promise<void> => {
  await Incident.findByIdAndUpdate(incidentId, {
    $push: {
      auditLog: {
        action,
        actorId,
        actorRole,
        timestamp: new Date(),
        details,
      },
    },
  });
};

export const assignIncident = async (
  incidentId: string,
  assignedTo: string,
  actorId: string,
  actorRole: string
): Promise<IIncidentDocument> => {
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw new NotFoundError("Incident", incidentId);
  }

  // Verify coordinator can assign
  if (actorRole !== "ADMIN" && actorRole !== "COORDINATOR") {
    throw new ForbiddenError("Only admins and coordinators can assign incidents");
  }

  // Verify assigned user exists
  const user = await User.findById(assignedTo);
  if (!user) {
    throw new ValidationError("Assigned user not found");
  }

  // Update status to VERIFIED if assigning
  if (incident.status === IncidentStatus.REPORTED) {
    incident.status = IncidentStatus.VERIFIED;
  }

  incident.assignedTo = assignedTo;
  incident.version = (incident.version || 0) + 1;

  await addAuditEntry(incident._id.toString(), "INCIDENT_ASSIGNED", actorId, actorRole, {
    assignedTo,
  });

  await incident.save();

  // Emit real-time update. Assignment has its own event so that clients
  // showing the responsible responder can react to the change of responder
  // specifically, rather than to any edit of the record.
  socketService.emitIncidentAssigned({
    incidentId: incident._id.toString(),
    title: incident.title,
    severity: incident.severity,
    category: incident.category,
    status: incident.status,
    location: incident.location,
    assignedTo,
    updatedBy: actorId,
  });

  return incident.populate("reportedBy assignedTo", "name email role phone");
};

export const unassignIncident = async (
  incidentId: string,
  actorId: string,
  actorRole: string
): Promise<IIncidentDocument> => {
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw new NotFoundError("Incident", incidentId);
  }

  if (actorRole !== "ADMIN" && actorRole !== "COORDINATOR") {
    throw new ForbiddenError("Only admins and coordinators can unassign incidents");
  }

  incident.assignedTo = undefined;
  incident.version = (incident.version || 0) + 1;

  await addAuditEntry(incident._id.toString(), "INCIDENT_UNASSIGNED", actorId, actorRole, {});

  await incident.save();

  // Tell the clients that the incident no longer has a responsible
  // responder. Without this the map and the incident record keep showing the
  // old assignment until someone reloads the page.
  socketService.emitIncidentUnassigned({
    incidentId: incident._id.toString(),
    title: incident.title,
    severity: incident.severity,
    category: incident.category,
    status: incident.status,
    location: incident.location,
    updatedBy: actorId,
  });

  // The responder was just cleared, so there is no person to populate — the
  // field stays absent, which is what the incident list reads as
  // "unassigned".
  return incident.populate("reportedBy assignedTo", "name email role phone");
};

export const getIncidentAttachment = async (
  incidentId: string,
  attachmentId: string
): Promise<{ incident: IIncidentDocument; attachment: IIncidentAttachment } | null> => {
  const incident = await Incident.findById(incidentId);
  if (!incident) return null;

  const attachment = incident.attachments?.find(
    (att: any) =>
      att._id?.toString() === attachmentId ||
      att.id === attachmentId ||
      att._id === attachmentId
  );
  if (!attachment) return null;

  return { incident, attachment };
};

export default {
  createIncident,
  getIncidentById,
  updateIncident,
  deleteIncident,
  listIncidents,
  getNearbyIncidents,
  isValidStatusTransition,
  addAuditEntry,
  assignIncident,
  unassignIncident,
  getIncidentAttachment,
};
