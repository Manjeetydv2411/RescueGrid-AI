import mongoose from "mongoose";
import Broadcast, { IBroadcastDocument, BroadcastSeverity, BroadcastChannel, IBroadcastScope } from "../../models/Broadcast.js";
import BroadcastDelivery, { DeliveryStatus } from "../../models/BroadcastDelivery.js";
import User, { IUserDocument } from "../../models/User.js";
import Incident from "../../models/Incident.js";
import Notification from "../../models/Notification.js";
import { sendSms } from "./adapters/smsAdapter.js";
import { sendEmail } from "./adapters/emailAdapter.js";
import { sendPush } from "./adapters/pushAdapter.js";
import { logger } from "../../utils/logger.js";
import * as socketService from "../../socket/socketService.js";

export interface CreateBroadcastParams {
  title: string;
  message: string;
  severity: BroadcastSeverity;
  channels: BroadcastChannel[];
  scope: IBroadcastScope;
  senderId: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface PreviewBroadcastParams {
  title: string;
  message: string;
  severity: BroadcastSeverity;
  channels: BroadcastChannel[];
  scope: IBroadcastScope;
}

/**
 * Calculate distance in kilometers between two lat/lon coordinates using the Haversine formula.
 */
export const calculateDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Resolve eligible recipients securely on the server based on scope and targeting mode.
 */
export const resolveEligibleRecipients = async (scope: IBroadcastScope): Promise<IUserDocument[]> => {
  const targetingMode = scope.targetingMode || "EVERYONE";
  const roles =
    scope.targetRoles && scope.targetRoles.length > 0
      ? scope.targetRoles
      : ["ADMIN", "COORDINATOR", "RESPONDER", "VIEWER"];

  const query: any = { role: { $in: roles } };

  if (scope.targetUserIds && scope.targetUserIds.length > 0) {
    const objectIds = scope.targetUserIds.map((id) => new mongoose.Types.ObjectId(id.toString()));
    query._id = { $in: objectIds };
  }

  const allMatchingUsers = await User.find(query);

  if (targetingMode === "EVERYONE") {
    return allMatchingUsers;
  }

  let centerCoords: [number, number] | null = null; // [lng, lat]
  let radius = scope.radiusKm ?? 10; // default 10km radius

  if (targetingMode === "RADIUS") {
    if (scope.center && Array.isArray(scope.center) && scope.center.length === 2) {
      centerCoords = scope.center; // [lng, lat]
    }
  } else if (targetingMode === "INCIDENT_LOCATION") {
    if (scope.incidentId) {
      const incident = await Incident.findById(scope.incidentId);
      if (incident && incident.location && Array.isArray(incident.location.coordinates)) {
        centerCoords = incident.location.coordinates as [number, number]; // [lng, lat]
      }
    }
  }

  if (targetingMode === "RADIUS" || targetingMode === "INCIDENT_LOCATION") {
    if (!centerCoords) {
      return []; // Exclude all if location unknown
    }

    const [centerLng, centerLat] = centerCoords;
    const eligible: IUserDocument[] = [];

    for (const user of allMatchingUsers) {
      if (!user.location || !Array.isArray(user.location.coordinates) || user.location.coordinates.length !== 2) {
        continue; // Exclude users with unknown locations
      }
      const [userLng, userLat] = user.location.coordinates;
      const dist = calculateDistanceKm(centerLat, centerLng, userLat, userLng);
      if (dist <= radius) {
        eligible.push(user);
      }
    }
    return eligible;
  }

  if (targetingMode === "DISTRICT" || targetingMode === "CITY") {
    const targetText = (targetingMode === "DISTRICT" ? scope.district : scope.city)?.toLowerCase().trim();
    if (!targetText) {
      return [];
    }

    const eligible: IUserDocument[] = [];
    for (const user of allMatchingUsers) {
      const userAddr = (user as any).address?.toLowerCase() || "";
      if (userAddr && userAddr.includes(targetText)) {
        eligible.push(user);
      }
    }
    return eligible;
  }

  return allMatchingUsers;
};

/**
 * Preview estimated recipient count grouped by role without sending notifications.
 */
export const previewBroadcast = async (params: PreviewBroadcastParams) => {
  const recipients = await resolveEligibleRecipients(params.scope);

  const byRole: Record<string, number> = {
    ADMIN: 0,
    COORDINATOR: 0,
    RESPONDER: 0,
    VIEWER: 0,
  };

  for (const r of recipients) {
    if (byRole[r.role] !== undefined) {
      byRole[r.role]++;
    } else {
      byRole[r.role] = 1;
    }
  }

  return {
    totalRecipients: recipients.length,
    byRole,
    channels: params.channels,
    targetingMode: params.scope.targetingMode || "EVERYONE",
  };
};

export const createBroadcast = async (params: CreateBroadcastParams): Promise<IBroadcastDocument> => {
  // 1. Check idempotency if key provided
  if (params.idempotencyKey) {
    const existing = await Broadcast.findOne({ idempotencyKey: params.idempotencyKey });
    if (existing) {
      logger.info(`Idempotent broadcast hit for key: ${params.idempotencyKey}`);
      return existing;
    }
  }

  // 2. Resolve eligible recipients securely on the server
  const recipients = await resolveEligibleRecipients(params.scope);

  const broadcast = await Broadcast.create({
    title: params.title,
    message: params.message,
    severity: params.severity,
    channels: params.channels,
    scope: params.scope,
    senderId: params.senderId,
    status: "PROCESSING",
    totalRecipients: recipients.length * params.channels.length,
    idempotencyKey: params.idempotencyKey,
    metadata: params.metadata,
  });

  // 3. Process deliveries
  let successful = 0;
  let failed = 0;
  let simulated = 0;

  for (const recipient of recipients) {
    for (const channel of params.channels) {
      let recipientAddress = "";
      if (channel === "SMS") recipientAddress = recipient.phone || "No phone provided";
      else if (channel === "EMAIL") recipientAddress = recipient.email;
      else if (channel === "PUSH") recipientAddress = recipient.email || recipient._id.toString();
      else if (channel === "IN_APP") recipientAddress = recipient._id.toString();

      let deliveryStatus: DeliveryStatus = "QUEUED";
      let errorMessage: string | undefined;
      let providerResp: string | undefined;

      try {
        if (channel === "SMS") {
          const res = await sendSms({ to: recipientAddress, message: params.message, title: params.title });
          deliveryStatus = res.status;
          errorMessage = res.errorMessage;
          providerResp = res.providerResponse;
        } else if (channel === "EMAIL") {
          const res = await sendEmail({ to: recipientAddress, message: params.message, title: params.title });
          deliveryStatus = res.status;
          errorMessage = res.errorMessage;
          providerResp = res.providerResponse;
        } else if (channel === "PUSH") {
          const res = await sendPush({ to: recipientAddress, message: params.message, title: params.title });
          deliveryStatus = res.status;
          errorMessage = res.errorMessage;
          providerResp = res.providerResponse;
        } else if (channel === "IN_APP") {
          await Notification.create({
            userId: recipient._id,
            type: "BROADCAST",
            title: params.title,
            message: params.message,
            relatedId: broadcast._id,
            metadata: { severity: params.severity },
          });
          deliveryStatus = "DELIVERED";
        }

        if (deliveryStatus === "DELIVERED" || deliveryStatus === "SENT") {
          successful++;
        } else if (deliveryStatus === "SIMULATED") {
          simulated++;
          successful++;
        } else {
          failed++;
        }

        // Avoid duplicate deliveries using upsert
        await BroadcastDelivery.findOneAndUpdate(
          { broadcastId: broadcast._id, userId: recipient._id, channel },
          {
            broadcastId: broadcast._id,
            userId: recipient._id,
            channel,
            status: deliveryStatus,
            recipientAddress,
            retryCount: 0,
            errorMessage,
            deliveredAt: deliveryStatus === "DELIVERED" || deliveryStatus === "SENT" || deliveryStatus === "SIMULATED" ? new Date() : undefined,
            metadata: { providerResponse: providerResp },
          },
          { upsert: true, new: true }
        );

      } catch (err) {
        failed++;
        logger.error(`Failed broadcast delivery for user ${recipient._id} on channel ${channel}: ${(err as Error).message}`);

        await BroadcastDelivery.findOneAndUpdate(
          { broadcastId: broadcast._id, userId: recipient._id, channel },
          {
            broadcastId: broadcast._id,
            userId: recipient._id,
            channel,
            status: "FAILED",
            recipientAddress: recipientAddress || "unknown",
            retryCount: 1,
            errorMessage: (err as Error).message,
          },
          { upsert: true, new: true }
        ).catch(() => {});
      }
    }
  }

  broadcast.status = failed > 0 && successful === 0 ? "FAILED" : "COMPLETED";
  broadcast.successfulDeliveries = successful;
  broadcast.failedDeliveries = failed;
  broadcast.simulatedDeliveries = simulated;
  await broadcast.save();

  logger.info(`Broadcast ${broadcast._id} completed. Success: ${successful}, Failed: ${failed}, Simulated: ${simulated}`);
  return broadcast;
};

export const getBroadcastById = async (broadcastId: string) => {
  return Broadcast.findById(broadcastId);
};

export const getBroadcastDeliveries = async (broadcastId: string) => {
  return BroadcastDelivery.find({ broadcastId }).populate("userId", "name email role phone");
};

export default {
  createBroadcast,
  previewBroadcast,
  getBroadcastById,
  getBroadcastDeliveries,
  resolveEligibleRecipients,
  calculateDistanceKm,
};
