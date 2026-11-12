import { Request, Response, NextFunction } from "express";
import * as resourceService from "../services/resourceService.js";
import { validate, resourceSchemas } from "../utils/validation.js";
import { ResourceStatus } from "../types/models.js";

export const createResource = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = validate(resourceSchemas.create, req.body);
    const user = (req as any).user;

    // Only admins and coordinators can create resources
    if (user.role !== "ADMIN" && user.role !== "COORDINATOR") {
      res.error(403, "Not authorized to create resources");
      return;
    }

    const resource = await resourceService.createResource(
      data.name,
      data.type,
      data.category,
      data.status as ResourceStatus,
      data.location,
      data.address,
      data.capacity,
      data.contact
    );

    res.created(resource);
  } catch (error) {
    next(error);
  }
};

export const getResourceById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const resource = await resourceService.getResourceById(req.params.id);

    if (!resource) {
      res.error(404, "Resource not found");
      return;
    }

    res.success(resource);
  } catch (error) {
    next(error);
  }
};

export const updateResource = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = validate(resourceSchemas.update, req.body);
    const user = (req as any).user;

    // Only admins and coordinators can update resources
    if (user.role !== "ADMIN" && user.role !== "COORDINATOR") {
      res.error(403, "Not authorized to update resources");
      return;
    }

    const updateData: any = { ...data };
    if (data.status) updateData.status = data.status as ResourceStatus;
    if (data.type) updateData.type = data.type;
    if (data.category) updateData.category = data.category;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.capacity !== undefined) updateData.capacity = data.capacity;
    if (data.contact !== undefined) updateData.contact = data.contact;
    if (data.location) updateData.location = data.location;

    const resource = await resourceService.updateResource(req.params.id, updateData);

    if (!resource) {
      res.error(404, "Resource not found");
      return;
    }

    res.success(resource);
  } catch (error) {
    next(error);
  }
};

export const deleteResource = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;

    // Only admins and coordinators can delete resources
    if (user.role !== "ADMIN" && user.role !== "COORDINATOR") {
      res.error(403, "Not authorized to delete resources");
      return;
    }

    await resourceService.deleteResource(req.params.id);

    res.success({ message: "Resource deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const listResources = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = validate(resourceSchemas.query, req.query);

    const pagination = {
      page: query.page,
      limit: query.limit,
    };

    const filter: resourceService.ResourceFilter = {
      status: query.status,
      category: query.category,
      type: query.type,
      search: query.search,
      near: query.near,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder === "asc" || query.sortOrder === "desc" ? query.sortOrder : undefined,
    };

    const result = await resourceService.listResources(filter, pagination);

    res.success(result);
  } catch (error) {
    next(error);
  }
};

export const getNearbyResources = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { lng, lat, maxDistance, limit } = req.query;

    const longitude = parseFloat(lng as string);
    const latitude = parseFloat(lat as string);

    if (isNaN(longitude) || isNaN(latitude)) {
      res.error(400, "Invalid coordinates");
      return;
    }

    const resources = await resourceService.getNearbyResources(
      longitude,
      latitude,
      maxDistance ? parseFloat(maxDistance as string) : 50000,
      limit ? parseInt(limit as string) : 10
    );

    res.success(resources);
  } catch (error) {
    next(error);
  }
};

export const updateAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;

    // Only admins and coordinators can update availability
    if (user.role !== "ADMIN" && user.role !== "COORDINATOR") {
      res.error(403, "Not authorized to update resource availability");
      return;
    }

    const { status } = req.body;
    const allowedStatuses = ["AVAILABLE", "ON_MISSION", "MAINTENANCE", "UNAVAILABLE"];

    if (!allowedStatuses.includes(status)) {
      res.error(400, `Invalid status. Must be one of: ${allowedStatuses.join(", ")}`);
      return;
    }

    const resource = await resourceService.updateAvailability(req.params.id, status as ResourceStatus);

    if (!resource) {
      res.error(404, "Resource not found");
      return;
    }

    res.success(resource);
  } catch (error) {
    next(error);
  }
};

export default {
  createResource,
  getResourceById,
  updateResource,
  deleteResource,
  listResources,
  getNearbyResources,
  updateAvailability,
};
