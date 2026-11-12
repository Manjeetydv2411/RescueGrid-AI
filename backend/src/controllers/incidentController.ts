import { Request, Response, NextFunction } from "express";
import * as incidentService from "../services/incidentService.js";
import { incidentSchemas, validate } from "../utils/validation.js";
import { Severity, IncidentCategory, IIncidentAttachment } from "../types/models.js";
import { verifyUploadedFile } from "../utils/fileValidation.js";
import { storageProvider, cleanupFiles } from "../services/storageService.js";
import {
  canAccessIncidentAttachment,
  canViewReporterPhone,
} from "../services/incidentAccess.js";

/**
 * Normalizes incident documents for API response, adding secure attachment URLs
 * and applying strict role-based masking for reporter contact phone numbers.
 */
function formatIncidentResponse(
  incidentDoc: any,
  userRole?: string,
  userId?: string
): any {
  if (!incidentDoc) return null;
  const inc = incidentDoc.toObject ? incidentDoc.toObject() : { ...incidentDoc };

  const id = inc._id?.toString() || inc.id;

  // Format attachments with secure URL endpoint (never exposing storageKey directly)
  const attachments = (inc.attachments || []).map((att: any) => ({
    _id: att._id?.toString() || att.id,
    type: att.type,
    originalName: att.originalName,
    mimeType: att.mimeType,
    size: att.size,
    url: `/api/v1/incidents/${id}/attachments/${att._id?.toString() || att.id}`,
    createdAt: att.createdAt,
  }));

  const formatted: any = {
    ...inc,
    id,
    attachments,
  };

  // RBAC for contactPhone:
  // Only ADMIN and COORDINATOR users are permitted to view reporter phone numbers
  const canSeePhone = canViewReporterPhone({ role: userRole });
  if (!canSeePhone) {
    delete formatted.contactPhone;
  }

  return formatted;
}

export const createIncident = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const savedStorageKeys: string[] = [];
  try {
    const user = (req as any).user;
    const files = (req as any).files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;

    const imageFiles = files?.images || [];
    const videoFiles = files?.video || [];

    // Check optional emergency accessibility vs mandatory image requirement
    const requireImage = process.env.REQUIRE_INCIDENT_IMAGE === "true";
    if (requireImage && imageFiles.length === 0) {
      (res as any).error(
        400,
        "At least one evidence image is required for new incident reports"
      );
      return;
    }

    // Verify all uploaded images (magic bytes, extensions, size limits)
    for (const file of imageFiles) {
      const verification = verifyUploadedFile(
        file.buffer,
        file.originalname,
        file.mimetype
      );
      if (!verification.isValid || verification.detectedType !== "IMAGE") {
        (res as any).error(
          400,
          verification.error || `File '${file.originalname}' is not a valid image.`
        );
        return;
      }
    }

    // Verify all uploaded videos (magic bytes, extensions, size limits)
    for (const file of videoFiles) {
      const verification = verifyUploadedFile(
        file.buffer,
        file.originalname,
        file.mimetype
      );
      if (!verification.isValid || verification.detectedType !== "VIDEO") {
        (res as any).error(
          400,
          verification.error || `File '${file.originalname}' is not a valid video.`
        );
        return;
      }
    }

    // Validate body before writing files to storage
    const data = validate(incidentSchemas.create, req.body);

    // Save verified files to storage provider
    const attachments: IIncidentAttachment[] = [];
    for (const file of imageFiles) {
      const stored = await storageProvider.save(
        file.buffer,
        file.originalname,
        file.mimetype
      );
      savedStorageKeys.push(stored.storageKey);
      attachments.push({
        type: "IMAGE",
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        size: stored.size,
        storageKey: stored.storageKey,
        createdAt: new Date(),
      });
    }

    for (const file of videoFiles) {
      const stored = await storageProvider.save(
        file.buffer,
        file.originalname,
        file.mimetype
      );
      savedStorageKeys.push(stored.storageKey);
      attachments.push({
        type: "VIDEO",
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        size: stored.size,
        storageKey: stored.storageKey,
        createdAt: new Date(),
      });
    }

    const incident = await incidentService.createIncident(
      data.title,
      data.description,
      data.severity as Severity,
      data.category as IncidentCategory,
      data.location,
      user.id,
      data.address,
      data.tags,
      data.contactPhone,
      attachments
    );

    const formatted = formatIncidentResponse(incident, user.role, user.id);
    (res as any).created(formatted);
  } catch (error) {
    // Clean up any files that were saved to storage if creation fails
    if (savedStorageKeys.length > 0) {
      await cleanupFiles(savedStorageKeys);
    }
    next(error);
  }
};

export const getIncidentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const incident = await incidentService.getIncidentById(req.params.id);

    if (!incident) {
      (res as any).error(404, "Incident not found");
      return;
    }

    const user = (req as any).user;
    const formatted = formatIncidentResponse(incident, user?.role, user?.id);

    (res as any).success(formatted);
  } catch (error) {
    next(error);
  }
};

export const updateIncident = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = validate(incidentSchemas.update, req.body);
    const user = (req as any).user;

    // Editing an incident record is a coordinator action
    if (user.role !== "ADMIN" && user.role !== "COORDINATOR") {
      (res as any).error(403, "Not authorized to update incidents");
      return;
    }

    const updateData: any = { ...data };
    if (data.severity) updateData.severity = data.severity as Severity;
    if (data.category) updateData.category = data.category as IncidentCategory;
    if (data.status) updateData.status = data.status;
    if (data.contactPhone) updateData.contactPhone = data.contactPhone;

    const incident = await incidentService.updateIncident(
      req.params.id,
      updateData,
      user.id,
      user.role
    );

    if (!incident) {
      (res as any).error(404, "Incident not found");
      return;
    }

    const formatted = formatIncidentResponse(incident, user.role, user.id);
    (res as any).success(formatted);
  } catch (error) {
    next(error);
  }
};

export const deleteIncident = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    const incident = await incidentService.getIncidentById(req.params.id);

    // Only admins, coordinators, or the reporter can delete
    if (user.role !== "ADMIN" && user.role !== "COORDINATOR") {
      const reporterId =
        (incident?.reportedBy as any)?._id?.toString() ||
        incident?.reportedBy?.toString();
      if (!incident || reporterId !== user.id) {
        (res as any).error(403, "Not authorized to delete this incident");
        return;
      }
    }

    await incidentService.deleteIncident(req.params.id);

    (res as any).success({ message: "Incident deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const listIncidents = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = validate(incidentSchemas.query, req.query);

    const pagination = {
      page: query.page,
      limit: query.limit,
    };

    const filter: incidentService.IncidentFilter = {
      status: query.status,
      severity: query.severity,
      category: query.category,
      search: query.search,
      near: query.near,
      sortBy: query.sortBy,
      sortOrder:
        query.sortOrder === "asc" || query.sortOrder === "desc"
          ? query.sortOrder
          : undefined,
    };

    const result = await incidentService.listIncidents(filter, pagination);

    // Strip contactPhone from all incident listings to protect reporter privacy
    const sanitizedData = result.data.map((item: any) =>
      formatIncidentResponse(item, "VIEWER")
    );

    (res as any).success({
      ...result,
      data: sanitizedData,
    });
  } catch (error) {
    next(error);
  }
};

export const getNearbyIncidents = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { lng, lat, maxDistance, limit } = req.query;

    const longitude = parseFloat(lng as string);
    const latitude = parseFloat(lat as string);

    if (isNaN(longitude) || isNaN(latitude)) {
      (res as any).error(400, "Invalid coordinates");
      return;
    }

    const incidents = await incidentService.getNearbyIncidents(
      longitude,
      latitude,
      maxDistance ? parseFloat(maxDistance as string) : 50000,
      limit ? parseInt(limit as string) : 10
    );

    const sanitized = incidents.map((item: any) =>
      formatIncidentResponse(item, "VIEWER")
    );

    (res as any).success(sanitized);
  } catch (error) {
    next(error);
  }
};

export const assignIncident = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;

    const incident = await incidentService.assignIncident(
      req.params.id,
      req.body.assignedTo,
      user.id,
      user.role
    );

    if (!incident) {
      (res as any).error(404, "Incident not found");
      return;
    }

    const formatted = formatIncidentResponse(incident, user.role, user.id);
    (res as any).success(formatted);
  } catch (error) {
    next(error);
  }
};

export const unassignIncident = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;

    const incident = await incidentService.unassignIncident(
      req.params.id,
      user.id,
      user.role
    );

    if (!incident) {
      (res as any).error(404, "Incident not found");
      return;
    }

    const formatted = formatIncidentResponse(incident, user.role, user.id);
    (res as any).success(formatted);
  } catch (error) {
    next(error);
  }
};

export const listIncidentAttachments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const incident = await incidentService.getIncidentById(id);
    if (!incident) {
      (res as any).error(404, "Incident not found");
      return;
    }

    const attachments = (incident.attachments || []).map((att: any) => ({
      _id: att._id?.toString() || att.id,
      type: att.type,
      originalName: att.originalName,
      mimeType: att.mimeType,
      size: att.size,
      url: `/api/v1/incidents/${id}/attachments/${att._id?.toString() || att.id}`,
      createdAt: att.createdAt,
    }));

    (res as any).success({ attachments });
  } catch (error) {
    next(error);
  }
};

/**
 * Downloads or streams an incident evidence attachment with authorization enforcement.
 */
export const getAttachment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, attachmentId } = req.params;
    const user = (req as any).user;

    const record = await incidentService.getIncidentAttachment(id, attachmentId);
    if (!record) {
      (res as any).error(404, "Attachment not found");
      return;
    }

    const { incident, attachment } = record;

    // Check authorization: only authorized roles/users can access incident attachments
    if (!canAccessIncidentAttachment(incident, user)) {
      (res as any).error(403, "Not authorized to access this attachment");
      return;
    }

    const streamData = await storageProvider.getStream(attachment.storageKey);

    res.setHeader("Content-Type", streamData.mimeType || attachment.mimeType);
    if (streamData.size || attachment.size) {
      res.setHeader("Content-Length", streamData.size || attachment.size);
    }
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(attachment.originalName)}"`
    );
    res.setHeader("Cache-Control", "private, max-age=3600");

    streamData.stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export default {
  createIncident,
  getIncidentById,
  updateIncident,
  deleteIncident,
  listIncidents,
  getNearbyIncidents,
  assignIncident,
  unassignIncident,
  getAttachment,
};
