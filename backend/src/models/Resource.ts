import mongoose, { Schema, Document } from "mongoose";
import { ResourceStatus, ResourceType } from "../types/models.js";

export interface IResourceDocument extends Document {
  name: string;
  type: ResourceType | string;
  category: string;
  status: ResourceStatus;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  address?: string;
  capacity?: number;
  contact?: string;
  availableAt: Date;
  lastUpdated: Date;
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

const resourceSchema = new Schema<IResourceDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    status: {
      type: String,
      enum: {
        values: Object.values(ResourceStatus),
        message: "Invalid resource status",
      },
      default: ResourceStatus.AVAILABLE,
    },
    location: locationSchema,
    address: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    capacity: {
      type: Number,
      min: 1,
    },
    contact: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    availableAt: {
      type: Date,
      default: Date.now,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Create 2dsphere index for location-based queries
resourceSchema.index({ location: "2dsphere" });

// Create index for common query patterns
resourceSchema.index({ status: 1 });
resourceSchema.index({ category: 1 });
resourceSchema.index({ type: 1 });
resourceSchema.index({ lastUpdated: -1 });

const Resource = mongoose.model<IResourceDocument>("Resource", resourceSchema);

export default Resource;
