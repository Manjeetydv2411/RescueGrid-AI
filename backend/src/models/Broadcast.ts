import mongoose, { Schema, Document } from "mongoose";
import { UserRole } from "../types/models.js";

export type BroadcastSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type BroadcastChannel = "SMS" | "EMAIL" | "PUSH" | "IN_APP";
export type BroadcastStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type TargetingMode = "INCIDENT_LOCATION" | "RADIUS" | "DISTRICT" | "CITY" | "EVERYONE";

export interface IBroadcastScope {
  targetingMode?: TargetingMode;
  targetRoles?: UserRole[];
  targetUserIds?: (mongoose.Schema.Types.ObjectId | string)[];
  incidentId?: mongoose.Schema.Types.ObjectId | string;
  center?: [number, number]; // [lng, lat]
  radiusKm?: number;
  district?: string;
  city?: string;
  zone?: string;
}

export interface IBroadcastDocument extends Document {
  title: string;
  message: string;
  severity: BroadcastSeverity;
  channels: BroadcastChannel[];
  scope: IBroadcastScope;
  senderId: mongoose.Schema.Types.ObjectId | string;
  status: BroadcastStatus;
  totalRecipients: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  simulatedDeliveries: number;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const broadcastSchema = new Schema<IBroadcastDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      required: true,
      default: "HIGH",
    },
    channels: {
      type: [String],
      enum: ["SMS", "EMAIL", "PUSH", "IN_APP"],
      required: true,
    },
    scope: {
      targetingMode: {
        type: String,
        enum: ["INCIDENT_LOCATION", "RADIUS", "DISTRICT", "CITY", "EVERYONE"],
        default: "EVERYONE",
      },
      targetRoles: [{ type: String, enum: ["ADMIN", "COORDINATOR", "RESPONDER", "VIEWER"] }],
      targetUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
      incidentId: { type: Schema.Types.ObjectId, ref: "Incident" },
      center: [Number], // [lng, lat]
      radiusKm: Number,
      district: { type: String, trim: true },
      city: { type: String, trim: true },
      zone: { type: String, trim: true },
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    totalRecipients: { type: Number, default: 0 },
    successfulDeliveries: { type: Number, default: 0 },
    failedDeliveries: { type: Number, default: 0 },
    simulatedDeliveries: { type: Number, default: 0 },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

broadcastSchema.index({ createdAt: -1 });

const Broadcast = mongoose.model<IBroadcastDocument>("Broadcast", broadcastSchema);

export default Broadcast;
