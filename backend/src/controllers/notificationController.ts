import { Request, Response, NextFunction } from "express";
import * as notificationService from "../services/notificationService.js";

export const getMyNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unread === "true";

    const result = await notificationService.getUserNotifications(
      user.id,
      { page, limit },
      unreadOnly
    );

    res.success(result);
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    const notification = await notificationService.markAsRead(req.params.id, user.id);

    res.success(notification, "Notification marked as read");
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    const result = await notificationService.markAllAsRead(user.id);

    res.success(result, "All notifications marked as read");
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    const count = await notificationService.getUnreadCount(user.id);

    res.success({ unreadCount: count });
  } catch (error) {
    next(error);
  }
};

export default {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
};
