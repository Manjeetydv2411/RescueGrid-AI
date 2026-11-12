import mongoose, { FilterQuery } from "mongoose";
import Incident from "../models/Incident.js";
import User from "../models/User.js";
import Resource from "../models/Resource.js";
import Assignment, { IAssignmentDocument } from "../models/Assignment.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { AssignmentStatus } from "../types/models.js";
import { escapeRegExp } from "./incidentService.js";
import * as socketService from "../socket/socketService.js";
import * as notificationService from "./notificationService.js";

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface AssignmentFilter {
  status?: AssignmentStatus | string;
  incidentId?: string;
  responderId?: string;
  resourceId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedAssignments {
  data: IAssignmentDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export const createAssignment = async (
  incidentId: string,
  responderId: string,
  resourceId?: string,
  notes?: string
): Promise<IAssignmentDocument> => {
  // Verify incident exists
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw new NotFoundError("Incident", incidentId);
  }

  // Verify responder exists
  const responder = await User.findById(responderId);
  if (!responder) {
    throw new NotFoundError("Responder", responderId);
  }

  // Verify resource exists if provided
  let resource: any = null;
  if (resourceId) {
    resource = await Resource.findById(resourceId);
    if (!resource) {
      throw new NotFoundError("Resource", resourceId);
    }
  }

  // Check for existing active assignment for this responder
  const existingAssignment = await Assignment.findOne({
    responderId,
    status: { $in: [AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED, AssignmentStatus.DISPATCHED] },
  });

  if (existingAssignment) {
    throw new ValidationError(
      `Responder already has active assignment (ID: ${existingAssignment._id})`
    );
  }

  // Check for concurrent resource assignment
  if (resourceId) {
    const concurrentResourceAssignment = await Assignment.findOne({
      resourceId,
      status: {
        $in: [
          AssignmentStatus.PENDING,
          AssignmentStatus.ACCEPTED,
          AssignmentStatus.DISPATCHED,
          AssignmentStatus.ARRIVED,
        ],
      },
    });

    if (concurrentResourceAssignment) {
      throw new ValidationError(
        `Resource is already assigned to another active assignment (ID: ${concurrentResourceAssignment._id})`
      );
    }
  }

  const assignment = await Assignment.create({
    incidentId,
    responderId,
    resourceId,
    status: AssignmentStatus.PENDING,
    notes,
  });

  // Update incident status if needed
  if (incident.status === "REPORTED") {
    await Incident.findByIdAndUpdate(incidentId, { status: "VERIFIED" });
  }

  logger.info(
    `Assignment created: ${assignment._id} - Incident: ${incidentId}, Responder: ${responderId}`
  );

  // Emit real-time assignment event
  socketService.emitAssignmentCreated({
    assignmentId: assignment._id.toString(),
    incidentId,
    responderId,
    resourceId,
    status: assignment.status,
    updatedBy: responderId,
  });

  // The responder needs to know they have been dispatched. Without this, a
  // dispatch is only visible to someone who opens the assignments list.
  await notificationService.notify({
    userId: responderId,
    type: "ASSIGNMENT",
    title: "You have been dispatched",
    message: `You have been dispatched to an incident awaiting your acknowledgement.${notes ? ` Notes: ${notes}` : ""}`,
    relatedId: incidentId,
  });

  return assignment.populate([
    { path: "incidentId", select: "title status severity category" },
    { path: "responderId", select: "name email role" },
    { path: "resourceId", select: "name type category status" },
  ]);
};

export const getAssignmentById = async (id: string): Promise<IAssignmentDocument | null> => {
  return Assignment.findById(id)
    .populate([
      { path: "incidentId", select: "title status severity" },
      { path: "responderId", select: "name email role" },
      { path: "resourceId", select: "name type category status" },
    ]);
};

export const updateAssignment = async (
  assignmentId: string,
  updates: {
    status?: AssignmentStatus;
    notes?: string;
  },
  actorId: string,
  actorRole: string
): Promise<IAssignmentDocument | null> => {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    throw new NotFoundError("Assignment", assignmentId);
  }

  // Authorization checks come before the transition rules, so a caller who
  // is not allowed to act on this dispatch learns that, rather than learning
  // the shape of the workflow.
  if (actorRole !== "ADMIN" && actorRole !== "COORDINATOR") {
    // A non-coordinator may respond to a dispatch, and to nothing else.
    // Every other status change is a dispatch decision, which only a
    // coordinator may make — the UI hides those actions, but the check has
    // to be enforced here.
    const isResponding =
      updates.status === AssignmentStatus.ACCEPTED ||
      updates.status === AssignmentStatus.DECLINED;

    if (!isResponding) {
      throw new ForbiddenError("Only coordinators can update this assignment");
    }

    // Only the assigned responder can accept or decline
    if (assignment.responderId.toString() !== actorId) {
      throw new ForbiddenError("Only the assigned responder can accept or decline this assignment");
    }

    if (assignment.status !== AssignmentStatus.PENDING) {
      throw new ValidationError("This dispatch has already been responded to");
    }
  }

  // Validate status transitions
  if (updates.status) {
    const isValidTransition = isValidStatusTransition(assignment.status, updates.status);
    if (!isValidTransition) {
      throw new ValidationError(
        `Invalid status transition from ${assignment.status} to ${updates.status}`
      );
    }
  }

  const previousStatus = assignment.status;
  if (updates.status) assignment.status = updates.status;
  if (updates.notes !== undefined) assignment.notes = updates.notes;
  if (updates.status === AssignmentStatus.COMPLETED) {
    assignment.completedAt = new Date();
  }

  await assignment.save();

  logger.info(`Assignment updated: ${assignmentId} - Status: ${assignment.status}`);

  // Emit real-time assignment update event
  const eventData = {
    assignmentId: assignment._id.toString(),
    incidentId: assignment.incidentId.toString(),
    responderId: assignment.responderId.toString(),
    resourceId: assignment.resourceId?.toString(),
    status: assignment.status,
    previousStatus,
    updatedBy: actorId,
  };

  if (updates.status && updates.status !== previousStatus) {
    socketService.emitAssignmentStatusChanged(eventData);
    // A cancellation also gets its own event: the client treats a cancelled
    // dispatch as one that will never be picked up, which is different from
    // one that has merely changed state.
    if (updates.status === AssignmentStatus.CANCELLED) {
      socketService.emitAssignmentCancelled(eventData);
    }
  } else {
    socketService.emitAssignmentUpdated(eventData);
  }

  // Tell the other side of the dispatch that it moved.
  //
  // When the responder is the one acting, the coordinators need to know — it
  // decides whether the incident still needs cover. When a coordinator is the
  // one acting, the responder needs to know. Notifying the actor would just
  // tell them what they just did.
  if (updates.status && updates.status !== previousStatus) {
    const responderId = assignment.responderId.toString();
    const incidentId = assignment.incidentId.toString();
    const responder = await User.findById(responderId).select("name").lean();
    const responderName = responder?.name ?? "A responder";
    const statusLabel = assignment.status.toLowerCase();

    if (responderId === actorId) {
      const coordinators = await User.find({
        role: { $in: ["ADMIN", "COORDINATOR"] },
      })
        .select("_id")
        .lean();

      for (const coordinator of coordinators) {
        const coordinatorId = coordinator._id.toString();
        if (coordinatorId === actorId) continue;

        await notificationService.notify({
          userId: coordinatorId,
          type: "ASSIGNMENT",
          title: `Dispatch ${statusLabel}`,
          message: `${responderName} responded to a dispatch — it is now ${statusLabel}.`,
          relatedId: incidentId,
        });
      }
    } else {
      await notificationService.notify({
        userId: responderId,
        type: "ASSIGNMENT",
        title: `Dispatch ${statusLabel}`,
        message: `Your dispatch is now ${statusLabel}.`,
        relatedId: incidentId,
      });
    }
  }

  return assignment.populate([
    { path: "incidentId", select: "title status severity" },
    { path: "responderId", select: "name email role" },
    { path: "resourceId", select: "name type category status" },
  ]);
};

export const deleteAssignment = async (assignmentId: string): Promise<void> => {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    throw new NotFoundError("Assignment", assignmentId);
  }

  await Assignment.deleteOne({ _id: assignmentId });
  logger.info(`Assignment deleted: ${assignmentId}`);
};

const ASSIGNMENT_SORT_FIELDS = new Set([
  "createdAt",
  "assignedAt",
  "completedAt",
  "status",
]);

/**
 * Build a Mongo sort spec for assignments.
 * Unknown fields fall back to the operational default (newest first).
 */
export const buildAssignmentSort = (
  sortBy?: string,
  sortOrder?: "asc" | "desc"
): Record<string, 1 | -1> => {
  const direction: 1 | -1 = sortOrder === "asc" ? 1 : -1;

  if (!sortBy || !ASSIGNMENT_SORT_FIELDS.has(sortBy)) {
    return { createdAt: -1 };
  }

  return { [sortBy]: direction, _id: 1 };
};

/**
 * List users who can be dispatched to an incident.
 *
 * Dispatchers need a directory of on-duty personnel to choose from, but the
 * admin user list is restricted to ADMIN. This returns only the fields a
 * dispatcher needs (no password hash, no email unless explicitly needed).
 */
export const listAssignableResponders = async (
  search?: string
): Promise<{
  _id: string;
  name: string;
  email: string;
  role: string;
  isAvailable: boolean;
}[]> => {
  const query: any = {
    role: { $in: ["RESPONDER", "COORDINATOR"] },
  };

  if (search) {
    const searchRegex = new RegExp(escapeRegExp(search), "i");
    query.$or = [{ name: searchRegex }, { email: searchRegex }];
  }

  const users = await User.find(query)
    .select("name email role isAvailable")
    .sort({ name: 1 });

  return users.map((user) => ({
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isAvailable: user.isAvailable,
  }));
};

/**
 * Aggregate assignment counts for the operations dashboard.
 */
export const getAssignmentStats = async (): Promise<{
  total: number;
  byStatus: Record<string, number>;
  pendingTotal: number;
  activeTotal: number;
}> => {
  const [total, statusCounts] = await Promise.all([
    Assignment.countDocuments({}),
    Assignment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
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

  const byStatusFull = {
    PENDING: byStatus.PENDING || 0,
    ACCEPTED: byStatus.ACCEPTED || 0,
    DISPATCHED: byStatus.DISPATCHED || 0,
    ARRIVED: byStatus.ARRIVED || 0,
    COMPLETED: byStatus.COMPLETED || 0,
    DECLINED: byStatus.DECLINED || 0,
    CANCELLED: byStatus.CANCELLED || 0,
    EXPIRED: byStatus.EXPIRED || 0,
  };

  return {
    total,
    byStatus: byStatusFull,
    pendingTotal: byStatusFull.PENDING,
    activeTotal:
      byStatusFull.ACCEPTED + byStatusFull.DISPATCHED + byStatusFull.ARRIVED,
  };
};

export const listAssignments = async (
  filter: AssignmentFilter = {},
  pagination: PaginationOptions = { page: 1, limit: 20 }
): Promise<PaginatedAssignments> => {
  const query: FilterQuery<IAssignmentDocument> = {};

  if (filter.status) {
    query.status = filter.status;
  }

  if (filter.incidentId) {
    query.incidentId = filter.incidentId;
  }

  if (filter.responderId) {
    query.responderId = filter.responderId;
  }

  if (filter.resourceId) {
    query.resourceId = filter.resourceId;
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const total = await Assignment.countDocuments(query);
  const totalPages = Math.ceil(total / pagination.limit);

  const data = await Assignment.find(query)
    .sort(buildAssignmentSort(filter.sortBy, filter.sortOrder))
    .skip(skip)
    .limit(pagination.limit)
    .populate([
      { path: "incidentId", select: "title status severity category" },
      { path: "responderId", select: "name email role phone" },
      { path: "resourceId", select: "name type category status" },
    ]);

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

export const getAssignmentsByResponder = async (
  responderId: string,
  status?: AssignmentStatus
): Promise<IAssignmentDocument[]> => {
  const query: any = { responderId };

  if (status) {
    query.status = status;
  }

  return Assignment.find(query)
    .sort({ createdAt: -1 })
    .populate([
      { path: "incidentId", select: "title status severity category" },
      { path: "resourceId", select: "name type category status" },
    ]);
};

export const getAssignmentsByIncident = async (
  incidentId: string,
  status?: AssignmentStatus
): Promise<IAssignmentDocument[]> => {
  const query: any = { incidentId };

  if (status) {
    query.status = status;
  }

  return Assignment.find(query)
    .sort({ createdAt: -1 })
    .populate([
      { path: "responderId", select: "name email role" },
      { path: "resourceId", select: "name type category status" },
    ]);
};

// Status transition rules - explicitly typed to include all AssignmentStatus values
const validTransitions: Record<string, AssignmentStatus[]> = {
  [AssignmentStatus.PENDING]: [AssignmentStatus.ACCEPTED, AssignmentStatus.DECLINED, AssignmentStatus.EXPIRED, AssignmentStatus.CANCELLED],
  [AssignmentStatus.ACCEPTED]: [AssignmentStatus.DISPATCHED, AssignmentStatus.CANCELLED],
  [AssignmentStatus.DISPATCHED]: [AssignmentStatus.ARRIVED, AssignmentStatus.CANCELLED],
  [AssignmentStatus.ARRIVED]: [AssignmentStatus.COMPLETED, AssignmentStatus.CANCELLED],
  [AssignmentStatus.DECLINED]: [],
  [AssignmentStatus.COMPLETED]: [],
  [AssignmentStatus.CANCELLED]: [],
  [AssignmentStatus.EXPIRED]: [],
};

export const isValidStatusTransition = (
  current: AssignmentStatus,
  newStatus: AssignmentStatus
): boolean => {
  if (!validTransitions[current]) return false;
  return validTransitions[current].includes(newStatus);
};

export const cancelAssignment = async (
  assignmentId: string,
  actorId: string,
  actorRole: string
): Promise<IAssignmentDocument | null> => {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    throw new NotFoundError("Assignment", assignmentId);
  }

  if (actorRole !== "ADMIN" && actorRole !== "COORDINATOR") {
    throw new ForbiddenError("Only admins and coordinators can cancel assignments");
  }

  return updateAssignment(assignmentId, { status: AssignmentStatus.CANCELLED }, actorId, actorRole);
};

export default {
  createAssignment,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  listAssignments,
  getAssignmentsByResponder,
  getAssignmentsByIncident,
  isValidStatusTransition,
  cancelAssignment,
};
