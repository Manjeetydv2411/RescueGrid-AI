import { z } from "zod";
import { normalizePhoneNumber } from "./phone.js";

/**
 * Phone number validation helper for Zod schemas.
 */
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const requiredContactPhone = z.preprocess(
  (val) => (typeof val === "string" ? val.trim() : val),
  z.unknown().transform((val, ctx) => {
    const result = normalizePhoneNumber(val);
    if (!result.isValid || !result.normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error || "Contact phone number is required and must be valid",
      });
      return z.NEVER;
    }
    return result.normalized;
  })
);

const optionalContactPhone = z.preprocess(
  emptyToUndefined,
  z.unknown().optional().transform((val, ctx) => {
    if (val === undefined || val === null) return undefined;
    const result = normalizePhoneNumber(val);
    if (!result.isValid || !result.normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error || "Contact phone number must be valid",
      });
      return z.NEVER;
    }
    return result.normalized;
  })
);

const locationPreprocessor = z.preprocess((val) => {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}, z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.coerce.number(), z.coerce.number()]),
}));

const tagsPreprocessor = z.preprocess((val) => {
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return val.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return val;
}, z.array(z.string()).optional());

/**
 * Query-string values arrive as strings. `z.number()` rejects "1", so every
 * paginated endpoint used to fail validation once a page/limit was supplied.
 * Coerce them, and treat blank strings as "filter not provided".
 */
const numericQuery = (fallback: number, max?: number) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    max === undefined
      ? z.coerce.number().int().min(1).default(fallback)
      : z.coerce.number().int().min(1).max(max).default(fallback)
  );

const optionalString = z.preprocess(
  emptyToUndefined,
  z.string().trim().optional()
);

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(emptyToUndefined, z.enum(values).optional());

export const SORT_FIELDS = {
  INCIDENT: ["createdAt", "updatedAt", "priority", "severity", "status", "title"] as const,
  RESOURCE: ["name", "status", "type", "category", "capacity", "lastUpdated"] as const,
  ASSIGNMENT: ["createdAt", "assignedAt", "completedAt", "status"] as const,
} as const;

export const userSchemas = {
  register: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    role: z.enum(["VIEWER"]).default("VIEWER"),
    phone: z.string().optional(),
  }),

  login: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password is required"),
  }),

  update: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    email: z.string().email("Invalid email address").optional(),
    phone: z.string().optional(),
    role: z.enum(["ADMIN", "COORDINATOR", "RESPONDER", "VIEWER"]).optional(),
    isAvailable: z.boolean().optional(),
  }),

  adminCreate: z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().trim().email("Invalid email address"),
    password: z.string().min(12, "Password must be at least 12 characters"),
    role: z.enum(["ADMIN", "COORDINATOR", "RESPONDER", "VIEWER"]),
    phone: z.string().trim().max(20).optional(),
  }),

  adminRoleUpdate: z.object({
    role: z.enum(["ADMIN", "COORDINATOR", "RESPONDER", "VIEWER"]),
  }),
};

export const incidentSchemas = {
  create: z.object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    category: z.enum(["FLOOD", "FIRE", "EARTHQUAKE", "LANDSLIDE", "MEDICAL", "OTHER"]),
    status: z.enum(["REPORTED", "VERIFIED", "ACTIVE", "RESOLVED", "CLOSED"]).optional(),
    contactPhone: requiredContactPhone,
    location: locationPreprocessor,
    address: z.string().optional(),
    tags: tagsPreprocessor,
  }),

  update: z.object({
    title: z.string().min(3, "Title must be at least 3 characters").optional(),
    description: z.string().min(10, "Description must be at least 10 characters").optional(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    category: z.enum(["FLOOD", "FIRE", "EARTHQUAKE", "LANDSLIDE", "MEDICAL", "OTHER"]).optional(),
    status: z.enum(["REPORTED", "VERIFIED", "ACTIVE", "RESOLVED", "CLOSED"]).optional(),
    contactPhone: optionalContactPhone,
    assignedTo: z.string().optional(),
    location: locationPreprocessor.optional(),
    address: z.string().optional(),
    tags: tagsPreprocessor,
  }),

  query: z.object({
    page: numericQuery(1),
    limit: numericQuery(20),
    status: optionalEnum([
      "REPORTED",
      "VERIFIED",
      "ACTIVE",
      "RESOLVED",
      "CLOSED",
    ]),
    severity: optionalEnum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    category: optionalEnum([
      "FLOOD",
      "FIRE",
      "EARTHQUAKE",
      "LANDSLIDE",
      "MEDICAL",
      "OTHER",
    ]),
    search: optionalString,
    near: optionalString,
    sortBy: optionalEnum(SORT_FIELDS.INCIDENT),
    sortOrder: optionalEnum(["asc", "desc"]),
  }),
};

export const resourceSchemas = {
  create: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    type: z.string().min(2, "Type must be at least 2 characters"),
    category: z.string().min(2, "Category must be at least 2 characters"),
    status: z.enum(["AVAILABLE", "ON_MISSION", "MAINTENANCE", "UNAVAILABLE"]).default("AVAILABLE"),
    address: z.string().optional(),
    location: z.object({
      type: z.literal("Point"),
      coordinates: z.tuple([z.number(), z.number()]),
    }),
    capacity: z.number().int().positive().optional(),
    contact: z.string().optional(),
  }),

  update: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    type: z.string().min(2, "Type must be at least 2 characters").optional(),
    category: z.string().min(2, "Category must be at least 2 characters").optional(),
    status: z.enum(["AVAILABLE", "ON_MISSION", "MAINTENANCE", "UNAVAILABLE"]).optional(),
    address: z.string().optional(),
    location: z.object({
      type: z.literal("Point"),
      coordinates: z.tuple([z.number(), z.number()]),
    }).optional(),
    capacity: z.number().int().positive().optional(),
    contact: z.string().optional(),
  }),

  query: z.object({
    page: numericQuery(1),
    limit: numericQuery(20, 100),
    status: optionalEnum([
      "AVAILABLE",
      "ON_MISSION",
      "MAINTENANCE",
      "UNAVAILABLE",
    ]),
    category: optionalString,
    type: optionalString,
    search: optionalString,
    near: optionalString,
    sortBy: optionalEnum(SORT_FIELDS.RESOURCE),
    sortOrder: optionalEnum(["asc", "desc"]),
  }),
};

export const assignmentSchemas = {
  create: z.object({
    responderId: z.string().min(1, "Responder ID is required"),
    resourceId: z.string().optional(),
    notes: z.string().optional(),
  }),

  update: z.object({
    // EXPIRED is part of the status enum, the query schema, and the
    // transition table (PENDING -> EXPIRED). Leaving it out here made the
    // API reject a transition the UI legitimately offers.
    status: z.enum(["PENDING", "ACCEPTED", "DECLINED", "DISPATCHED", "ARRIVED", "COMPLETED", "CANCELLED", "EXPIRED"]).optional(),
    notes: z.string().optional(),
  }),

  query: z.object({
    page: numericQuery(1),
    limit: numericQuery(20, 100),
    status: optionalEnum([
      "PENDING",
      "ACCEPTED",
      "DECLINED",
      "DISPATCHED",
      "ARRIVED",
      "COMPLETED",
      "CANCELLED",
      "EXPIRED",
    ]),
    incidentId: optionalString,
    responderId: optionalString,
    resourceId: optionalString,
    sortBy: optionalEnum(SORT_FIELDS.ASSIGNMENT),
    sortOrder: optionalEnum(["asc", "desc"]),
  }),
};

export const paginationSchemas = {
  request: z.object({
    page: numericQuery(1),
    limit: numericQuery(20, 100),
  }),
};

export const assistantSchemas = {
  chat: z.object({
    message: z
      .string()
      .trim()
      .min(1, "Message cannot be empty")
      .max(1000, "Message is too long (maximum 1000 characters)"),
  }),
};

/**
 * Parse `data` with `schema` and return the validated output.
 *
 * Typed against the schema itself so each caller gets the exact inferred
 * shape of the schema it passed, rather than a hand-written duplicate.
 */
export const validate = <T extends z.ZodType>(
  schema: T,
  data: unknown
): z.infer<T> => {
  return schema.parse(data) as z.infer<T>;
};

export default {
  user: userSchemas,
  incident: incidentSchemas,
  resource: resourceSchemas,
  assignment: assignmentSchemas,
  pagination: paginationSchemas,
  assistant: assistantSchemas,
  validate,
};
