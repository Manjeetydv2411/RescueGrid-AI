import User, { IUserDocument } from "../models/User.js";
import Incident, { IIncidentDocument } from "../models/Incident.js";
import Assignment from "../models/Assignment.js";
import { AssignmentStatus } from "../types/models.js";
import { NotFoundError } from "../utils/errors.js";

export interface ResponderRecommendation {
  responder: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    skills: string[];
    isAvailable: boolean;
  };
  distanceKm: number | null;
  workload: number;
  skillMatchCount: number;
  score: number;
}

// Haversine formula to calculate distance in km
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return Math.round(d * 10) / 10;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export const getRecommendedResponders = async (
  incidentId: string
): Promise<ResponderRecommendation[]> => {
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw new NotFoundError("Incident", incidentId);
  }

  // Find all responders who are marked as available
  const responders = await User.find({
    role: "RESPONDER",
    isAvailable: true,
  });

  const recommendations: ResponderRecommendation[] = [];

  for (const responder of responders) {
    // 1. Calculate workload (active assignments)
    const activeAssignmentsCount = await Assignment.countDocuments({
      responderId: responder._id,
      status: {
        $in: [
          AssignmentStatus.PENDING,
          AssignmentStatus.ACCEPTED,
          AssignmentStatus.DISPATCHED,
          AssignmentStatus.ARRIVED,
        ],
      },
    });

    // 2. Calculate distance
    let distanceKm: number | null = null;
    if (
      incident.location &&
      incident.location.coordinates &&
      responder.location &&
      responder.location.coordinates
    ) {
      // GeoJSON coordinates are [longitude, latitude]
      const [incLon, incLat] = incident.location.coordinates;
      const [respLon, respLat] = responder.location.coordinates;
      distanceKm = calculateDistance(incLat, incLon, respLat, respLon);
    }

    // 3. Calculate skill match
    const requiredSkills = incident.requiredSkills || [];
    const responderSkills = responder.skills || [];
    let skillMatchCount = 0;

    if (requiredSkills.length > 0) {
      skillMatchCount = requiredSkills.filter((skill) =>
        responderSkills.includes(skill)
      ).length;
    }

    // 4. Calculate score
    // Base score: 100
    // Distance penalty: -2 points per km (up to -50)
    // Workload penalty: -20 points per active assignment
    // Skill bonus: +15 points per matched skill
    let score = 100;

    if (distanceKm !== null) {
      score -= Math.min(distanceKm * 2, 50);
    } else {
      score -= 25; // Penalty for unknown distance
    }

    score -= activeAssignmentsCount * 20;
    score += skillMatchCount * 15;

    recommendations.push({
      responder: {
        _id: responder._id.toString(),
        name: responder.name,
        email: responder.email,
        phone: responder.phone,
        skills: responder.skills || [],
        isAvailable: responder.isAvailable,
      },
      distanceKm,
      workload: activeAssignmentsCount,
      skillMatchCount,
      score: Math.max(0, Math.round(score)),
    });
  }

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  return recommendations;
};
