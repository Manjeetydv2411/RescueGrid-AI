import mongoose, { Schema, Document } from "mongoose";
import { AssignmentStatus } from "../types/models.js";

export interface IAssignmentDocument extends Document {
  incidentId: string | mongoose.Schema.Types.ObjectId;
  responderId: string | mongoose.Schema.Types.ObjectId;
  resourceId?: string | mongoose.Schema.Types.ObjectId;
  status: AssignmentStatus;
  assignedAt: Date;
  completedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const assignmentSchema = new Schema<IAssignmentDocument>(
  {
    incidentId: {
      type: Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
      index: true,
    },
    responderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      ref: "Resource",
    },
    status: {
      type: String,
      enum: {
        values: Object.values(AssignmentStatus),
        message: "Invalid assignment status",
      },
      default: AssignmentStatus.PENDING,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: Date,
    notes: {
      type: String,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Create indexes for common query patterns
assignmentSchema.index({ responderId: 1 });
assignmentSchema.index({ status: 1 });
assignmentSchema.index({ assignedAt: -1 });

const Assignment = mongoose.model<IAssignmentDocument>(
  "Assignment",
  assignmentSchema
);

export default Assignment;
