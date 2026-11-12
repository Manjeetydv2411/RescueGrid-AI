import mongoose, { FilterQuery } from "mongoose";
import Resource, { IResourceDocument } from "../models/Resource.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { ResourceStatus, ResourceType } from "../types/models.js";
import { escapeRegExp } from "./incidentService.js";
import * as socketService from "../socket/socketService.js";

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface ResourceFilter {
  status?: ResourceStatus | string;
  category?: string;
  type?: ResourceType | string;
  search?: string;
  near?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResources {
  data: IResourceDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export const createResource = async (
  name: string,
  type: string,
  category: string,
  status: ResourceStatus,
  location: { type: "Point"; coordinates: [number, number] },
  address?: string,
  capacity?: number,
  contact?: string
): Promise<IResourceDocument> => {
  const resource = await Resource.create({
    name,
    type,
    category,
    status,
    location,
    address,
    capacity,
    contact,
  });

  logger.info(`Resource created: ${resource._id} - ${resource.name}`);

  // Announce the new resource so that an open inventory refreshes without
  // the coordinator having to reload the page.
  socketService.emitResourceCreated({
    resourceId: resource._id.toString(),
    name: resource.name,
    type: resource.type,
    status: resource.status,
    location: resource.location,
    lastUpdated: resource.lastUpdated.toISOString(),
  });

  return resource;
};

export const getResourceById = async (id: string): Promise<IResourceDocument | null> => {
  return Resource.findById(id);
};

export const updateResource = async (
  resourceId: string,
  updates: {
    name?: string;
    type?: string;
    category?: string;
    status?: ResourceStatus;
    address?: string;
    capacity?: number;
    contact?: string;
    location?: { type: "Point"; coordinates: [number, number] };
  }
): Promise<IResourceDocument | null> => {
  const resource = await Resource.findById(resourceId);
  if (!resource) {
    throw new NotFoundError("Resource", resourceId);
  }

  if (updates.name) resource.name = updates.name;
  if (updates.type) resource.type = updates.type;
  if (updates.category) resource.category = updates.category;
  if (updates.status) resource.status = updates.status;
  if (updates.address !== undefined) resource.address = updates.address;
  if (updates.capacity !== undefined) resource.capacity = updates.capacity;
  if (updates.contact !== undefined) resource.contact = updates.contact;
  if (updates.location) resource.location = updates.location;

  resource.lastUpdated = new Date();
  await resource.save();

  logger.info(`Resource updated: ${resource._id}`);

  // Emit real-time event after update
  socketService.emitResourceUpdated({
    resourceId: resource._id.toString(),
    name: resource.name,
    type: resource.type,
    status: resource.status,
    location: resource.location,
    lastUpdated: resource.lastUpdated.toISOString(),
  });

  return resource;
};

export const deleteResource = async (resourceId: string): Promise<void> => {
  const resource = await Resource.findById(resourceId);
  if (!resource) {
    throw new NotFoundError("Resource", resourceId);
  }

  await Resource.deleteOne({ _id: resourceId });
  logger.info(`Resource deleted: ${resourceId}`);
};

const RESOURCE_SORT_FIELDS = new Set([
  "name",
  "status",
  "type",
  "category",
  "capacity",
  "lastUpdated",
]);

/**
 * Build a Mongo sort spec for resources.
 * Unknown fields fall back to the operational default (most recently updated first).
 */
export const buildResourceSort = (
  sortBy?: string,
  sortOrder?: "asc" | "desc"
): Record<string, 1 | -1> => {
  const direction: 1 | -1 = sortOrder === "asc" ? 1 : -1;

  if (!sortBy || !RESOURCE_SORT_FIELDS.has(sortBy)) {
    return { lastUpdated: -1 };
  }

  if (sortBy === "status") {
    // Status is stored as a string; sort alphabetically on the raw value and
    // keep recency as the tie-breaker.
    return { status: direction, lastUpdated: -1 };
  }

  return { [sortBy]: direction, _id: 1 };
};

/**
 * Aggregate resource counts for the operations dashboard.
 */
export const getResourceStats = async (): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}> => {
  const [total, statusCounts, typeCounts] = await Promise.all([
    Resource.countDocuments({}),
    Resource.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Resource.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),
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

  return {
    total,
    byStatus: {
      AVAILABLE: byStatus.AVAILABLE || 0,
      ON_MISSION: byStatus.ON_MISSION || 0,
      MAINTENANCE: byStatus.MAINTENANCE || 0,
      UNAVAILABLE: byStatus.UNAVAILABLE || 0,
    },
    byType: toRecord(typeCounts),
  };
};

export const listResources = async (
  filter: ResourceFilter = {},
  pagination: PaginationOptions = { page: 1, limit: 20 }
): Promise<PaginatedResources> => {
  const query: FilterQuery<IResourceDocument> = {};

  if (filter.status) {
    query.status = filter.status;
  }

  // Category and type are free-text filters in the UI, so they match on a
  // case-insensitive substring rather than the exact stored value. Typing
  // "medical" should find a resource whose category is "Medical" — an
  // exact, case-sensitive match would silently return nothing.
  if (filter.category) {
    query.category = new RegExp(escapeRegExp(filter.category), "i");
  }

  if (filter.type) {
    query.type = new RegExp(escapeRegExp(filter.type), "i");
  }

  if (filter.search) {
    const searchRegex = new RegExp(escapeRegExp(filter.search), "i");
    query.$or = [
      { name: searchRegex },
      { category: searchRegex },
      { type: searchRegex },
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
  const total = await Resource.countDocuments(query);
  const totalPages = Math.ceil(total / pagination.limit);

  const data = await Resource.find(query)
    .sort(buildResourceSort(filter.sortBy, filter.sortOrder))
    .skip(skip)
    .limit(pagination.limit);

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

export const getNearbyResources = async (
  lng: number,
  lat: number,
  maxDistance: number = 50000,
  limit: number = 10
): Promise<IResourceDocument[]> => {
  return Resource.find({
    status: ResourceStatus.AVAILABLE,
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
    .sort({ lastUpdated: -1 })
    .limit(limit);
};

export const updateAvailability = async (
  resourceId: string,
  status: ResourceStatus
): Promise<IResourceDocument | null> => {
  const resource = await Resource.findById(resourceId);
  if (!resource) {
    throw new NotFoundError("Resource", resourceId);
  }

  // Only allow certain status transitions
  if (status === ResourceStatus.ON_MISSION && resource.status !== ResourceStatus.AVAILABLE) {
    throw new ValidationError(
      `Cannot set resource to ON_MISSION from status ${resource.status}`
    );
  }

  if (status === ResourceStatus.AVAILABLE && resource.status === ResourceStatus.ON_MISSION) {
    throw new ValidationError(
      "Resource must be completed or cancelled before becoming available again"
    );
  }

  const previousStatus = resource.status;
  resource.status = status;
  resource.lastUpdated = new Date();
  await resource.save();

  logger.info(`Resource availability updated: ${resourceId} -> ${status}`);

  // Emit real-time status change
  socketService.emitResourceStatusChanged({
    resourceId: resource._id.toString(),
    name: resource.name,
    type: resource.type,
    status: resource.status,
    previousStatus,
    location: resource.location,
    lastUpdated: resource.lastUpdated.toISOString(),
  });

  return resource;
};

export const markAsUnavailable = async (resourceId: string): Promise<IResourceDocument | null> => {
  return updateAvailability(resourceId, ResourceStatus.UNAVAILABLE);
};

export const markAsMaintenance = async (resourceId: string): Promise<IResourceDocument | null> => {
  return updateAvailability(resourceId, ResourceStatus.MAINTENANCE);
};

export const markAsAvailable = async (resourceId: string): Promise<IResourceDocument | null> => {
  return updateAvailability(resourceId, ResourceStatus.AVAILABLE);
};

// Check if a resource is available at a specific time
export const checkAvailabilityAtTime = async (
  resourceId: string,
  startTime: Date,
  endTime: Date
): Promise<boolean> => {
  const resource = await Resource.findById(resourceId);
  if (!resource || resource.status !== ResourceStatus.AVAILABLE) {
    return false;
  }
  return true;
};

export default {
  createResource,
  getResourceById,
  updateResource,
  deleteResource,
  listResources,
  getNearbyResources,
  updateAvailability,
  markAsUnavailable,
  markAsMaintenance,
  markAsAvailable,
  checkAvailabilityAtTime,
};
