import { Request, Response, NextFunction } from "express";
import * as allocationService from "../services/resourceAllocationService.js";

export const getRecommendations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { incidentId } = req.params;
    const recommendations = await allocationService.getRecommendedResources(incidentId);
    (res as any).success(recommendations, 200);
  } catch (error) {
    next(error);
  }
};

export const allocate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user || (user.role !== "ADMIN" && user.role !== "COORDINATOR")) {
      (res as any).error(403, "Not authorized to allocate resources");
      return;
    }

    const { incidentId, resourceId, notes } = req.body;
    if (!incidentId || !resourceId) {
      (res as any).error(400, "Incident ID and Resource ID are required");
      return;
    }

    const assignment = await allocationService.allocateResource(
      incidentId,
      resourceId,
      user._id || user.id,
      notes
    );

    (res as any).success(assignment, 201);
  } catch (error) {
    next(error);
  }
};

export const deallocate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user || (user.role !== "ADMIN" && user.role !== "COORDINATOR")) {
      (res as any).error(403, "Not authorized to deallocate resources");
      return;
    }

    const { resourceId } = req.params;
    const resource = await allocationService.deallocateResource(resourceId);
    (res as any).success(resource, 200);
  } catch (error) {
    next(error);
  }
};

export default {
  getRecommendations,
  allocate,
  deallocate,
};
