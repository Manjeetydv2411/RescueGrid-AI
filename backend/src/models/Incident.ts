import mongoose, { Schema, Document } from "mongoose";
import { Severity, IncidentStatus, IncidentCategory, IIncidentAttachment } from "../types/models.js";

export interface IIncidentDocument extends Document {
  title: string;
  description: string;
  severity: Severity;
  category: IncidentCategory;
  status: IncidentStatus;
  priority: number;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  address?: string;
  contactPhone?: string;
  attachments: IIncidentAttachment[];
  reportedBy: string | mongoose.Schema.Types.ObjectId;
  assignedTo?: string | mongoose.Schema.Types.ObjectId;
  assignedResources: mongoose.Schema.Types.ObjectId[];
  requiredSkills: string[];
  tags: string[];
  version: number;
  auditLog: {
    action: string;
    actorId: string;
    actorRole: string;
    timestamp: Date;
    details?: Record<string, unknown>;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// Define the location schema separately
const locationSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: [Number],
  },
  { _id: false }
);

// Define the audit log schema
const auditLogSchema = new Schema(
  {
    action: { type: String, required: true },
    actorId: { type: String, required: true },
    actorRole: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    details: Schema.Types.Mixed,
  },
  { _id: false }
);

// Define the attachment metadata schema
const attachmentSchema = new Schema(
  {
    type: { type: String, enum: ["IMAGE", "VIDEO"], required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storageKey: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const incidentSchema = new Schema<IIncidentDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 2000,
    },
    severity: {
      type: String,
      enum: {
        values: Object.values(Severity),
        message: "Invalid severity level",
      },
      required: true,
    },
    category: {
      type: String,
      enum: {
        values: Object.values(IncidentCategory),
        message: "Invalid incident category",
      },
      required: true,
    },
    status: {
      type: String,
      enum: {
        values: Object.values(IncidentStatus),
        message: "Invalid incident status",
      },
      default: IncidentStatus.REPORTED,
    },
    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },
    location: locationSchema,
    address: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    contactPhone: {
      type: String,
      trim: true,
      required: false,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    assignedResources: [
      {
        type: Schema.Types.ObjectId,
        ref: "Resource",
      },
    ],
    requiredSkills: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    version: {
      type: Number,
      default: 1,
    },
    auditLog: {
      type: [auditLogSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Create 2dsphere index for location-based queries
incidentSchema.index({ location: "2dsphere" });

// Create indexes for common query patterns
incidentSchema.index({ severity: 1, status: 1 });
incidentSchema.index({ assignedTo: 1 });
incidentSchema.index({ priority: -1 });
incidentSchema.index({ status: 1, createdAt: -1 });
incidentSchema.index({ category: 1 });
incidentSchema.index({ "auditLog.actorId": 1 });

const Incident = mongoose.model<IIncidentDocument>("Incident", incidentSchema);

export default Incident;
