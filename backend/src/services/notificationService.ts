import mongoose from "mongoose";
import Notification, { INotificationDocument } from "../models/Notification.js";
import { NotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import * as socketService from "../socket/socketService.js";

export interface CreateNotificationParams {
  userId: string;
  type: "INCIDENT" | "ASSIGNMENT" | "RESOURCE" | "BROADCAST";
  title: string;
  message: string;
  relatedId?: string;
  metadata?: Record<string, unknown>;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedNotifications {
  data: INotificationDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    unreadCount: number;
    hasMore: boolean;
  };
}

/**
 * Create a new notification record in the database
 */
export const createNotification = async (
  params: CreateNotificationParams
): Promise<INotificationDocument> => {
  const notification = await Notification.create({
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    relatedId: params.relatedId,
    metadata: params.metadata,
  });

  logger.info(
    `Notification created: ${notification._id} for user ${params.userId} (${params.type})`
  );

  return notification;
};

/**
 * Get paginated notifications for a specific user
 */
export const getUserNotifications = async (
  userId: string,
  options: PaginationOptions = { page: 1, limit: 20 },
  unreadOnly: boolean = false
): Promise<PaginatedNotifications> => {
  const query: any = { userId };
  if (unreadOnly) {
    query.isRead = false;
  }

  const skip = (options.page - 1) * options.limit;
  const [total, unreadCount, data] = await Promise.all([
    Notification.countDocuments(query),
    Notification.countDocuments({ userId, isRead: false }),
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(options.limit),
  ]);

  const totalPages = Math.ceil(total / options.limit);

  return {
    data,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages,
      unreadCount,
      hasMore: options.page < totalPages,
    },
  };
};

/**
 * Mark a single notification as read
 */
export const markAsRead = async (
  notificationId: string,
  userId: string
): Promise<INotificationDocument | null> => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );

  if (!notification) {
    throw new NotFoundError("Notification", notificationId);
  }

  // The client subscribes to this so the unread badge and the list update
  // when the notification is read in another tab or on another device.
  socketService.emitNotificationRead({
    notificationId: notification._id.toString(),
    userId,
    all: false,
  });

  return notification;
};

/**
 * Mark all notifications for a user as read
 */
export const markAllAsRead = async (userId: string): Promise<{ modifiedCount: number }> => {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  socketService.emitNotificationRead({ userId, all: true });

  return { modifiedCount: result.modifiedCount };
};

/**
 * Get unread notification count for a user
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  return Notification.countDocuments({ userId, isRead: false });
};

/**
 * Record a notification and push it to the recipient's socket room.
 *
 * Used by the operational services so that a dispatch, an incident report,
 * or a status change reaches the user who needs to act on it. A failure
 * here must not fail the operation that triggered it — the notification is
 * supporting information, not the source of truth — so errors are logged
 * and swallowed.
 */
export const notify = async (params: CreateNotificationParams): Promise<void> => {
  try {
    const notification = await createNotification(params);

    socketService.emitNotification({
      notificationId: notification._id.toString(),
      userId: params.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      relatedId: notification.relatedId?.toString(),
      createdAt: notification.createdAt.toISOString(),
    });
  } catch (error) {
    logger.warn(
      `Unable to create notification for user ${params.userId}: ${(error as Error).message}`
    );
  }
};

export default {
  createNotification,
  notify,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};
