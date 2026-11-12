import { Request, Response, NextFunction } from "express";
import * as incidentService from "../services/incidentService.js";
import * as resourceService from "../services/resourceService.js";
import * as assignmentService from "../services/assignmentService.js";

/**
 * Aggregate operations statistics for the dashboard.
 *
 * Every number here is computed with a database aggregate, so the dashboard
 * reports the true state of the system rather than a page-limited sample.
 */
export const getDashboardStats = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [incidents, resources, assignments] = await Promise.all([
      incidentService.getIncidentStats(),
      resourceService.getResourceStats(),
      assignmentService.getAssignmentStats(),
    ]);

    res.success({
      incidents,
      resources,
      assignments,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getDashboardStats,
};
