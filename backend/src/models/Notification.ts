import mongoose, { Schema, Document } from "mongoose";

export interface INotificationDocument extends Document {
  userId: mongoose.Schema.Types.ObjectId | string;
  type: "INCIDENT" | "ASSIGNMENT" | "RESOURCE" | "BROADCAST";
  title: string;
  message: string;
  relatedId?: mongoose.Schema.Types.ObjectId | string;
  isRead: boolean;
  readAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["INCIDENT", "ASSIGNMENT", "RESOURCE", "BROADCAST"],
      required: true,
    },
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
      maxlength: 1000,
    },
    relatedId: {
      type: Schema.Types.ObjectId,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
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

// Indexes for common query patterns
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = mongoose.model<INotificationDocument>(
  "Notification",
  notificationSchema
);

export default Notification;
