import { Request, Response, NextFunction } from "express";
import * as assignmentService from "../services/assignmentService.js";
import * as recommendationService from "../services/recommendationService.js";
import { assignmentSchemas, validate } from "../utils/validation.js";
import { AssignmentStatus as AStatus } from "../types/models.js";

export const createAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;

    // Only admins and coordinators can create assignments
    if (user.role !== "ADMIN" && user.role !== "COORDINATOR") {
      res.error(403, "Not authorized to create assignments");
      return;
    }

    const data = {
      incidentId: req.params.incidentId,
      responderId: req.body.responderId,
      resourceId: req.body.resourceId,
      notes: req.body.notes,
    };

    const assignment = await assignmentService.createAssignment(
      data.incidentId,
      data.responderId,
      data.resourceId,
      data.notes
    );

    res.created(assignment);
  } catch (error) {
    next(error);
  }
};

export const getAssignmentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    const assignment = await assignmentService.getAssignmentById(req.params.id);

    if (!assignment) {
      res.error(404, "Assignment not found");
      return;
    }

    // Authorization check: only admins, coordinators, or the assigned responder can view
    if (
      user.role !== "ADMIN" &&
      user.role !== "COORDINATOR" &&
      (assignment.responderId as any)?.toString() !== user.id
    ) {
      res.error(403, "Not authorized to view this assignment");
      return;
    }

    res.success(assignment);
  } catch (error) {
    next(error);
  }
};

export const updateAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    const data = validate(assignmentSchemas.update, req.body);

    const updateData: any = { ...data };
    if (data.status) updateData.status = data.status as AStatus;

    const assignment = await assignmentService.updateAssignment(
      req.params.id,
      updateData,
      user.id,
      user.role
    );

    if (!assignment) {
      res.error(404, "Assignment not found");
      return;
    }

    res.success(assignment);
  } catch (error) {
    next(error);
  }
};

export const deleteAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;

    if (user.role !== "ADMIN" && user.role !== "COORDINATOR") {
      res.error(403, "Not authorized to delete assignments");
      return;
    }

    await assignmentService.deleteAssignment(req.params.id);

    res.success({ message: "Assignment deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const listAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    const query = validate(assignmentSchemas.query, req.query);

    const pagination = {
      page: query.page,
      limit: query.limit,
    };

    const filter: assignmentService.AssignmentFilter = {
      status: query.status,
      incidentId: query.incidentId,
      responderId: query.responderId,
      resourceId: query.resourceId,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder === "asc" || query.sortOrder === "desc" ? query.sortOrder : undefined,
    };

    // A dispatch list exposes responder names, emails, and phone numbers. Only
    // coordinators dispatch, so only they may browse the full list; anyone
    // else sees the dispatches addressed to them.
    if (user.role !== "ADMIN" && user.role !== "COORDINATOR") {
      filter.responderId = user.id;
    }

    const result = await assignmentService.listAssignments(filter, pagination);

    res.success(result);
  } catch (error) {
    next(error);
  }
};

export const getAssignmentsByResponder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;

    // If not admin/coordinator, only show their own assignments
    const responderId =
      user.role === "ADMIN" || user.role === "COORDINATOR"
        ? req.params.responderId
        : user.id;

    const status = req.query.status as string | undefined;

    const assignments = await assignmentService.getAssignmentsByResponder(responderId, status as AStatus | undefined);

    res.success(assignments);
  } catch (error) {
    next(error);
  }
};

export const getAssignmentsByIncident = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    const status = req.query.status as string | undefined;

    const assignments = await assignmentService.getAssignmentsByIncident(
      req.params.incidentId,
      status as AStatus | undefined
    );

    // Authorization check: only admins, coordinators, or involved parties can view
    const involvedResponderIds = assignments.map((a) => (a.responderId as any)?.toString());
    if (
      user.role !== "ADMIN" &&
      user.role !== "COORDINATOR" &&
      !involvedResponderIds.includes(user.id)
    ) {
      res.error(403, "Not authorized to view these assignments");
      return;
    }

    res.success(assignments);
  } catch (error) {
    next(error);
  }
};

export const cancelAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;

    if (user.role !== "ADMIN" && user.role !== "COORDINATOR") {
      res.error(403, "Not authorized to cancel assignments");
      return;
    }

    const assignment = await assignmentService.cancelAssignment(
      req.params.id,
      user.id,
      user.role
    );

    if (!assignment) {
      res.error(404, "Assignment not found");
      return;
    }

    res.success(assignment);
  } catch (error) {
    next(error);
  }
};

export const getRecommendations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    if (user.role !== "ADMIN" && user.role !== "COORDINATOR") {
      res.error(403, "Not authorized to view recommendations");
      return;
    }

    const recommendations = await recommendationService.getRecommendedResponders(
      req.params.incidentId
    );

    res.success(recommendations);
  } catch (error) {
    next(error);
  }
};

export const listResponders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;

    // Only admins and coordinators may dispatch, so only they may browse the
    // responder directory.
    if (user.role !== "ADMIN" && user.role !== "COORDINATOR") {
      res.error(403, "Not authorized to view the responder directory");
      return;
    }

    const responders = await assignmentService.listAssignableResponders(
      req.query.search as string | undefined
    );

    res.success(responders);
  } catch (error) {
    next(error);
  }
};

export default {
  createAssignment,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
  listAssignments,
  getAssignmentsByResponder,
  getAssignmentsByIncident,
  cancelAssignment,
  getRecommendations,
  listResponders,
};
