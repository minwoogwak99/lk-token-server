import { z } from "zod";

export const checkOrCreateUserSchema = z.object({
  user_id: z.string().min(1, "user_id is required"),
  user_name: z.string().min(1, "user_name is required"),
  email: z.string().email("Valid email is required"),
  profile_img: z.string().url().optional().nullable(),
});

export const updateUserSchema = z.object({
  user_name: z.string().min(1, "user_name cannot be empty").optional(),
  email: z.string().email("Valid email is required").optional(),
  profile_img: z.string().url().optional().nullable(),
}).refine(
  (data) => data.user_name !== undefined || data.email !== undefined || data.profile_img !== undefined,
  { message: "At least one field (user_name, email, or profile_img) must be provided for update" }
);

export const userContextSchema = z.object({
  currentDateTime: z.string().datetime(), // ISO 8601 UTC time
  currentDateTimeLocal: z.string().optional(), // Human-readable local time with timezone
  timezone: z.string(),
  locale: z.string(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string().optional(),
  }).optional(),
  lastCallTime: z.string().optional(),
  lastCallLocation: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string().optional(),
  }).optional(),
  previousCallsCount: z.number().optional(),
  timeSinceLastCall: z.number().optional(), // Duration in seconds since last call
  device: z.object({
    brand: z.string().optional(),
    deviceName: z.string().optional(),
    deviceType: z.string().optional(),
    manufacturer: z.string().optional(),
    osName: z.string().optional(),
    osVersion: z.string().optional(),
  }).optional(),
});

export type CheckOrCreateUserInput = z.infer<typeof checkOrCreateUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserContext = z.infer<typeof userContextSchema>;
