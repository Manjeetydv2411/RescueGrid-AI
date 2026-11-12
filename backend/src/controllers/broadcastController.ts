import { Request, Response, NextFunction } from "express";
import Broadcast from "../models/Broadcast.js";
import * as broadcastService from "../services/broadcast/broadcastService.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";

export const createBroadcast = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    const { title, message, severity, channels, scope, idempotencyKey, metadata } = req.body;

    if (!title || !message) {
      throw new BadRequestError("Title and message are required for emergency broadcast");
    }

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      throw new BadRequestError("At least one target channel (SMS, EMAIL, PUSH, IN_APP) must be specified");
    }

    const broadcast = await broadcastService.createBroadcast({
      title,
      message,
      severity: severity || "HIGH",
      channels,
      scope: scope || {},
      senderId: user.id,
      idempotencyKey,
      metadata,
    });

    (res as any).success(broadcast, 201, "Emergency broadcast dispatched successfully");
  } catch (error) {
    next(error);
  }
};

export const previewBroadcast = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, message, severity, channels, scope } = req.body;

    if (!title || !message) {
      throw new BadRequestError("Title and message are required for broadcast preview");
    }

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      throw new BadRequestError("At least one target channel must be specified");
    }

    const preview = await broadcastService.previewBroadcast({
      title,
      message,
      severity: severity || "HIGH",
      channels,
      scope: scope || {},
    });

    res.success(preview, "Broadcast preview generated successfully");
  } catch (error) {
    next(error);
  }
};

export const getBroadcast = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const broadcastId = req.params.id;
    const broadcast = await broadcastService.getBroadcastById(broadcastId);

    if (!broadcast) {
      throw new NotFoundError("Broadcast", broadcastId);
    }

    const deliveries = await broadcastService.getBroadcastDeliveries(broadcastId);

    res.success({
      broadcast,
      deliveries,
    });
  } catch (error) {
    next(error);
  }
};

export const listBroadcasts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit as string) || 20, 1);
    const severity = req.query.severity as string;
    const status = req.query.status as string;

    const query: any = {};
    if (severity) query.severity = severity;
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      Broadcast.countDocuments(query),
      Broadcast.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("senderId", "name email role"),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.success({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createBroadcast,
  previewBroadcast,
  getBroadcast,
  listBroadcasts,
};
