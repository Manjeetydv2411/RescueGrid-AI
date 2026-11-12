import { Request, Response, NextFunction } from "express";
import * as analyticsService from "../services/analyticsService.js";

export const getAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user || (user.role !== "ADMIN" && user.role !== "COORDINATOR")) {
      res.error(403, "Not authorized to view analytics dashboard");
      return;
    }

    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const summary = await analyticsService.getAdvancedAnalytics(startDate, endDate);

    res.success(summary);
  } catch (error) {
    next(error);
  }
};

export default {
  getAnalytics,
};
