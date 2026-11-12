import Resource, { IResourceDocument } from "../models/Resource.js";
import Incident, { IIncidentDocument } from "../models/Incident.js";
import Assignment from "../models/Assignment.js";
import { ResourceStatus, AssignmentStatus } from "../types/models.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";

export interface ResourceRecommendation {
  resource: {
    _id: string;
    name: string;
    type: string;
    category: string;
    status: ResourceStatus;
    capacity?: number;
    contact?: string;
  };
  distanceKm: number | null;
  matchScore: number;
  explanation: string;
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export const getRecommendedResources = async (
  incidentId: string
): Promise<ResourceRecommendation[]> => {
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw new NotFoundError("Incident", incidentId);
  }

  // Find available resources
  const resources = await Resource.find({
    status: ResourceStatus.AVAILABLE,
  });

  const recommendations: ResourceRecommendation[] = [];

  for (const resource of resources) {
    let distanceKm: number | null = null;
    if (
      incident.location &&
      incident.location.coordinates &&
      resource.location &&
      resource.location.coordinates
    ) {
      const [incLon, incLat] = incident.location.coordinates;
      const [resLon, resLat] = resource.location.coordinates;
      distanceKm = calculateDistance(incLat, incLon, resLat, resLon);
    }

    let matchScore = 100;
    const reasons: string[] = [];

    // Category / type match check
    const incidentCategory = incident.category?.toUpperCase() || "";
    const resourceCategory = resource.category?.toUpperCase() || "";
    const resourceType = resource.type?.toUpperCase() || "";

    if (
      resourceCategory.includes(incidentCategory) ||
      incidentCategory.includes(resourceCategory) ||
      resourceType.includes(incidentCategory)
    ) {
      matchScore += 30;
      reasons.push("Direct category/type match for incident requirements.");
    } else {
      matchScore -= 20;
      reasons.push("General purpose resource (no direct category match).");
    }

    // Distance scoring
    if (distanceKm !== null) {
      if (distanceKm <= 5) {
        matchScore += 25;
        reasons.push(`Very close proximity (${distanceKm} km).`);
      } else if (distanceKm <= 20) {
        matchScore += 10;
        reasons.push(`Moderate proximity (${distanceKm} km).`);
      } else {
        matchScore -= Math.min(distanceKm, 40);
        reasons.push(`Far distance (${distanceKm} km).`);
      }
    } else {
      matchScore -= 15;
      reasons.push("Location coordinates not available.");
    }

    // Status availability bonus
    if (resource.status === ResourceStatus.AVAILABLE) {
      matchScore += 15;
      reasons.push("Resource is fully available and ready for deployment.");
    }

    recommendations.push({
      resource: {
        _id: resource._id.toString(),
        name: resource.name,
        type: resource.type as string,
        category: resource.category,
        status: resource.status,
        capacity: resource.capacity,
        contact: resource.contact,
      },
      distanceKm,
      matchScore: Math.max(0, Math.round(matchScore)),
      explanation: reasons.join(" "),
    });
  }

  recommendations.sort((a, b) => b.matchScore - a.matchScore);
  return recommendations;
};

export const allocateResource = async (
  incidentId: string,
  resourceId: string,
  userId: string,
  notes?: string
): Promise<any> => {
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw new NotFoundError("Incident", incidentId);
  }

  const resource = await Resource.findById(resourceId);
  if (!resource) {
    throw new NotFoundError("Resource", resourceId);
  }

  if (resource.status !== ResourceStatus.AVAILABLE) {
    throw new BadRequestError(`Resource ${resource.name} is already allocated or unavailable`);
  }

  // Check if resource is already assigned to active assignment
  const existingAssignment = await Assignment.findOne({
    resourceId: resource._id,
    status: {
      $in: [
        AssignmentStatus.PENDING,
        AssignmentStatus.ACCEPTED,
        AssignmentStatus.DISPATCHED,
        AssignmentStatus.ARRIVED,
      ],
    },
  });

  if (existingAssignment) {
    throw new BadRequestError(`Resource ${resource.name} is already allocated to an active assignment`);
  }

  // Atomic claim using findOneAndUpdate to prevent race conditions / double allocation
  const claimedResource = await Resource.findOneAndUpdate(
    { _id: resource._id, status: ResourceStatus.AVAILABLE },
    {
      $set: {
        status: ResourceStatus.ON_MISSION,
        lastUpdated: new Date(),
      },
    },
    { new: true }
  );

  if (!claimedResource) {
    throw new BadRequestError(`Resource ${resource.name} was just allocated by another process`);
  }

  // Create assignment record linking incident, resource, and user
  const assignment = await Assignment.create({
    incidentId: incident._id,
    responderId: userId,
    resourceId: resource._id,
    status: AssignmentStatus.DISPATCHED,
    assignedAt: new Date(),
    notes: notes || `Allocated resource ${resource.name} to incident ${incident.title}`,
  });

  return assignment;
};

export const deallocateResource = async (resourceId: string): Promise<any> => {
  const resource = await Resource.findById(resourceId);
  if (!resource) {
    throw new NotFoundError("Resource", resourceId);
  }

  resource.status = ResourceStatus.AVAILABLE;
  resource.lastUpdated = new Date();
  await resource.save();

  // Complete any active assignments for this resource
  await Assignment.updateMany(
    {
      resourceId: resource._id,
      status: {
        $in: [
          AssignmentStatus.PENDING,
          AssignmentStatus.ACCEPTED,
          AssignmentStatus.DISPATCHED,
          AssignmentStatus.ARRIVED,
        ],
      },
    },
    {
      $set: {
        status: AssignmentStatus.COMPLETED,
        completedAt: new Date(),
      },
    }
  );

  return resource;
};
