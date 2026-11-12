import { Request, Response, NextFunction } from "express";
import { assistantService } from "../services/assistantService.js";
import { validate, assistantSchemas } from "../utils/validation.js";

export const chat = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = validate(assistantSchemas.chat, req.body);
    const user = (req as any).user;

    if (!user) {
      res.error(401, "Authentication required");
      return;
    }

    const result = await assistantService.generateResponse(data.message, {
      id: user.id || user._id,
      name: user.name || "Operator",
      email: user.email || "",
      role: user.role,
    });

    res.success(result);
  } catch (error) {
    next(error);
  }
};

export default {
  chat,
};
