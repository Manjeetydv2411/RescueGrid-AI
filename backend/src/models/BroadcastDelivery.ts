import mongoose, { Schema, Document } from "mongoose";
import { BroadcastChannel } from "./Broadcast.js";

export type DeliveryStatus = "SIMULATED" | "QUEUED" | "SENT" | "DELIVERED" | "FAILED";

export interface IBroadcastDeliveryDocument extends Document {
  broadcastId: mongoose.Schema.Types.ObjectId | string;
  userId: mongoose.Schema.Types.ObjectId | string;
  channel: BroadcastChannel;
  status: DeliveryStatus;
  recipientAddress: string;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  deliveredAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const broadcastDeliverySchema = new Schema<IBroadcastDeliveryDocument>(
  {
    broadcastId: {
      type: Schema.Types.ObjectId,
      ref: "Broadcast",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ["SMS", "EMAIL", "PUSH", "IN_APP"],
      required: true,
    },
    status: {
      type: String,
      enum: ["SIMULATED", "QUEUED", "SENT", "DELIVERED", "FAILED"],
      required: true,
      default: "QUEUED",
      index: true,
    },
    recipientAddress: {
      type: String,
      required: true,
      trim: true,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    deliveredAt: {
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

// Ensure uniqueness per broadcast, user, and channel for idempotency
broadcastDeliverySchema.index({ broadcastId: 1, userId: 1, channel: 1 }, { unique: true });
broadcastDeliverySchema.index({ status: 1 });

const BroadcastDelivery = mongoose.model<IBroadcastDeliveryDocument>(
  "BroadcastDelivery",
  broadcastDeliverySchema
);

export default BroadcastDelivery;
