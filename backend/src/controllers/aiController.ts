import { Request, Response, NextFunction } from "express";
import * as aiService from "../services/aiService.js";

export const getCategorySuggestion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      res.error(400, "Title and description are required");
      return;
    }

    const result = await aiService.aiClient.suggestCategory(title, description);

    res.success({
      ...result,
      ai_recommended: true,
    });
  } catch (error) {
    next(error);
  }
};

export const generateSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { incidentId } = req.params;

    // Get incident data from database
    const incident = await import("../services/incidentService.js").then(
      (m) => m.getIncidentById(incidentId)
    );

    if (!incident) {
      res.error(404, "Incident not found");
      return;
    }

    const summary = await aiService.aiClient.generateSummary(incident);

    res.success({
      incidentId,
      ...summary,
      ai_generated: true,
    });
  } catch (error) {
    next(error);
  }
};

export const getPriorityScore = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { incidentId } = req.params;

    // Get incident data
    const incident = await import("../services/incidentService.js").then(
      (m) => m.getIncidentById(incidentId)
    );

    if (!incident) {
      res.error(404, "Incident not found");
      return;
    }

    const priority = await aiService.aiClient.scorePriority(incident);

    res.success({
      incidentId,
      ...priority,
      ai_recommended: true,
      note: "This is an AI recommendation. Final priority decision requires human confirmation.",
    });
  } catch (error) {
    next(error);
  }
};

export const getMissingInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { incidentId } = req.params;

    // Get incident data
    const incident = await import("../services/incidentService.js").then(
      (m) => m.getIncidentById(incidentId)
    );

    if (!incident) {
      res.error(404, "Incident not found");
      return;
    }

    const missingInfo = await aiService.aiClient.flagMissingInfo(incident);

    res.success({
      incidentId,
      ...missingInfo,
      ai_flagged: true,
      note: "Please review and verify the flagged information.",
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getCategorySuggestion,
  generateSummary,
  getPriorityScore,
  getMissingInfo,
};
