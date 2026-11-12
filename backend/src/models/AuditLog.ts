import mongoose, { Schema, Document } from "mongoose";
import { UserRole } from "../types/models.js";

export interface IAuditLogDocument extends Document {
  action: string;
  entity: string;
  entityId: string;
  actorId: string | mongoose.Schema.Types.ObjectId;
  actorRole: UserRole;
  details: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    entity: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    entityId: {
      type: String,
      required: true,
      trim: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actorRole: {
      type: String,
      enum: {
        values: ["ADMIN", "COORDINATOR", "RESPONDER", "VIEWER"],
        message: "Invalid role",
      },
      required: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Create indexes for common query patterns
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model<IAuditLogDocument>("AuditLog", auditLogSchema);

export default AuditLog;
