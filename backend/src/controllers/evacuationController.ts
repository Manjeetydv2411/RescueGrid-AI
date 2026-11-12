import { Request, Response, NextFunction } from "express";
import * as evacuationService from "../services/evacuationService.js";

export const getEvacuationPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.error(401, "Authentication required");
      return;
    }

    const originLat = parseFloat(req.query.originLat as string);
    const originLng = parseFloat(req.query.originLng as string);
    const destLat = parseFloat(req.query.destLat as string);
    const destLng = parseFloat(req.query.destLng as string);

    if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
      res.error(400, "Valid originLat, originLng, destLat, and destLng query parameters are required.");
      return;
    }

    const plan = await evacuationService.calculateEvacuationPlan(
      originLat,
      originLng,
      destLat,
      destLng
    );

    res.success(plan);
  } catch (error) {
    next(error);
  }
};

export default {
  getEvacuationPlan,
};
