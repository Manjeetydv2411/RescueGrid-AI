import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";
import { UserRole } from "../types/models.js";

export interface IUserDocument extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  isAvailable: boolean;
  skills: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const hashUserPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, 12);

// Define the location schema separately to avoid nested type issues
const locationSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: [Number],
  },
  { _id: false }
);

const userSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ["ADMIN", "COORDINATOR", "RESPONDER", "VIEWER"],
        message: "Invalid role",
      },
      default: "VIEWER",
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    location: locationSchema,
    isAvailable: {
      type: Boolean,
      default: true,
    },
    skills: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Create 2dsphere index for location-based queries
userSchema.index({ location: "2dsphere" });


const User = mongoose.model<IUserDocument>("User", userSchema);

export default User;
